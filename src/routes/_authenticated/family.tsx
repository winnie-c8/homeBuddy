import { requireRole } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow, format } from "date-fns";
import { BellRing, Lock, Pill } from "lucide-react";
import { Loading, StatusBadge } from "@/components/status-badge";
import { useCare } from "@/lib/care-store";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JoinPatientCard } from "@/components/join-patient";
import { adherence, latestCheckIn, patientStatus } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/family")({
  beforeLoad: ({ context }) => requireRole(context.account, "family"),
  head: () => ({
    meta: [
      { title: "Family view — homeBuddy" },
      { name: "description", content: "See how your loved one is doing each day and get alerts right away." },
      { property: "og:title", content: "Family view — homeBuddy" },
      { property: "og:description", content: "Daily updates and safety alerts for families of seniors living at home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const state = useCare();
  const { account } = Route.useRouteContext();
  const [linked, setLinked] = useState<boolean | null>(null);
  useEffect(() => {
    void supabase.from("patient_members").select("id").eq("user_id", account.id).then(({ data }) => setLinked((data?.length ?? 0) > 0));
  }, [account.id, state]);
  if (!state || linked === null) return <Loading />;
  const ME = { id: account.id, name: account.displayName };
  const p = state.patients[0];

  if (!p) {
    return (
      <main className="mx-auto max-w-xl px-5 py-16">
        {linked ? (
          <div className="text-center">
            <Lock className="mx-auto size-12 text-muted-foreground" />
            <h1 className="mt-4 text-4xl font-semibold">Not sharing right now</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              Your loved one has chosen not to share check-in details with you. Their care team will still contact you in an emergency.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-4xl font-semibold">Hi {account.displayName}</h1>
            <p className="mt-3 text-lg text-muted-foreground">Connect to your loved one to see their daily check-ins and get alerts.</p>
            <JoinPatientCard kind="family" />
          </>
        )}
      </main>
    );
  }

  const last = latestCheckIn(p);
  const week = [...p.checkIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const alerts = state.alerts.filter((a) => a.patientId === p.id && a.notified.includes(ME.name));

  return (
    <main className="mx-auto max-w-4xl px-5 pb-24 pt-12">
      <p className="text-muted-foreground">Hi {account.displayName} — here's how {p.preferredName} is doing.</p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="text-5xl font-semibold">{p.name}</h1>
        <StatusBadge status={patientStatus(p)} />
      </div>

      {alerts.length > 0 && (
        <section className="mt-8 space-y-3">
          {alerts.slice(0, 4).map((a) => (
            <div key={a.id} className={`flex gap-3 rounded-2xl p-4 ${a.level === "urgent" ? "bg-status-red-soft" : "bg-status-yellow-soft"}`}>
              <BellRing className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">{a.message}</p>
                <p className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {last && (
        <section className="mt-8 rounded-3xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
          <p className="text-sm text-muted-foreground">Latest check-in · {format(new Date(last.date), "EEEE, MMM d 'at' h:mm a")}</p>
          <p className="mt-2 text-xl leading-relaxed">{last.summary}</p>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Medications taken (7 days)" value={`${adherence(week) ?? "—"}%`} />
        <Stat label="Average mood" value={avg(week.map((c) => c.mood))} suffix="/5" />
        <Stat label="Average sleep" value={avg(week.map((c) => c.sleepHours))} suffix=" h" />
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-card p-7">
        <h2 className="flex items-center gap-2 text-2xl font-semibold"><Pill className="size-6 text-primary" /> Care plan</h2>
        <ul className="mt-4 list-disc space-y-1 pl-6 text-lg">
          {p.planItems.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </section>
    </main>
  );
}

function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—";
}

function Stat({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-3xl bg-secondary p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold">{value}{value !== "—" && suffix}</p>
    </div>
  );
}
