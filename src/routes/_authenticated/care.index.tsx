import { requireRole } from "@/lib/auth";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { BellRing, CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loading } from "@/components/status-badge";
import { care, useCare } from "@/lib/care-store";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [addOpen, setAddOpen] = useState(false);
  const [resolving, setResolving] = useState<Alert | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  if (!state) return <Loading />;
  const patients = [...state.patients].sort((a, b) => order[patientStatus(a)] - order[patientStatus(b)]);
  const counts = { red: 0, yellow: 0, green: 0 } as Record<Status, number>;
  patients.forEach((p) => counts[patientStatus(p)]++);
  // Red first, then the longest-waiting (rule in care.ts).
  const openAlerts = sortAlertsForClinician(state.alerts.filter((a) => alertStage(a) !== "resolved"));
  const handled = state.alerts
    .filter((a) => a.acknowledged)
    .sort((a, b) => (b.resolvedAt ?? b.at).localeCompare(a.resolvedAt ?? a.at))
    .slice(0, 8);

  const openResolve = (a: Alert) => {
    setResolving(a);
    setNote("");
    setResolveError("");
    setSaving(false);
  };

  const submitResolve = async () => {
    if (!resolving || !note.trim()) return;
    setSaving(true);
    setResolveError("");
    try {
      await care.acknowledgeAlert(resolving.patientId, resolving.id, note.trim(), account.displayName);
      setResolving(null);
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Could not save this note. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cardStyle: Record<Status, { card: string; box: string; title: string; label: string }> = {
    red: { card: "bg-risk", box: "bg-risk-soft", title: "text-risk-ink", label: "HIGH RISK" },
    yellow: { card: "bg-watch", box: "bg-watch-soft", title: "text-foreground", label: "Watch" },
    green: { card: "bg-card", box: "bg-update-soft", title: "text-foreground", label: "Updates" },
  };
  const dot: Record<Status, string> = { red: "bg-risk-ink", yellow: "bg-watch", green: "bg-calm-dot" };

  return (
    <div className="relative min-h-screen overflow-hidden bg-clinic-bg">
      <main className="relative mx-auto max-w-6xl px-5 pb-24 pt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xl">Welcome, {account.displayName}</p>
            <h1 className="text-6xl font-bold md:text-7xl">Your Patients</h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <button type="button" className="rounded-2xl bg-card px-4 py-2 text-xl shadow-[var(--shadow-soft)] hover:bg-muted">Add Patient</button>
              </DialogTrigger>
              <DialogContent className="rounded-none border-0 bg-clinic-bg p-0 shadow-[var(--shadow-soft)] sm:rounded-none">
                <DialogTitle className="sr-only">Add a patient</DialogTitle>
                <DialogDescription className="sr-only">Enter the patient's homeBuddy code.</DialogDescription>
                <JoinPatientCard
                  kind="care_team"
                  onDone={() => setAddOpen(false)}
                  className="space-y-4 bg-card p-8 [&_button[type=submit]]:h-12 [&_button[type=submit]]:rounded-2xl [&_button[type=submit]]:text-lg [&_h3]:text-4xl [&_h3]:font-bold [&_input]:h-12 [&_input]:rounded-none [&_input]:bg-clinic-bg [&_input]:text-lg [&_label]:text-lg [&_p]:italic"
                />
              </DialogContent>
            </Dialog>
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
            <p className="bg-card p-8 text-muted-foreground shadow-[var(--shadow-soft)] md:col-span-2">No patients yet. Ask a patient for their homeBuddy code and click Add Patient.</p>
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
                  <p className="text-xs font-bold uppercase tracking-wide">{a.level === "urgent" ? "Respond today" : "Watch"}</p>
                  <p className="text-lg font-bold">{p?.name}</p>
                  <p>{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.at), { addSuffix: true })} · Notified {a.notified.join(", ")}
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    {a.onItBy ? `On it · ${a.onItBy}${a.onItAt ? ` · ${format(new Date(a.onItAt), "h:mm a")}` : ""}` : `Waiting ${waitingFor(a)}`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {!a.onItBy && (
                      <Button size="sm" className="rounded-full" onClick={() => void care.markOnIt(a.patientId, a.id, account.displayName)}>
                        On it
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => openResolve(a)}>
                      Mark handled
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {handled.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 flex items-center gap-2 text-3xl font-bold"><CheckCircle2 className="size-6" /> Handled</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {handled.map((a) => {
                const p = state.patients.find((x) => x.id === a.patientId);
                return (
                  <div key={a.id} className="bg-card p-5 shadow-[var(--shadow-soft)]">
                    <p className="text-lg font-bold">{p?.name}</p>
                    <p className="text-muted-foreground">{a.message}</p>
                    <p className="mt-2 italic">"{a.resolution}"</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {a.resolvedBy ?? "Care team"} · {formatDistanceToNow(new Date(a.resolvedAt ?? a.at), { addSuffix: true })}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Dialog open={!!resolving} onOpenChange={(o) => { if (!o && !saving) setResolving(null); }}>
          <DialogContent className="rounded-none border-0 bg-clinic-bg p-0 shadow-[var(--shadow-soft)] sm:rounded-none">
            <DialogTitle className="sr-only">Mark alert handled</DialogTitle>
            <DialogDescription className="sr-only">Write how the situation was resolved before marking it handled.</DialogDescription>
            <div className="space-y-4 bg-card p-8">
              <div>
                <h3 className="text-4xl font-bold">Mark handled</h3>
                <p className="mt-1 italic text-muted-foreground">Say how this was resolved so the team knows it is closed.</p>
              </div>
              {resolving && (
                <div className="bg-clinic-bg p-4">
                  <p className="font-bold">{state.patients.find((x) => x.id === resolving.patientId)?.name}</p>
                  <p>{resolving.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(resolving.at), { addSuffix: true })} · Notified {resolving.notified.join(", ")}
                  </p>
                </div>
              )}
              <div>
                <label className="text-lg font-bold" htmlFor="resolution-note">
                  How was it resolved? <span className="text-risk-ink">Required</span>
                </label>
                <Textarea
                  id="resolution-note"
                  className="mt-2 min-h-28 rounded-none bg-clinic-bg text-lg"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Called the senior, symptoms settled, advised to rest and re-check tomorrow morning"
                />
                <p className="mt-1 text-sm italic text-muted-foreground">The care team and anyone the senior shares with can read this note.</p>
              </div>
              {resolveError && <p className="text-risk-ink">{resolveError}</p>}
              <div className="flex gap-3">
                <Button className="h-12 rounded-2xl px-6 text-lg" disabled={!note.trim() || saving} onClick={() => void submitResolve()}>
                  {saving ? "Saving…" : "Mark handled"}
                </Button>
                <Button variant="outline" className="h-12 rounded-2xl px-6 text-lg" disabled={saving} onClick={() => setResolving(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}
