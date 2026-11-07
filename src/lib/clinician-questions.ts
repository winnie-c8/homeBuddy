import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { refreshCare } from "./care-store";
import type { FlagIf, Patient } from "./care";

/**
 * Questions the care team wants Rosie to ask on the next call.
 * Stored inside patients.state.patient.clinicianQuestions so existing care-store saves keep them
 * (care-store spreads the patient object). Kept out of care.ts / care-store.ts on purpose.
 */
export type ClinicianQuestion = {
  id: string;
  text: string;
  askedBy: string;
  createdAt: string;
  /** Flag the day when the answer is this (rule checked in care.ts). No rule = just record the answer. */
  flagIf?: FlagIf;
  /** Turns red when flagged this many times in a row (1 = right away). Missing = never turns red. */
  redAfter?: number;
  /** Ask on every call instead of once. */
  daily?: boolean;
  /** One-off questions: set once answered, and the question is done. Daily questions keep the latest answer here too. */
  answer?: string;
  answeredAt?: string;
};

export type ClinicianAnswer = { question: string; said: string };

export function clinicianQuestionsOf(p: Patient): ClinicianQuestion[] {
  return ((p as Patient & { clinicianQuestions?: ClinicianQuestion[] }).clinicianQuestions ?? []).slice();
}

export function pendingClinicianQuestions(p: Patient): ClinicianQuestion[] {
  return clinicianQuestionsOf(p).filter((q) => q.daily || !q.answer);
}

/** Extra lines for Rosie's call context. */
export function clinicianContext(p: Patient): string {
  const pending = pendingClinicianQuestions(p);
  if (!pending.length) return "";
  return `Questions from the care team to ask today — weave each in naturally ("Oh, your care team wanted me to ask…"), but ask it plainly and get a clear answer:\n- ${pending
    .map((q) => `${q.text} (from ${q.askedBy}; get a clear yes or no)`)
    .join("\n- ")}`;
}

/** Match summary answers back to the pending questions (exact text, then loose match). */
export function applyAnswers(list: ClinicianQuestion[], answers: ClinicianAnswer[], now: string): ClinicianQuestion[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  return list.map((q) => {
    if (q.answer && !q.daily) return q;
    const hit = answers.find((a) => norm(a.question) === norm(q.text)) ?? answers.find((a) => norm(a.question).includes(norm(q.text)) || norm(q.text).includes(norm(a.question)));
    return hit && hit.said.trim() ? { ...q, answer: hit.said.trim(), answeredAt: now } : q;
  });
}

async function updateList(patientId: string, fn: (l: ClinicianQuestion[]) => ClinicianQuestion[]) {
  const { data, error } = await supabase.from("patients").select("state").eq("id", patientId).single();
  if (error) throw error;
  const state = data.state as unknown as { patient: Record<string, unknown> };
  const list = (state.patient["clinicianQuestions"] as ClinicianQuestion[] | undefined) ?? [];
  const next = { ...state, patient: { ...state.patient, clinicianQuestions: fn(list) } };
  const { error: saveError } = await supabase.from("patients").update({ state: next as unknown as Json }).eq("id", patientId);
  if (saveError) throw saveError;
  await refreshCare();
}

export const clinicianQuestions = {
  add: (patientId: string, text: string, askedBy: string, rule: { flagIf?: FlagIf | undefined; daily?: boolean; redAfter?: number | undefined } = {}) =>
    updateList(patientId, (l) => [
      ...l,
      { id: Math.random().toString(36).slice(2, 10), text, askedBy, createdAt: new Date().toISOString(), ...(rule.flagIf ? { flagIf: rule.flagIf } : {}), ...(rule.daily ? { daily: true } : {}), ...(rule.flagIf && rule.redAfter ? { redAfter: rule.redAfter } : {}) },
    ]),
  remove: (patientId: string, id: string) => updateList(patientId, (l) => l.filter((q) => q.id !== id)),
  saveAnswers: (patientId: string, answers: ClinicianAnswer[]) =>
    updateList(patientId, (l) => applyAnswers(l, answers, new Date().toISOString())),
};
