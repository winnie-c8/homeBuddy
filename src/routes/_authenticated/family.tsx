import { requireRole } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow, format } from "date-fns";
import { BellRing, Lock } from "lucide-react";
import { Loading, StatusBadge } from "@/components/status-badge";
import { useCare } from "@/lib/care-store";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JoinPatientCard } from "@/components/join-patient";
import { adherence, alertStage, followUpForFamily, latestCheckIn, patientStatus } from "@/lib/care";
import familyBackground from "@/assets/family-background.svg.asset.json";

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
      <main className="family-page min-h-[calc(100dvh-5rem)] px-5 py-16">
        <div className="mx-auto max-w-xl">
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
        </div>
      </main>
    );
  }

  const last = latestCheckIn(p);
  const week = [...p.checkIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const alerts = state.alerts.filter((a) => a.patientId === p.id && a.notified.includes(ME.name)).sort((a, b) => b.at.localeCompare(a.at));

  return (
    <main className="family-page relative isolate min-h-[calc(100dvh-5rem)] overflow-hidden px-5 pb-24 pt-10 sm:px-10">
      <img src={familyBackground.url} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 size-full object-fill" />
      <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="break-words text-5xl font-bold sm:text-6xl">{p.name}</h1>
        <StatusBadge status={patientStatus(p)} />
      </div>

      <section className="mt-8 grid gap-5 sm:grid-cols-3 sm:gap-8" aria-label="Seven-day averages">
        <Stat label="Medications" value={`${adherence(week) ?? "—"}%`} />
        <Stat label="Average mood" value={avg(week.map((c) => c.mood))} suffix="/5" />
        <Stat label="Average sleep" value={avg(week.map((c) => c.sleepHours))} suffix=" h" />
      </section>

      <section className="mt-10 bg-family-plan px-6 py-7 text-family-on-green sm:px-10">
        <h2 className="text-3xl font-bold">Care Plan</h2>
        <ul className="mt-2 list-disc space-y-1 pl-7 text-xl sm:text-2xl">
          {p.planItems.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </section>

      {alerts.length > 0 && (
        <section className="mt-8 space-y-3">
          {alerts.slice(0, 4).map((a) => (
            <div key={a.id} className={`flex gap-3 rounded-2xl p-4 ${a.level === "urgent" ? "bg-status-red-soft" : "bg-status-yellow-soft"}`}>
              <BellRing className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-bold">{a.family ?? a.message}</p>
                <p className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(a.at), { addSuffix: true })}</p>
                <p className={`mt-1 text-sm font-semibold ${alertStage(a) === "resolved" ? "text-primary" : ""}`}>{followUpForFamily(a)}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {last && (
        <section className="mt-8 border-t border-family-ink/20 py-6">
          <p className="text-sm text-muted-foreground">Latest check-in · {format(new Date(last.date), "EEEE, MMM d 'at' h:mm a")}</p>
          <p className="mt-2 text-xl leading-relaxed">{last.summary}</p>
        </section>
      )}

      </div>
    </main>
  );
}

function avg(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : "—";
}

function Stat({ label, value, suffix = "" }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-4 bg-family-stat p-5 text-center text-family-on-green sm:min-h-56">
      <p className="text-2xl font-bold">{label}</p>
      <p className="font-display text-5xl font-bold">{value}{value !== "—" && suffix}</p>
    </div>
  );
}
