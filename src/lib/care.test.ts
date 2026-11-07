import { describe, expect, it } from "vitest";
import { alertsForCheckIn, checkAnswers, detectUrgent, checkInStatus, createSampleState, isAnswerFlagged, type CheckIn } from "./care";

const ok: CheckIn = {
  id: "x", date: new Date().toISOString(), answered: true, meds: [{ name: "Metformin", taken: "yes" }],
  meals: 3, fluids: "good", sleepHours: 7, mood: 4, pain: 1, fall: false, urgent: [], summary: "", source: "sample",
};

describe("check-in status", () => {
  it("is green when everything is on track", () => expect(checkInStatus(ok)).toBe("green"));
  it("is red when the senior does not answer", () => expect(checkInStatus({ ...ok, answered: false })).toBe("red"));
  it("is red after a fall", () => expect(checkInStatus({ ...ok, fall: true })).toBe("red"));
  it("is red when chest pain is mentioned", () => expect(checkInStatus({ ...ok, urgent: ["chest pain"] })).toBe("red"));
  it("is yellow after a missed dose", () =>
    expect(checkInStatus({ ...ok, meds: [{ name: "Metformin", taken: "no" }] })).toBe("yellow"));
});

describe("alerts", () => {
  const p = createSampleState().patients.find((x) => x.id === "margaret")!;
  it("alerts shared family and care team on a missed call", () => {
    const a = alertsForCheckIn(p, { ...ok, answered: false })[0]!;
    expect(a.level).toBe("urgent");
    expect(a.notified).toEqual(expect.arrayContaining(["Daniel Thompson", "Dr. Anjali Patel"]));
  });
  it("does not alert family the senior has not shared with", () => {
    const a = alertsForCheckIn({ ...p, sharedWith: ["dr-patel"] }, { ...ok, fall: true })[0]!;
    expect(a.notified).not.toContain("Daniel Thompson");
  });
  it("raises a warning for a missed dose", () => {
    const a = alertsForCheckIn(p, { ...ok, meds: [{ name: "Metformin", taken: "no" }] })[0]!;
    expect(a.level).toBe("warning");
  });
});

describe("detectUrgent whole words", () => {
  it("does not flag 'fellow' as a fall", () => {
    expect(detectUrgent("I'm a fellow being")).toEqual([]);
  });
  it("still flags 'I fell'", () => {
    expect(detectUrgent("I fell this morning")).toEqual(["fell"]);
  });
});

import { callContext as _ctx, followUps as _fu, greetingFor as _greet, createSampleState as _seed } from "./care";

describe("daily call context", () => {
  it("greets by local time of day", () => {
    expect(_greet(new Date(2026, 0, 1, 9))).toBe("Good morning");
    expect(_greet(new Date(2026, 0, 1, 14))).toBe("Good afternoon");
    expect(_greet(new Date(2026, 0, 1, 19))).toBe("Good evening");
  });
  it("follows up on yesterday's headache", () => {
    const now = new Date(2026, 0, 2, 10);
    const p = { ..._seed().patients[0], checkIns: [] as never[] } as ReturnType<typeof _seed>["patients"][0];
    p.checkIns = [{ id: "x", date: new Date(2026, 0, 1, 10).toISOString(), answered: true, meds: [], meals: 2, fluids: "good",
      sleepHours: 7, mood: 4, pain: 5, fall: false, urgent: [], summary: "My head hurts.", source: "voice" }];
    expect(_fu(p, now)[0]).toMatch(/^Yesterday: pain 5\/10/);
    expect(_ctx(p, [], now)).toContain("My head hurts.");
    expect(_ctx(p, [], now)).toContain("Good morning");
  });
});

describe("care team question rules", () => {
  it("flags only the answer the rule names", () => {
    expect(isAnswerFlagged("no", "no")).toBe(true);
    expect(isAnswerFlagged("yes", "no")).toBe(false);
    expect(isAnswerFlagged("yes", "yes")).toBe(true);
  });
  it("flags unclear answers when there is a rule", () => expect(isAnswerFlagged("unclear", "no")).toBe(true));
  it("never flags a question without a rule", () => {
    expect(isAnswerFlagged("no", undefined)).toBe(false);
    expect(isAnswerFlagged("unclear", undefined)).toBe(false);
  });

  const asked = [{ text: "Did you do your dialysis today?", flagIf: "no" as const }, { text: "How was lunch?" }];
  it("matches answers to questions and keeps the senior's words", () => {
    const [dialysis, lunch] = checkAnswers(asked, [
      { question: "did you do your dialysis today", said: "No, I skipped it", answer: "no" },
      { question: "How was lunch?", said: "Lovely soup", answer: "unclear" },
    ]);
    expect(dialysis).toMatchObject({ answer: "no", said: "No, I skipped it", flagged: true });
    expect(lunch).toMatchObject({ said: "Lovely soup", flagged: false });
  });
  it("treats a question the AI did not report as unclear", () => {
    expect(checkAnswers(asked, [])[0]).toMatchObject({ answer: "unclear", said: "", flagged: true });
  });
  it("treats an answer with no words as unclear, even if the AI said yes", () => {
    expect(checkAnswers(asked, [{ question: asked[0]!.text, said: " ", answer: "yes" }])[0]!.flagged).toBe(true);
  });
  it("gives the same result every time", () => {
    const heard = [{ question: asked[0]!.text, said: "Yes, this morning", answer: "yes" as const }];
    expect(checkAnswers(asked, heard)).toEqual(checkAnswers(asked, heard));
  });

  const flagged = checkAnswers(asked, [{ question: asked[0]!.text, said: "No, I skipped it", answer: "no" }]);
  it("turns the day yellow", () => expect(checkInStatus({ ...ok, answers: flagged })).toBe("yellow"));
  it("stays green when answers are fine", () =>
    expect(checkInStatus({ ...ok, answers: checkAnswers(asked, [{ question: asked[0]!.text, said: "Yes", answer: "yes" }]) })).toBe("green"));
  it("raises a warning that quotes the senior", () => {
    const p = createSampleState().patients.find((x) => x.id === "margaret")!;
    const a = alertsForCheckIn(p, { ...ok, answers: flagged }).find((x) => x.message.includes("dialysis"))!;
    expect(a.level).toBe("warning");
    expect(a.message).toContain('"No, I skipped it"');
  });
});
