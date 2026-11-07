import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Phone, Users, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccount, roleHome, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Search = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") && !s.redirect.startsWith("//") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — Hearthline" },
      { name: "description", content: "Sign in or create a Hearthline account as a senior, family member or care team member." },
      { property: "og:title", content: "Sign in — Hearthline" },
      { property: "og:description", content: "Accounts for seniors, families and care teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const ROLES = [
  { value: "senior", label: "I'm a senior", icon: Phone },
  { value: "family", label: "Family member", icon: Users },
  { value: "care_team", label: "Care team", icon: Stethoscope },
] as const;

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [role, setRole] = useState<AppRole>("senior");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("We sent you a link to choose a new password.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { role, display_name: name.trim(), phone: phone.trim() || null },
          },
        });
        if (error) throw error;
        if (data.session) {
          await navigate({ to: roleHome(role) });
        } else {
          setSent("Check your email and click the link to confirm your account.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const account = await getAccount();
        await navigate({ to: redirect ?? roleHome(account?.role ?? null) });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-12">
      <h1 className="text-4xl font-semibold text-foreground">
        {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset password" : "Welcome back"}
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        {mode === "signup" ? "Tell us who you are so we show the right page." : "Sign in to Hearthline."}
      </p>

      {sent ? (
        <div className="mt-8 rounded-2xl bg-secondary p-6 text-lg text-secondary-foreground">{sent}</div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-5">
          {mode === "signup" && (
            <>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Account type">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={role === r.value}
                    onClick={() => setRole(r.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border p-3 text-sm transition-colors",
                      role === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary",
                    )}
                  >
                    <r.icon className="size-5" />
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 text-base" />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 text-base" />
          </div>
          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          )}
          <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </Button>
        </form>
      )}

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
        {mode !== "signin" && (
          <button className="underline" onClick={() => { setMode("signin"); setSent(null); }}>Already have an account? Sign in</button>
        )}
        {mode !== "signup" && (
          <button className="underline" onClick={() => { setMode("signup"); setSent(null); }}>New here? Create an account</button>
        )}
        {mode === "signin" && (
          <button className="underline" onClick={() => { setMode("forgot"); setSent(null); }}>Forgot your password?</button>
        )}
      </div>
    </main>
  );
}
