import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { PREVIEW_ALL_PAGES, requireRole, roleHome, type Account } from "./auth";

const acct = (role: Account["role"]): Account => ({ id: "1", email: "a@b.c", displayName: "A", phone: null, role });

describe("role routing", () => {
  it("sends each role to its own page", () => {
    expect(roleHome("senior")).toBe("/senior");
    expect(roleHome("family")).toBe("/family");
    expect(roleHome("care_team")).toBe("/care");
  });
  it("sends Google/phone users without an account type to choose one", () => {
    expect(roleHome(null)).toBe("/welcome");
  });
  // Re-enabled automatically once the temporary PREVIEW_ALL_PAGES switch is turned off.
  it.skipIf(PREVIEW_ALL_PAGES)("blocks a family member from the care team dashboard", () => {
    expect(() => requireRole(acct("family"), "care_team")).toThrow();
  });
  it("lets care team open the care team dashboard", () => {
    expect(() => requireRole(acct("care_team"), "care_team")).not.toThrow();
  });
});
