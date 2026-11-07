import { describe, expect, it } from "vitest";
import { settledContext } from "./call-memory";
import type { Patient, Question } from "./care";

const p = { id: "p1", planChanges: [] } as unknown as Patient;
const now = new Date("2026-11-07T15:00:00Z");
const q = (o: Partial<Question>): Question => ({ id: "q", patientId: "p1", text: "Can I skip my pill?", askedAt: "2026-11-04T10:00:00Z", answer: "No, keep taking it", ...o });

describe("settledContext", () => {
  it("lists an answer delivered on a previous call as settled", () => {
    expect(settledContext(p, [q({ deliveredAt: "2026-11-06T10:00:00Z" })], now)).toContain("Can I skip my pill?");
  });
  it("leaves out answers not yet delivered (those are still shared)", () => {
    expect(settledContext(p, [q({})], now)).toBe("");
  });
  it("leaves out answers delivered more than 7 days ago", () => {
    expect(settledContext(p, [q({ deliveredAt: "2026-10-25T10:00:00Z" })], now)).toBe("");
  });
});
