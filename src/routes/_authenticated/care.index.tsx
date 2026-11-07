import { requireRole } from "@/lib/auth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { BellRing, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, StatusBadge, StatusDot } from "@/components/status-badge";
import { care, useCare } from "@/lib/care-store";
import { JoinPatientCard } from "@/components/join-patient";
import { adherence, alertStage, latestCheckIn, patientStatus, sortAlertsForClinician, waitingFor, type Alert, type Status } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/care/")({
  beforeLoad: ({ context }) => requireRole(context.account, "care_team"),
  head: () => ({
    meta: [
      { title: "Care team dashboard — homeBuddy" },
      { name: "description", content: "See every patient's daily status, flagged risks and open questions at a glance." },
      { property: "og:title", content: "Care team dashboard — homeBuddy" },
      { property: "og:description", content: "Green, yellow and red patient status from daily AI check-ins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CareDashboard,
});

const order: Record<Status, number> = { red: 0, yellow: 1, green: 2 };

function CareDashboard() {
  const state = useCare();
  const { account } = Route.useRouteContext();
  if (!state) return <Loading />;
  const patients = [...state.patients].sort((a, b) => order[patientStatus(a)] - order[patientStatus(b)]);
  const counts = { red: 0, yellow: 0, green: 0 } as Record<Status, number>;
  patients.forEach((p) => counts[patientStatus(p)]++);
  const openAlerts = sortAlertsForClinician(state.alerts.filter((a) => alertStage(a) !== "resolved"));
  const resolved = state.alerts.filter((a) => alertStage(a) === "resolved").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 5);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground">{account.displayName} · Today</p>
          <h1 className="text-4xl font-semibold">Your patients</h1>
        </div>
        <div className="flex gap-3">
          {(["red", "yellow", "green"] as Status[]).map((s) => (
            <div key={s} className="flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-[var(--shadow-soft)]">
              <StatusDot status={s} /> <span className="font-bold">{counts[s]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {patients.length === 0 && (
            <p className="p-8 text-muted-foreground">No patients yet. Ask a patient for their homeBuddy code and add it on the right.</p>
          )}
          {patients.map((p) => {
            const last = latestCheckIn(p);
            const qs = state.questions.filter((q) => q.patientId === p.id && !q.answer).length;
            return (
              <Link
                key={p.id}
                to="/care/$patientId"
                params={{ patientId: p.id }}
                className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border px-6 py-5 transition-colors last:border-0 hover:bg-muted md:grid-cols-[1.4fr_1fr_0.7fr_auto]"
              >
                <div>
                  <p className="text-lg font-bold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{p.age} · {p.conditions.join(", ")}</p>
                </div>
                <p className="hidden text-sm text-muted-foreground md:block">
                  {last ? `${last.answered ? "Checked in" : "Missed call"} ${formatDistanceToNow(new Date(last.date), { addSuffix: true })}` : "No calls yet"}
                </p>
                <p className="hidden text-sm md:block">
                  <span className="font-bold">{adherence(p.checkIns.slice(-14)) ?? "—"}%</span> meds
                  {qs > 0 && (
                    <span className="ml-3 inline-flex items-center gap-1 text-accent"><MessageCircleQuestion className="size-4" />{qs}</span>
                  )}
                </p>
                <StatusBadge status={patientStatus(p)} />
              </Link>
            );
          })}
        </section>

        <aside>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold"><BellRing className="size-5" /> Alerts</h2>
          <div className="space-y-3">
            {openAlerts.length === 0 && <p className="text-muted-foreground">No open alerts.</p>}
            {openAlerts.map((a) => (
              <AlertCard key={a.id} a={a} patientName={state.patients.find((x) => x.id === a.patientId)?.name ?? ""} me={account.displayName} />
            ))}
            {resolved.length > 0 && (
              <details className="rounded-2xl border border-border p-4">
                <summary className="cursor-pointer font-semibold">Resolved ({resolved.length})</summary>
                <ul className="mt-2 space-y-2 text-sm">
                  {resolved.map((a) => (
                    <li key={a.id}>
                      <span className="font-semibold">{state.patients.find((x) => x.id === a.patientId)?.name}:</span> {a.message}
                      <span className="block text-muted-foreground">
                        {a.followUp ? `Resolved by ${a.followUp.by}, ${format(new Date(a.followUp.at), "h:mm a")}${a.followUp.note ? ` — ${a.followUp.note}` : ""}` : "Marked handled"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          <JoinPatientCard kind="care_team" />
        </aside>
      </div>
    </main>
  );
}

/** One alert and the clinician's follow-up: New → On it → Resolved (with a note family can see). */
function AlertCard({ a, patientName, me }: { a: Alert; patientName: string; me: string }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const stage = alertStage(a);
  const act = (status: "on_it" | "resolved") => {
    setBusy(true);
    void care.followUp(a.patientId, a.id, status, me, status === "resolved" ? note : undefined).finally(() => setBusy(false));
  };
  return (
    <div className={`rounded-2xl p-4 ${a.level === "urgent" ? "bg-status-red-soft" : "bg-status-yellow-soft"}`}>
      <p className="text-xs font-bold uppercase tracking-wide">{a.level === "urgent" ? "Respond today" : "Watch"}</p>
      <p className="font-bold">{patientName}</p>
      <p>{a.message}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatDistanceToNow(new Date(a.at), { addSuffix: true })} · Notified {a.notified.join(", ")}
      </p>
      {stage === "new" ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-semibold">Waiting {waitingFor(a)}</span>
          <Button size="sm" className="rounded-full" disabled={busy} onClick={() => act("on_it")}>On it</Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-semibold">On it · {a.followUp?.by} · {a.followUp ? format(new Date(a.followUp.at), "h:mm a") : ""}</p>
          <div className="flex gap-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done? e.g. Called, booked dialysis tomorrow" className="h-9 bg-background" />
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => act("resolved")}>Resolve</Button>
          </div>
        </div>
      )}
    </div>
  );
}
