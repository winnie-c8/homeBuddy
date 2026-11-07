import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinPatient } from "@/lib/care-store";

export function JoinPatientCard({ kind, onDone, className }: { kind: "family" | "care_team"; onDone?: () => void; className?: string }) {
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await joinPatient(code, relation);
      toast.success("You're now connected.");
      setCode("");
      setRelation("");
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className={className ?? "mt-6 space-y-3 rounded-3xl border border-border bg-card p-5"}>
      <h3 className="font-display text-lg font-semibold">{kind === "family" ? "Connect to your loved one" : "Add a patient"}</h3>
      <p className="text-sm text-muted-foreground">Enter the 6-character code shown on their homeBuddy page.</p>
      <div className="space-y-1">
        <Label htmlFor="join-code">Code</Label>
        <Input id="join-code" required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} className="font-mono tracking-widest" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="join-relation">{kind === "family" ? "You are their…" : "Your role"}</Label>
        <Input id="join-relation" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder={kind === "family" ? "Son, daughter, friend" : "Family physician, nurse"} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>Connect</Button>
    </form>
  );
}
