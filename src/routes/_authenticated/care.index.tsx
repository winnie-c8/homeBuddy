import { requireRole } from "@/lib/auth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { BellRing, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/status-badge";
import { care, useCare } from "@/lib/care-store";
import { JoinPatientCard } from "@/components/join-patient";
import { adherence, latestCheckIn, patientStatus, type Status } from "@/lib/care";

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
  const openAlerts = state.alerts.filter((a) => !a.acknowledged);

  const cardStyle: Record<Status, { card: string; box: string; title: string; label: string }> = {
    red: { card: "bg-risk", box: "bg-risk-soft", title: "text-risk-ink", label: "HIGH RISK" },
    yellow: { card: "bg-watch", box: "bg-watch-soft", title: "text-foreground", label: "Watch" },
    green: { card: "bg-card", box: "bg-update-soft", title: "text-foreground", label: "Updates" },
  };
  const dot: Record<Status, string> = { red: "bg-risk-ink", yellow: "bg-watch", green: "bg-calm-dot" };

  return (
    <div className="relative min-h-screen overflow-hidden bg-clinic-bg">
      <svg aria-hidden="true" viewBox="0 0 1440 1024" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 size-full" fill="none">
        <g className="stroke-clinic-swirl" strokeWidth="38" strokeLinecap="round">
          <path d="M-40 140 C 200 60, 420 80, 600 40 S 900 -20, 1000 30" />
          <path d="M-60 360 C 120 260, 380 300, 300 420 S 40 520, 160 600 S 560 640, 760 560" />
          <path d="M880 760 C 1040 640, 1260 680, 1500 600" />
          <path d="M1120 1060 C 1180 900, 1360 860, 1480 900" />
        </g>
      </svg>
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xl">Welcome, {account.displayName}</p>
            <h1 className="text-6xl font-bold md:text-7xl">Your Patients</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#add-patient" className="rounded-2xl bg-card px-4 py-2 text-xl shadow-[var(--shadow-soft)] hover:bg-muted">Add Patient</a>
            <div className="flex items-center gap-5 rounded-2xl bg-card px-4 py-2 text-xl shadow-[var(--shadow-soft)]">
              {(["red", "yellow", "green"] as Status[]).map((s) => (
                <span key={s} className="flex items-center gap-2">
                  <span className={`size-7 rounded-full ${dot[s]}`} aria-label={s} /> {counts[s]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <section className="mt-12 grid gap-8 md:grid-cols-2">
          {patients.length === 0 && (
            <p className="bg-card p-8 text-muted-foreground shadow-[var(--shadow-soft)] md:col-span-2">No patients yet. Ask a patient for their homeBuddy code and add them below.</p>
          )}
          {patients.map((p) => {
            const last = latestCheckIn(p);
            const status = patientStatus(p);
            const st = cardStyle[status];
            const alert = openAlerts.find((a) => a.patientId === p.id);
            const qs = state.questions.filter((q) => q.patientId === p.id && !q.answer).length;
            const meds = adherence(p.checkIns.slice(-14));
            return (
              <Link
                key={p.id}
                to="/care/$patientId"
                params={{ patientId: p.id }}
                className={`block p-8 shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-1 ${st.card}`}
              >
                <div className="flex items-center gap-8">
                  <div className="grid size-28 shrink-0 place-items-center bg-muted text-4xl font-bold text-muted-foreground">
                    {p.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-4xl font-bold">{p.name}</p>
                    <p className="mt-1 italic">{p.age}yo{p.conditions.length ? `, ${p.conditions.join(", ")}` : ""}</p>
                    <p className="mt-1 italic">
                      {last ? `${last.answered ? "checked in" : "missed call"} ${formatDistanceToNow(new Date(last.date), { addSuffix: true })}` : "no calls yet"}
                    </p>
                  </div>
                </div>
                <div className={`mt-5 px-5 py-3 shadow-[var(--shadow-soft)] ${st.box}`}>
                  <p className={`flex items-center gap-2 text-xl font-bold ${st.title}`}>
                    {status !== "green" && <span aria-hidden="true">⚠️</span>}
                    {st.label}
                  </p>
                  <p className="mt-1">{alert?.message ?? last?.summary ?? "No check-ins yet."}</p>
                  <p className="mt-2 flex items-center gap-3 text-sm">
                    <span><span className="font-bold">{meds ?? "—"}%</span> meds</span>
                    {qs > 0 && <span className="inline-flex items-center gap-1"><MessageCircleQuestion className="size-4" />{qs} question{qs > 1 ? "s" : ""}</span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>

        <section className="mt-12">
          <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold"><BellRing className="size-6" /> Alerts</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {openAlerts.length === 0 && <p className="bg-card p-5 shadow-[var(--shadow-soft)]">No open alerts.</p>}
            {openAlerts.map((a) => {
              const p = state.patients.find((x) => x.id === a.patientId);
              return (
                <div key={a.id} className={`p-5 shadow-[var(--shadow-soft)] ${a.level === "urgent" ? "bg-risk-soft" : "bg-watch-soft"}`}>
                  <p className="text-lg font-bold">{p?.name}</p>
                  <p>{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.at), { addSuffix: true })} · Notified {a.notified.join(", ")}
                  </p>
                  <Button size="sm" variant="outline" className="mt-2 rounded-full" onClick={() => void care.acknowledgeAlert(a.patientId, a.id)}>
                    Mark handled
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section id="add-patient" className="mt-12 max-w-xl scroll-mt-24 [&_form]:rounded-none [&_form]:border-0 [&_form]:p-8 [&_form]:shadow-[var(--shadow-soft)] [&_h3]:text-3xl [&_h3]:font-bold">
          <JoinPatientCard kind="care_team" />
        </section>
      </main>
    </div>
  );
}
