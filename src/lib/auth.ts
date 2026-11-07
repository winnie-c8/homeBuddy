import { redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "senior" | "family" | "care_team";
export type Account = { id: string; email: string; displayName: string; phone: string | null; role: AppRole | null };

export const ROLE_LABELS: Record<AppRole, string> = {
  senior: "Senior",
  family: "Family member",
  care_team: "Care team",
};

export function roleHome(role: AppRole | null): "/senior" | "/family" | "/care" | "/welcome" {
  if (role === "senior") return "/senior";
  if (role === "care_team") return "/care";
  if (role === "family") return "/family";
  return "/welcome";
}

export async function getAccount(): Promise<Account | null> {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("display_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name || user.email || user.phone || "",
    phone: profile?.phone ?? null,
    role: (roles?.[0]?.role as AppRole | undefined) ?? null,
  };
}

/** Sends someone to their own home page when they open a page meant for another role. */
export function requireRole(account: Account, role: AppRole) {
  if (account.role !== role) throw redirect({ to: roleHome(account.role) });
}

export function useAccount() {
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  useEffect(() => {
    let active = true;
    const load = () => getAccount().then((a) => active && setAccount(a));
    void load();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return account;
}
