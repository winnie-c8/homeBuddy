import { describe, expect, it } from "vitest";
import { alertStage, alertsForCheckIn, saidMoreThanYesNo, checkAnswers, detectUrgent, checkInStatus, createSampleState, findings, followUpForFamily, isAnswerFlagged, patientStatus, sortAlertsForClinician, waitingFor, type Alert, type CheckIn } from "./care";

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

describe("every flag has a reason (#6)", () => {
  const keys = (c: CheckIn) => findings(c).map((f) => `${f.key}:${f.status}`);
  it("finds nothing on a good day", () => expect(findings(ok)).toEqual([]));
  it.each([
    [{ mood: 1 }, "mood_low:yellow", "Mood 1/5 (low)"],
    [{ sleepHours: 4 }, "sleep_short:yellow", "Slept 4 h (under 5 h)"],
    [{ meals: 1 }, "meals_low:yellow", "1 meal so far (under 2)"],
    [{ fluids: "low" as const }, "fluids_low:yellow", "Low fluids"],
    [{ pain: 5 }, "pain:yellow", "Pain 5/10"],
    [{ pain: 8 }, "pain_high:red", "Pain 8/10 (severe)"],
    [{ fall: true }, "fall:red", "Reported a fall"],
    [{ urgent: ["chest pain"] }, "urgent:red", "Mentioned chest pain"],
    [{ meds: [{ name: "Metformin", taken: "no" as const }] }, "med_missed:yellow", "Missed dose: Metformin"],
    [{ meds: [{ name: "Metformin", taken: "unclear" as const }] }, "med_unclear:yellow", "Couldn't confirm dose: Metformin"],
  ])("%o gives %s", (change, key, text) => {
    const c = { ...ok, ...change };
    expect(keys(c)).toEqual([key]);
    expect(findings(c)[0]!.clinician).toBe(text);
  });
  it("a missed call is only that one red reason", () => expect(keys({ ...ok, answered: false, mood: 1 })).toEqual(["no_answer:red"]));
  it("lists several reasons at once", () => expect(keys({ ...ok, mood: 2, sleepHours: 4 })).toEqual(["mood_low:yellow", "sleep_short:yellow"]));
  it("keeps the thresholds exact (mood 3, 5 h sleep, 2 meals, pain 3 are fine)", () =>
    expect(findings({ ...ok, mood: 3, sleepHours: 5, meals: 2, pain: 3 })).toEqual([]));

  it("creates one alert per reason, with plain words for family", () => {
    const p = createSampleState().patients.find((x) => x.id === "margaret")!;
    const a = alertsForCheckIn(p, { ...ok, mood: 1, sleepHours: 4 });
    expect(a.map((x) => x.message)).toEqual(["Mood 1/5 (low)", "Slept 4 h (under 5 h)"]);
    expect(a[0]!.family).toBe(`${p.preferredName}'s mood is low today`);
    expect(a[0]!.level).toBe("warning");
    expect(a[0]!.key).toBe("mood_low");
  });
});

describe("a day takes its worst colour (#6)", () => {
  const p = createSampleState().patients.find((x) => x.id === "margaret")!;
  const at = (h: number) => new Date(2026, 10, 7, h).toISOString();
  it("a fall in the morning stays red after a fine afternoon call", () => {
    const checkIns = [{ ...ok, id: "a", date: at(9), fall: true }, { ...ok, id: "b", date: at(14) }];
    expect(patientStatus({ ...p, checkIns })).toBe("red");
  });
  it("only the latest day counts, not earlier days", () => {
    const checkIns = [{ ...ok, id: "a", date: new Date(2026, 10, 6, 9).toISOString(), fall: true }, { ...ok, id: "b", date: at(9) }];
    expect(patientStatus({ ...p, checkIns })).toBe("green");
  });
  it("is yellow when there are no check-ins yet", () => expect(patientStatus({ ...p, checkIns: [] })).toBe("yellow"));
});

describe("follow-up (#7)", () => {
  const base: Alert = { id: "a", patientId: "p", at: "2026-11-07T12:00:00.000Z", level: "warning", message: "Mood 1/5 (low)", notified: [] };
  it("starts as new and tells family the care team knows", () => {
    expect(alertStage(base)).toBe("new");
    expect(followUpForFamily(base)).toBe("The care team has been told");
  });
  it("on it shows who is handling it", () => {
    const a = { ...base, onItBy: "Dr. Patel", onItAt: base.at };
    expect(alertStage(a)).toBe("on_it");
    expect(followUpForFamily(a)).toBe("Dr. Patel is on it");
  });
  it("resolved shows the note to family", () => {
    const a = { ...base, onItBy: "Dr. Patel", acknowledged: true, resolution: "Called, booked dialysis tomorrow", resolvedBy: "Dr. Patel", resolvedAt: base.at };
    expect(alertStage(a)).toBe("resolved");
    expect(followUpForFamily(a)).toBe("Resolved by Dr. Patel: Called, booked dialysis tomorrow");
  });
  it("treats the old 'Mark handled' as resolved", () => expect(alertStage({ ...base, acknowledged: true })).toBe("resolved"));
  it("shows how long an alert has waited", () => {
    expect(waitingFor(base, new Date("2026-11-07T12:25:00.000Z"))).toBe("25 min");
    expect(waitingFor(base, new Date("2026-11-07T15:00:00.000Z"))).toBe("3 h");
    expect(waitingFor(base, new Date("2026-11-10T12:00:00.000Z"))).toBe("3 days");
  });
  it("puts red first, then the longest-waiting", () => {
    const list = [
      { ...base, id: "y-new", at: "2026-11-07T14:00:00.000Z" },
      { ...base, id: "r", level: "urgent" as const, at: "2026-11-07T15:00:00.000Z" },
      { ...base, id: "y-old", at: "2026-11-07T09:00:00.000Z" },
    ];
    expect(sortAlertsForClinician(list).map((a) => a.id)).toEqual(["r", "y-old", "y-new"]);
  });
});

describe("clinician question wording", () => {
  const p = createSampleState().patients.find((x) => x.id === "margaret")!;
  const q = "Did you do your dialysis today?";
  const msg = (said: string, answer: "yes" | "no" | "unclear") =>
    alertsForCheckIn(p, { ...ok, answers: checkAnswers([{ text: q, flagIf: "no" }], [{ question: q, said, answer }]) }).find((a) => a.key?.startsWith("question:"))!;
  it("a bare 'No.' isn't repeated as a quote", () => {
    expect(msg("No.", "no").message).toBe(`Answered no to "${q}"`);
    expect(msg("No.", "no").family).toBe(`${p.preferredName} answered no to "${q}"`);
  });
  it("quotes the senior when they said more", () =>
    expect(msg("No, I skipped it today.", "no").message).toBe(`Answered no to "${q}". They said: "No, I skipped it today."`));
  it("unclear answers read naturally", () => {
    expect(msg("I think so, maybe", "unclear").message).toBe(`No clear answer to "${q}". They said: "I think so, maybe"`);
    expect(msg("", "unclear").family).toBe(`We couldn't get a clear answer from ${p.preferredName} about "${q}"`);
  });
  it("knows a plain yes/no from a real answer", () => {
    expect(saidMoreThanYesNo("Nope!")).toBe(false);
    expect(saidMoreThanYesNo("No, I didn't")).toBe(false);
    expect(saidMoreThanYesNo("No, the clinic was closed")).toBe(true);
  });
});
