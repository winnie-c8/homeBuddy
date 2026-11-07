import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("./care-store", () => ({ refreshCare: vi.fn() }));
import { applyAnswers } from "./clinician-questions";

describe("clinician question answers", () => {
  const list = [{ id: "a", text: "Has your ankle swelling gone down?", askedBy: "Dr. Test", createdAt: "2026-01-01" }];
  it("stores the senior's answer on the matching question", () => {
    const out = applyAnswers(list, [{ question: "Has your ankle swelling gone down?", said: "Yes, mostly" }], "now");
    expect(out[0].answer).toBe("Yes, mostly");
  });
  it("leaves the question pending when Rosie did not get an answer", () => {
    const out = applyAnswers(list, [{ question: "Has your ankle swelling gone down?", said: "" }], "now");
    expect(out[0].answer).toBeUndefined();
  });
});
