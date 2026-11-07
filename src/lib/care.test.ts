import { describe, expect, it } from "vitest";
import { alertsForCheckIn, detectUrgent, checkInStatus, createSampleState, type CheckIn } from "./care";

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
