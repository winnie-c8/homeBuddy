import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Users, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleHome, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/welcome")({
  beforeLoad: ({ context }) => {
    if (context.account.role) throw redirect({ to: roleHome(context.account.role) });
  },
  head: () => ({
    meta: [
      { title: "Welcome — Hearthline" },
      { name: "description", content: "Tell Hearthline whether you're a senior, family member or care team member." },
      { property: "og:title", content: "Welcome — Hearthline" },
      { property: "og:description", content: "Choose your Hearthline account type." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Welcome,
});

const ROLES = [
  { value: "senior", label: "I'm a senior", hint: "I'll take the daily check-in calls", icon: Phone },
  { value: "family", label: "Family member", hint: "I want updates about a loved one", icon: Users },
  { value: "care_team", label: "Care team", hint: "I care for patients professionally", icon: Stethoscope },
] as const;

function Welcome() {
  const { account } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [role, setRole] = useState<AppRole>("senior");
  const [name, setName] = useState(account.displayName.includes("@") ? "" : account.displayName);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("choose_role", { _role: role, _display_name: name });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await router.invalidate();
    await navigate({ to: roleHome(role) });
  }

  return (
    <main className="mx-auto max-w-xl px-5 pb-24 pt-12">
      <h1 className="text-4xl font-semibold">Welcome to Hearthline</h1>
      <p className="mt-2 text-lg text-muted-foreground">Who are you? You choose this once.</p>
      <div className="mt-8 space-y-3" role="radiogroup" aria-label="Account type">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={role === r.value}
            onClick={() => setRole(r.value)}
            className={cn(
              "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors",
              role === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-secondary",
            )}
          >
            <r.icon className="size-6 shrink-0" />
            <span>
              <span className="block text-lg font-semibold">{r.label}</span>
              <span className="block text-sm opacity-80">{r.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        <Label htmlFor="w-name">Your name</Label>
        <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
      </div>
      <Button size="lg" className="mt-6 h-12 w-full text-base" disabled={busy || !name.trim()} onClick={save}>
        Continue
      </Button>
    </main>
  );
}
