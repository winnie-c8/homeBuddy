import { useSyncExternalStore } from "react";
import { alertsForCheckIn, createSampleState, type CareState, type CheckIn } from "./care";

// Demo store kept in the browser until real accounts and saved data are added.
const KEY = "hearthline-demo-v1";
let state: CareState | null = null;
const listeners = new Set<() => void>();

function load(): CareState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw) as CareState) : createSampleState();
  } catch {
    state = createSampleState();
  }
  return state;
}

function set(updater: (s: CareState) => CareState) {
  state = updater(load());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked */
  }
  listeners.forEach((l) => l());
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function useCare(): CareState | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => load(),
    () => null,
  );
}

export const care = {
  reset() {
    set(() => createSampleState());
  },
  addCheckIn(patientId: string, c: Omit<CheckIn, "id">, newQuestions: string[]) {
    set((s) => {
      const now = new Date().toISOString();
      const checkIn: CheckIn = { ...c, id: uid() };
      const patients = s.patients.map((p) =>
        p.id !== patientId
          ? p
          : {
              ...p,
              checkIns: [...p.checkIns, checkIn],
              planChanges: c.answered ? p.planChanges.map((x) => (x.deliveredAt ? x : { ...x, deliveredAt: now })) : p.planChanges,
            },
      );
      const patient = patients.find((p) => p.id === patientId)!;
      const alerts = alertsForCheckIn(patient, checkIn).map((a) => ({ ...a, id: uid() }));
      const questions = s.questions.map((q) =>
        c.answered && q.patientId === patientId && q.answer && !q.deliveredAt ? { ...q, deliveredAt: now } : q,
      );
      for (const text of newQuestions) questions.push({ id: uid(), patientId, text, askedAt: now });
      return { patients, questions, alerts: [...alerts, ...s.alerts] };
    });
  },
  raiseAlert(patientId: string, message: string) {
    set((s) => {
      const p = s.patients.find((x) => x.id === patientId)!;
      const notified = p.contacts.filter((x) => x.kind === "care" || p.sharedWith.includes(x.id)).map((x) => x.name);
      return { ...s, alerts: [{ id: uid(), patientId, at: new Date().toISOString(), level: "urgent", message, notified }, ...s.alerts] };
    });
  },
  acknowledgeAlert(id: string) {
    set((s) => ({ ...s, alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) }));
  },
  answerQuestion(id: string, answer: string, by: string) {
    set((s) => ({
      ...s,
      questions: s.questions.map((q) => (q.id === id ? { ...q, answer, answeredBy: by, answeredAt: new Date().toISOString() } : q)),
    }));
  },
  addPlanChange(patientId: string, text: string, planItems: string[]) {
    set((s) => ({
      ...s,
      patients: s.patients.map((p) =>
        p.id === patientId
          ? { ...p, planItems, planChanges: [...p.planChanges, { id: uid(), text, createdAt: new Date().toISOString() }] }
          : p,
      ),
    }));
  },
  setShared(patientId: string, contactId: string, shared: boolean) {
    set((s) => ({
      ...s,
      patients: s.patients.map((p) =>
        p.id === patientId
          ? { ...p, sharedWith: shared ? [...new Set([...p.sharedWith, contactId])] : p.sharedWith.filter((x) => x !== contactId) }
          : p,
      ),
    }));
  },
};
