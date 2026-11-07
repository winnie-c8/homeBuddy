import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMyPatient, newPatientBlob } from "@/lib/care-store";

export function SeniorSetup({ userId, defaultName }: { userId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [preferred, setPreferred] = useState(defaultName.split(" ")[0] ?? "");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [callTime, setCallTime] = useState("09:30");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await createMyPatient(
        userId,
        newPatientBlob({ name: name.trim(), preferredName: preferred.trim() || name.trim(), age: Number(age) || 0, city: city.trim(), callTime }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  const field = "h-14 text-xl";
  return (
    <main className="mx-auto max-w-xl px-5 pb-24 pt-12">
      <h1 className="text-5xl font-semibold">Welcome to Hearthline</h1>
      <p className="mt-3 text-xl text-muted-foreground">A few details so Rosie knows how to greet you.</p>
      <form onSubmit={submit} className="mt-8 space-y-5 text-lg">
        <div className="space-y-2"><Label htmlFor="s-name" className="text-lg">Full name</Label><Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} className={field} /></div>
        <div className="space-y-2"><Label htmlFor="s-pref" className="text-lg">What should Rosie call you?</Label><Input id="s-pref" value={preferred} onChange={(e) => setPreferred(e.target.value)} className={field} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label htmlFor="s-age" className="text-lg">Age</Label><Input id="s-age" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} className={field} /></div>
          <div className="space-y-2"><Label htmlFor="s-time" className="text-lg">Daily call time</Label><Input id="s-time" type="time" value={callTime} onChange={(e) => setCallTime(e.target.value)} className={field} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="s-city" className="text-lg">City</Label><Input id="s-city" value={city} onChange={(e) => setCity(e.target.value)} className={field} /></div>
        <Button type="submit" size="lg" className="h-14 w-full text-xl" disabled={busy}>Start my check-ins</Button>
      </form>
    </main>
  );
}
