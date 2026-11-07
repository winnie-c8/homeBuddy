import { describe, expect, it } from "vitest";
import { SHORT_CALL_MARKER, callContext, alertStage, alertsForCheckIn, saidMoreThanYesNo, escalations, questionHistory, isNumberFlagged, checkAnswers, detectUrgent, checkInStatus, createSampleState, findings, followUpForFamily, isAnswerFlagged, patientStatus, sortAlertsForClinician, waitingFor, type Alert, type CheckIn } from "./care";

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

describe("yellow that keeps happening turns red (#10)", () => {
  const p = { ...createSampleState().patients.find((x) => x.id === "margaret")!, checkIns: [] as CheckIn[] };
  const day = (d: number, change: Partial<CheckIn>, id = `d${d}`): CheckIn => ({ ...ok, id, date: new Date(2026, 10, d, 10).toISOString(), ...change });
  const dialysis = (d: number, answer: "yes" | "no", redAfter?: number) =>
    day(d, { answers: checkAnswers([{ text: "Did you do your dialysis today?", flagIf: "no", redAfter }], [{ question: "Did you do your dialysis today?", said: answer, answer }]) });

  it("low mood on 3 days in a row is red", () => {
    const pp = { ...p, checkIns: [day(5, { mood: 1 }), day(6, { mood: 2 }), day(7, { mood: 1 })] };
    expect(escalations(pp).map((f) => f.clinician)).toEqual(["Low mood 3 days in a row"]);
    expect(patientStatus(pp)).toBe("red");
  });
  it("2 days, or 3 days with a gap, stays yellow", () => {
    expect(patientStatus({ ...p, checkIns: [day(6, { mood: 1 }), day(7, { mood: 1 })] })).toBe("yellow");
    expect(patientStatus({ ...p, checkIns: [day(4, { mood: 1 }), day(5, { mood: 1 }), day(7, { mood: 1 })] })).toBe("yellow");
  });
  it("different reasons on different days don't add up", () =>
    expect(patientStatus({ ...p, checkIns: [day(5, { mood: 1 }), day(6, { sleepHours: 4 }), day(7, { meals: 1 })] })).toBe("yellow"));
  it("a question set to 'right away' is red on the first flag", () => {
    const c = dialysis(7, "no", 1);
    expect(checkInStatus(c)).toBe("red");
    expect(findings(c)[0]!.status).toBe("red");
  });
  it("a question set to 'after 3' turns red on the third flag in a row", () => {
    const two = { ...p, checkIns: [dialysis(5, "no", 3), dialysis(6, "no", 3)] };
    expect(patientStatus(two)).toBe("yellow");
    const three = { ...p, checkIns: [...two.checkIns, dialysis(7, "no", 3)] };
    expect(patientStatus(three)).toBe("red");
    expect(escalations(three)[0]!.clinician).toBe('"Did you do your dialysis today?" flagged 3 days in a row (last answer: no)');
  });
  it("a fine answer resets the count", () =>
    expect(patientStatus({ ...p, checkIns: [dialysis(4, "no", 3), dialysis(5, "yes", 3), dialysis(6, "no", 3), dialysis(7, "no", 3)] })).toBe("yellow"));
  it("a question with no 'turns red' never escalates", () =>
    expect(escalations({ ...p, checkIns: [dialysis(5, "no"), dialysis(6, "no"), dialysis(7, "no")] })).toEqual([]));
  it("raises the red alert with the latest check-in", () => {
    const pp = { ...p, checkIns: [day(5, { mood: 1 }), day(6, { mood: 1 }), day(7, { mood: 1 })] };
    const a = alertsForCheckIn(pp, pp.checkIns[2]!);
    expect(a.find((x) => x.key === "mood_low_streak")).toMatchObject({ level: "urgent", family: `${p.preferredName} has had low mood 3 days in a row` });
  });
  it("lists a question's answers oldest first for the chart", () =>
    expect(questionHistory({ ...p, checkIns: [dialysis(6, "no"), dialysis(5, "yes")] }, "Did you do your dialysis today?").map((x) => x.answer)).toEqual(["yes", "no"]));
});

describe("number questions", () => {
  const water = { text: "How many glasses of water today?", kind: "number" as const, unit: "glasses", below: 6 };
  const heard = (said: string, number: number | null) => [{ question: water.text, said, answer: "unclear" as const, number }];
  it("flags below the limit and keeps the amount", () => {
    const [a] = checkAnswers([water], heard("About four", 4));
    expect(a).toMatchObject({ value: 4, flagged: true });
    expect(findings({ ...ok, answers: [a!] })[0]!.clinician).toBe('4 glasses for "How many glasses of water today?" (flag below 6). They said: "About four"');
  });
  it("doesn't flag at or above the limit", () => expect(checkAnswers([water], heard("Six", 6))[0]!.flagged).toBe(false));
  it("flags above an upper limit", () => expect(isNumberFlagged(160, undefined, 140)).toBe(true));
  it("no number heard counts as unclear and is flagged", () =>
    expect(checkAnswers([water], heard("I don't know", null))[0]).toMatchObject({ value: null, answer: "unclear", flagged: true }));
  it("no limits means just record it", () => expect(isNumberFlagged(null)).toBe(false));
  it("turns red after N low days in a row", () => {
    const p = { ...createSampleState().patients.find((x) => x.id === "margaret")!, checkIns: [] as CheckIn[] };
    const day = (d: number, n: number): CheckIn => ({ ...ok, id: `w${d}`, date: new Date(2026, 10, d, 10).toISOString(), answers: checkAnswers([{ ...water, redAfter: 2 }], heard(String(n), n)) });
    expect(escalations({ ...p, checkIns: [day(6, 3), day(7, 4)] })[0]!.clinician).toBe('"How many glasses of water today?" flagged 2 days in a row (last answer: 4 glasses)');
  });
});

describe("short calls", () => {
  it("meals not asked (null) is not flagged as eating less", () => expect(findings({ ...ok, meals: null })).toEqual([]));
  it("0 meals reported is still flagged", () => expect(findings({ ...ok, meals: 0 }).map((f) => f.key)).toEqual(["meals_low"]));
});

describe("short call setting", () => {
  const p = createSampleState().patients.find((x) => x.id === "margaret")!;
  it("is off by default: full call notes", () => expect(callContext(p, [])).not.toContain(SHORT_CALL_MARKER));
  it("marks short-call patients for the voice relay", () => expect(callContext({ ...p, shortCall: true }, []).split("\n")[0]).toBe(SHORT_CALL_MARKER));
});
