import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { BellRing, MessageCircleQuestion, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loading, StatusBadge, StatusDot } from "@/components/status-badge";
import { care, useCare } from "@/lib/care-store";
import { adherence, latestCheckIn, patientStatus, type Status } from "@/lib/care";

export const Route = createFileRoute("/care/")({
  head: () => ({
    meta: [
      { title: "Care team dashboard — Hearthline" },
      { name: "description", content: "See every patient's daily status, flagged risks and open questions at a glance." },
      { property: "og:title", content: "Care team dashboard — Hearthline" },
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
  if (!state) return <Loading />;
  const patients = [...state.patients].sort((a, b) => order[patientStatus(a)] - order[patientStatus(b)]);
  const counts = { red: 0, yellow: 0, green: 0 } as Record<Status, number>;
  patients.forEach((p) => counts[patientStatus(p)]++);
  const openAlerts = state.alerts.filter((a) => !a.acknowledged);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Dr. Anjali Patel · Today</p>
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
            {openAlerts.map((a) => {
              const p = state.patients.find((x) => x.id === a.patientId);
              return (
                <div key={a.id} className={`rounded-2xl p-4 ${a.level === "urgent" ? "bg-status-red-soft" : "bg-status-yellow-soft"}`}>
                  <p className="font-bold">{p?.name}</p>
                  <p>{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.at), { addSuffix: true })} · Notified {a.notified.join(", ")}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => care.acknowledgeAlert(a.id)}>
                    Mark handled
                  </Button>
                </div>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="mt-6 text-muted-foreground" onClick={() => care.reset()}>
            <RotateCcw /> Reset sample data
          </Button>
        </aside>
      </div>
    </main>
  );
}
