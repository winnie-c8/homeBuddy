import type { Patient, Question } from "./care";

/**
 * Care-team messages Rosie already delivered on an earlier call (last `days` days).
 * Rosie gets these as "settled" so the next call doesn't bring the same issue up again.
 * Read-only: it never changes the record.
 */
export function settledContext(p: Patient, questions: Question[], now: Date = new Date(), days = 7): string {
  const since = now.getTime() - days * 86400000;
  const recent = (iso?: string) => !!iso && new Date(iso).getTime() >= since && new Date(iso).getTime() <= now.getTime();
  const items = [
    ...questions
      .filter((q) => q.patientId === p.id && q.answer && recent(q.deliveredAt))
      .map((q) => `They asked "${q.text}" and were already told: ${q.answer}`),
    ...p.planChanges.filter((c) => recent(c.deliveredAt)).map((c) => `Care plan change already explained: ${c.text}`),
  ];
  if (!items.length) return "";
  return `Already answered on an earlier call — do NOT bring these up again, re-share them, or re-ask about the same issue. Skip any recent-call follow-up about these same topics. Only discuss one if they raise it themselves:\n- ${items.join("\n- ")}`;
}
