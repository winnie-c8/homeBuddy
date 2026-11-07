import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { alertsForCheckIn, type Alert, type CareState, type CheckIn, type Patient, type Question } from "./care";

/** What one senior's record holds in the database (patients.state). */
export type PatientBlob = { patient: Omit<Patient, "id">; questions: Question[]; alerts: Alert[] };
export type PatientRow = { id: string; senior_user_id: string; invite_code: string; state: PatientBlob };

let state: CareState | null = null;
let rows: PatientRow[] = [];
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const uid = () => Math.random().toString(36).slice(2, 10);

function toState(list: PatientRow[]): CareState {
  return {
    patients: list.map((r) => ({ ...r.state.patient, id: r.id })),
    questions: list.flatMap((r) => (r.state.questions ?? []).map((q) => ({ ...q, patientId: r.id }))),
    alerts: list.flatMap((r) => (r.state.alerts ?? []).map((a) => ({ ...a, patientId: r.id }))),
  };
}

export async function refreshCare() {
  const { data, error } = await supabase.from("patients").select("id, senior_user_id, invite_code, state");
  if (error) throw error;
  rows = (data ?? []) as unknown as PatientRow[];
  state = toState(rows);
  emit();
}

export function patientRows() {
  return rows;
}

/** Read the latest copy, apply the change, and save it — keeps concurrent edits from clobbering each other as much as possible. */
async function update(patientId: string, fn: (b: PatientBlob) => PatientBlob) {
  const { data, error } = await supabase.from("patients").select("state").eq("id", patientId).single();
  if (error) throw error;
  const next = fn(data.state as unknown as PatientBlob);
  const { error: saveError } = await supabase.from("patients").update({ state: next as unknown as Json }).eq("id", patientId);
  if (saveError) throw saveError;
  await refreshCare();
}

/** How often open pages reload records from the database. */
export const REFRESH_MS = 20_000;

export function useCare(): CareState | null {
  useEffect(() => {
    if (!loading) loading = refreshCare().catch(() => {
      loading = null;
    });
  }, []);
  // Pick up changes made on other devices (e.g. a senior's new check-in) without a page refresh.
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refreshCare().catch(() => {});
    };
    const timer = setInterval(tick, REFRESH_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => null,
  );
}

/** Forget cached records (on sign-out). */
export function clearCare() {
  state = null;
  rows = [];
  loading = null;
  emit();
}

export function newPatientBlob(input: { name: string; preferredName: string; age: number; city: string; callTime: string }): PatientBlob {
  return {
    patient: { ...input, conditions: [], meds: [], planItems: [], planChanges: [], contacts: [], sharedWith: [], checkIns: [] },
    questions: [],
    alerts: [],
  };
}

export async function createMyPatient(userId: string, blob: PatientBlob) {
  const { error } = await supabase.from("patients").insert({ senior_user_id: userId, state: blob as unknown as Json });
  if (error) throw error;
  await refreshCare();
}

export async function joinPatient(code: string, relation: string) {
  const { error } = await supabase.rpc("join_patient", { _code: code, _relation: relation });
  if (error) throw error;
  await refreshCare();
}

export const care = {
  async addCheckIn(patientId: string, c: Omit<CheckIn, "id">, newQuestions: string[]) {
    await update(patientId, (b) => {
      const now = new Date().toISOString();
      const checkIn: CheckIn = { ...c, id: uid() };
      const patient = {
        ...b.patient,
        checkIns: [...b.patient.checkIns, checkIn],
        planChanges: c.answered ? b.patient.planChanges.map((x) => (x.deliveredAt ? x : { ...x, deliveredAt: now })) : b.patient.planChanges,
      };
      const alerts = alertsForCheckIn({ ...patient, id: patientId }, checkIn).map((a) => ({ ...a, id: uid() }));
      const questions = b.questions.map((q) => (c.answered && q.answer && !q.deliveredAt ? { ...q, deliveredAt: now } : q));
      for (const text of newQuestions) questions.push({ id: uid(), patientId, text, askedAt: now });
      return { patient, questions, alerts: [...alerts, ...b.alerts] };
    });
  },
  async raiseAlert(patientId: string, message: string) {
    await update(patientId, (b) => {
      const p = b.patient;
      const notified = p.contacts.filter((x) => x.kind === "care" || p.sharedWith.includes(x.id)).map((x) => x.name);
      return { ...b, alerts: [{ id: uid(), patientId, at: new Date().toISOString(), level: "urgent", message, notified }, ...b.alerts] };
    });
  },
  /** Short call: Rosie only greets and asks the care team's questions for this patient. */
  async setShortCall(patientId: string, on: boolean) {
    await update(patientId, (b) => ({ ...b, patient: { ...b.patient, shortCall: on } }));
  },
  /** Clinician picks up an alert ("On it"); family see who is handling it. */
  async markOnIt(patientId: string, id: string, by: string) {
    await update(patientId, (b) => ({ ...b, alerts: b.alerts.map((a) => (a.id === id ? { ...a, onItBy: by, onItAt: new Date().toISOString() } : a)) }));
  },
  /** Checking an alert off needs a note saying how the situation was resolved. */
  async acknowledgeAlert(patientId: string, id: string, resolution: string, by: string) {
    const note = resolution.trim();
    if (!note) throw new Error("Write how the situation was resolved before marking it handled.");
    await update(patientId, (b) => ({
      ...b,
      alerts: b.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, resolution: note, resolvedBy: by, resolvedAt: new Date().toISOString() } : a,
      ),
    }));
  },
  async answerQuestion(patientId: string, id: string, answer: string, by: string) {
    await update(patientId, (b) => ({
      ...b,
      questions: b.questions.map((q) => (q.id === id ? { ...q, answer, answeredBy: by, answeredAt: new Date().toISOString() } : q)),
    }));
  },
  async addPlanChange(patientId: string, text: string, planItems: string[]) {
    await update(patientId, (b) => ({
      ...b,
      patient: { ...b.patient, planItems, planChanges: [...b.patient.planChanges, { id: uid(), text, createdAt: new Date().toISOString() }] },
    }));
  },
  async setShared(patientId: string, contactId: string, shared: boolean) {
    await update(patientId, (b) => ({
      ...b,
      patient: {
        ...b.patient,
        sharedWith: shared ? [...new Set([...b.patient.sharedWith, contactId])] : b.patient.sharedWith.filter((x) => x !== contactId),
      },
    }));
  },
};
