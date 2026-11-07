import { beforeEach, describe, expect, it, vi } from "vitest";

/** Fake database: one patient with one open alert. */
const db = vi.hoisted(() => ({ rows: [] as any[] }));

const seed = () => ({
  id: "p1",
  senior_user_id: "u1",
  invite_code: "ABC123",
  state: {
    patient: { id: "p1", name: "Test Patient", checkIns: [], planChanges: [], contacts: [], sharedWith: [] },
    questions: [],
    alerts: [
      { id: "a1", patientId: "p1", at: "2026-01-01T00:00:00.000Z", level: "warning", message: "Missed a dose", notified: ["Dr. Test"] },
      { id: "a2", patientId: "p1", at: "2026-01-01T01:00:00.000Z", level: "urgent", message: "Fall reported", notified: ["Dr. Test"] },
    ],
  },
});

function thenable<T>(make: () => T) {
  return { then: (r: any, j: any) => Promise.resolve(make()).then(r, j) };
}

function query(op: "select" | "update", payload?: any) {
  const self: any = {
    eq: () => self,
    single: () => thenable(() => ({ data: db.rows[0], error: null })),
    then: (r: any, j: any) => Promise.resolve(result()).then(r, j),
  };
  function result() {
    if (op === "update") {
      db.rows = [{ ...db.rows[0], state: payload.state }];
      return { error: null };
    }
    return { data: db.rows, error: null };
  }
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => query("select"), update: (p: any) => query("update", p) }) },
}));

import { care } from "./care-store";

const alertOf = (id: string) => db.rows[0].state.alerts.find((a: any) => a.id === id);

beforeEach(() => {
  db.rows = [seed()];
});

describe("marking an alert handled", () => {
  it("refuses to check the alert off without a resolution note", async () => {
    await expect(care.acknowledgeAlert("p1", "a1", "   ", "Dr. Test")).rejects.toThrow(/resolved/i);
    expect(alertOf("a1").acknowledged).toBeUndefined();
    expect(alertOf("a1").resolution).toBeUndefined();
  });

  it("saves the note, the person and the time when a note is given", async () => {
    await care.acknowledgeAlert("p1", "a1", "Called the senior; symptoms settled.", "Dr. Test");
    const a = alertOf("a1");
    expect(a.acknowledged).toBe(true);
    expect(a.resolution).toBe("Called the senior; symptoms settled.");
    expect(a.resolvedBy).toBe("Dr. Test");
    expect(new Date(a.resolvedAt).getTime()).toBeGreaterThan(0);
  });

  it("leaves the other alerts open", async () => {
    await care.acknowledgeAlert("p1", "a1", "Resolved by phone.", "Dr. Test");
    expect(alertOf("a2").acknowledged).toBeUndefined();
  });
});
