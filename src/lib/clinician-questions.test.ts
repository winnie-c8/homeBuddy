import { describe, expect, it } from "vitest";
import { frequencyLabel, isDue, type ClinicianQuestion } from "./clinician-questions";

const q = (extra: Partial<ClinicianQuestion>): ClinicianQuestion => ({ id: "q", text: "Did you do your dialysis today?", askedBy: "Dr", createdAt: "2026-11-01T10:00:00.000Z", ...extra });
const now = new Date(2026, 10, 7, 12);
const daysAgo = (n: number) => new Date(2026, 10, 7 - n, 9).toISOString();

describe("how often a question is asked", () => {
  it("once: until it's answered", () => {
    expect(isDue(q({}), now)).toBe(true);
    expect(isDue(q({ answer: "No", answeredAt: daysAgo(1) }), now)).toBe(false);
  });
  it("every day (1): every call, even twice in one day", () => expect(isDue(q({ everyDays: 1, answer: "No", answeredAt: daysAgo(0) }), now)).toBe(true));
  it("the old 'daily' flag still means every day", () => expect(isDue(q({ daily: true, answer: "No", answeredAt: daysAgo(0) }), now)).toBe(true));
  it("every 3 days: waits 3 calendar days after the last answer", () => {
    expect(isDue(q({ everyDays: 3, answer: "Yes", answeredAt: daysAgo(2) }), now)).toBe(false);
    expect(isDue(q({ everyDays: 3, answer: "Yes", answeredAt: daysAgo(3) }), now)).toBe(true);
    expect(isDue(q({ everyDays: 3 }), now)).toBe(true);
  });
  it("labels the frequency", () => {
    expect(frequencyLabel(q({}))).toBe("Once");
    expect(frequencyLabel(q({ everyDays: 1 }))).toBe("Every day");
    expect(frequencyLabel(q({ everyDays: 3 }))).toBe("Every 3 days");
  });
});
