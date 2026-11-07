import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSummary, type CheckInSummary } from "./checkin.functions";

const SUMMARY: CheckInSummary = {
  meds: [{ name: "metformin", taken: "yes" }],
  meals: 1,
  fluids: "good",
  sleepHours: 6,
  mood: 4,
  pain: 0,
  fall: false,
  urgent: [],
  questions: [],
  answers: [{ question: "Is your ankle swelling better?", said: "No, it's worse today", answer: "no", number: null }],
  summary: "Margaret took her metformin and ate breakfast.",
};

const responseFor = (body: unknown, ok = true, status = 200) =>
  new Response(ok ? JSON.stringify(body) : "busy", {
    status,
    headers: { "content-type": "application/json" },
  });

const okResponse = () =>
  responseFor({ candidates: [{ content: { parts: [{ text: JSON.stringify(SUMMARY) }] } }] });

const DATA = {
  transcript: [{ role: "user" as const, text: "I took my metformin and had oatmeal." }],
  meds: ["metformin"],
};

// Tests use a fake key; the real one only exists on Lovable's server.
beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "test"));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("runSummary model fallback", () => {
  it("uses the fast model first so the call saves quickly", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return okResponse();
      }),
    );

    const result = await runSummary(DATA);

    expect(result.summary).toBe(SUMMARY.summary);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("/models/gemini-flash-lite-latest:generateContent");
  });

  it("moves to the next model when the fast one is busy", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        return calls.length === 1 ? responseFor({}, false, 503) : okResponse();
      }),
    );

    const result = await runSummary(DATA);

    expect(result.summary).toBe(SUMMARY.summary);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("/models/gemini-3.5-flash:generateContent");
  });

  it("throws when every model fails so the caller can still save the call", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => responseFor({}, false, 503)));

    await expect(runSummary(DATA)).rejects.toThrow("Summary service failed");
  });
});

describe("care-team answers", () => {
  it("returns each answer with the senior's words and a yes/no answer", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okResponse()));
    const result = await runSummary({ ...DATA, clinicianQuestions: ["Is your ankle swelling better?"] });
    expect(result.answers).toEqual([{ question: "Is your ankle swelling better?", said: "No, it's worse today", answer: "no", number: null }]);
  });

  it("sends the care-team questions to the summary model", async () => {
    let body = "";
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: RequestInit) => { body = String(init.body); return okResponse(); }));
    await runSummary({ ...DATA, clinicianQuestions: ["Is your ankle swelling better?"] });
    expect(body).toContain("Is your ankle swelling better?");
    expect(body).toContain('"unclear"');
  });

  it("defaults to no answers when the model leaves the field out", async () => {
    const { answers: _drop, ...rest } = SUMMARY;
    vi.stubGlobal("fetch", vi.fn(async () => responseFor({ candidates: [{ content: { parts: [{ text: JSON.stringify(rest) }] } }] })));
    expect((await runSummary(DATA)).answers).toEqual([]);
  });
});
