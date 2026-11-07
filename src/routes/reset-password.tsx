import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccount, roleHome } from "@/lib/auth";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — homeBuddy" },
      { name: "description", content: "Set a new password for your homeBuddy account." },
      { property: "og:title", content: "Choose a new password — homeBuddy" },
      { property: "og:description", content: "Set a new password for your homeBuddy account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    const account = await getAccount();
    await navigate({ to: roleHome(account?.role ?? null) });
  }

  return (
    <main className="mx-auto max-w-md px-5 pb-24 pt-12">
      <h1 className="text-4xl font-semibold text-foreground">Choose a new password</h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input id="password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 text-base" />
        </div>
        <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={busy}>Save password</Button>
      </form>
    </main>
  );
}
