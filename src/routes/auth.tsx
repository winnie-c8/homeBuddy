import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Phone, Users, Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccount, roleHome, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

type Search = { redirect?: string | undefined };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect: typeof s["redirect"] === "string" && s["redirect"].startsWith("/") && !s["redirect"].startsWith("//") ? s["redirect"] : undefined,
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
  const [method, setMethod] = useState<"email" | "phone">("email");
  const [phoneCode, setPhoneCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);

  async function google() {
    if (redirect) sessionStorage.setItem("hearthline-after-login", redirect);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) toast.error(error.message);
  }

  async function phoneSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const number = phone.trim().startsWith("+") ? phone.trim() : `+1${phone.replace(/\D/g, "")}`;
      if (!codeSent) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: number,
          options: mode === "signup" ? { data: { role, display_name: name.trim(), phone: number } } : {},
        });
        if (error) throw error;
        setCodeSent(true);
        toast.success("We texted you a 6-digit code.");
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone: number, token: phoneCode.trim(), type: "sms" });
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

  // Returning from Google: once the session is ready, go to the right page.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      void getAccount().then((a) => {
        if (!a) return;
        const saved = sessionStorage.getItem("hearthline-after-login");
        sessionStorage.removeItem("hearthline-after-login");
        const safe = saved && saved.startsWith("/") && !saved.startsWith("//") ? saved : null;
        void navigate({ to: a.role ? (safe ?? roleHome(a.role)) : "/welcome" });
      });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

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
        <>
        {mode !== "forgot" && (
          <div className="mt-8 space-y-3">
            <button type="button" onClick={google} className="google-button">
              <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.480-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.080.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.950 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.730-4.96z"/></svg>
              <span>Continue with Google</span>
            </button>
            <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1 text-sm" role="tablist" aria-label="Sign-in method">
              {(["email", "phone"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => { setMethod(m); setCodeSent(false); }}
                  className={cn("rounded-full py-2 transition-colors", method === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}
                >
                  {m === "email" ? "Email" : "Phone number"}
                </button>
              ))}
            </div>
          </div>
        )}
        {method === "phone" && mode !== "forgot" ? (
          <form onSubmit={phoneSubmit} className="mt-6 space-y-5">
            {mode === "signup" && !codeSent && (
              <>
                <RolePicker role={role} setRole={setRole} />
                <div className="space-y-2">
                  <Label htmlFor="pname">Your name</Label>
                  <Input id="pname" required value={name} onChange={(e) => setName(e.target.value)} className="h-12 text-base" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="pphone">Mobile number</Label>
              <Input id="pphone" type="tel" required autoComplete="tel" placeholder="416 555 0123" value={phone} disabled={codeSent} onChange={(e) => setPhone(e.target.value)} className="h-12 text-base" />
            </div>
            {codeSent && (
              <div className="space-y-2">
                <Label htmlFor="pcode">Code from the text message</Label>
                <Input id="pcode" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} className="h-12 text-center font-mono text-2xl tracking-widest" />
              </div>
            )}
            <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {codeSent ? "Verify code" : "Text me a code"}
            </Button>
          </form>
        ) : (
        <form onSubmit={submit} className="mt-6 space-y-5">
          {mode === "signup" && (
            <>
              <RolePicker role={role} setRole={setRole} />
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
        </>
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

function RolePicker({ role, setRole }: { role: AppRole; setRole: (r: AppRole) => void }) {
  return (
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
  );
}
