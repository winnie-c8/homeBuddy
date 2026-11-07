import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => vi.unstubAllGlobals());

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
