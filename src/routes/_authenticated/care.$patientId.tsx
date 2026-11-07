import { requireRole } from "@/lib/auth";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import type React from "react";
import swirl from "@/assets/patient-swirl.svg";
import { ArrowLeft, ChevronDown, Phone, Plus, Send, Trash2, AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loading, StatusBadge, StatusDot } from "@/components/status-badge";
import { clinicianQuestions, clinicianQuestionsOf } from "@/lib/clinician-questions";
import { care, useCare } from "@/lib/care-store";
import { checkInStatus, findings, patientStatus, type CheckIn, type FlagIf, type Patient } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/care/$patientId")({
  beforeLoad: ({ context }) => requireRole(context.account, "care_team"),
  head: () => ({
    meta: [
      { title: "Patient details — homeBuddy" },
      { name: "description", content: "Trends, flagged risks, questions and care plan for one patient." },
      { property: "og:title", content: "Patient details — homeBuddy" },
      { property: "og:description", content: "Adherence, mood, sleep and appetite trends from daily check-ins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});


function PatientPage() {
  const { patientId } = Route.useParams();
  const state = useCare();
  if (!state) return <Loading />;
  const p = state.patients.find((x) => x.id === patientId);
  if (!p) return <main className="mx-auto max-w-6xl px-5 py-16">Patient not found.</main>;
  const checkIns = [...p.checkIns].sort((a, b) => a.date.localeCompare(b.date));
  const questions = state.questions.filter((q) => q.patientId === p.id);

  return (
    <div className="relative min-h-screen overflow-hidden bg-pt-bg">
    <img src={swirl} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top" />
    <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-8">
      <Link to="/care" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All patients
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-6xl font-bold md:text-7xl">{p.name}</h1>
        <StatusBadge status={patientStatus(p)} />
      </div>
      <dl className="mt-4 flex flex-wrap gap-3 text-lg">
        <Info label="Age" value={String(p.age)} />
        <Info label="City" value={p.city} />
        {p.conditions.length > 0 && <Info label="Conditions" value={p.conditions.join(", ")} />}
        <Info label="Daily call" value={p.callTime} icon />
      </dl>

      <Flags checkIns={checkIns} />

      <Panel title="Graphs">
        <div className="grid gap-5 md:grid-cols-2">
          <Trend title="Medication adherence (%)" data={checkIns} pick={(c) => (c.answered && c.meds.length ? Math.round((c.meds.filter((m) => m.taken === "yes").length / c.meds.length) * 100) : null)} domain={[0, 100]} color="var(--chart-1)" />
          <Trend title="Mood (1–5)" data={checkIns} pick={(c) => c.mood} domain={[1, 5]} color="var(--chart-2)" />
          <Trend title="Sleep (hours)" data={checkIns} pick={(c) => c.sleepHours} domain={[0, 10]} color="var(--chart-3)" />
          <Trend title="Appetite (meals/day)" data={checkIns} pick={(c) => (c.answered ? c.meals : null)} domain={[0, 3]} color="var(--chart-4)" />
        </div>
      </Panel>

      <AskRosie p={p} />

      <Panel title={`Questions from ${p.preferredName}`}>
        <div className="bg-pt-inner p-5">
          <p className="text-sm text-muted-foreground">Answers are explained on the next call.</p>
          <div className="mt-3 space-y-4">
            {questions.length === 0 && <p className="text-muted-foreground">No questions yet.</p>}
            {questions.map((q) => <QuestionItem key={q.id} q={q} />)}
          </div>
        </div>
      </Panel>

      <PlanEditor p={p} />

      <Panel title="Check-in history">
        <ul className="bg-pt-inner p-5">
          {checkIns.length === 0 && <li className="text-muted-foreground">No check-ins yet.</li>}
          {[...checkIns].reverse().map((c) => (
            <li key={c.id} className="relative flex gap-4 border-l-4 border-watch/60 py-3 pl-5 last:border-transparent">
              <StatusDot status={checkInStatus(c)} className="absolute -left-[9px] top-4 shrink-0" />
              <div>
                <p className="text-xl font-bold">
                  {format(new Date(c.date), "EEE MMM d, yyyy '@' h:mma")} {c.source === "voice" && <span className="text-sm font-normal text-muted-foreground">· voice call</span>}
                </p>
                <p className="mt-1">{c.summary}</p>
                {findings(c, p.preferredName).length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-1.5">
                    {findings(c, p.preferredName).map((f) => (
                      <li key={f.key} className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${f.status === "red" ? "bg-status-red-soft" : "bg-status-yellow-soft"}`}>
                        {f.clinician}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </main>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: boolean }) {
  return (
    <div className="bg-card px-4 py-2 shadow-[var(--shadow-soft)]">
      <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 font-bold">{icon && <Phone className="size-4" />}{value}</dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mt-10 shadow-[var(--shadow-soft)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-card px-6 py-4 text-left shadow-[0_3px_3px_-1px_rgb(0_0_0/0.2)]"
      >
        <h2 className="text-3xl font-bold">{title}</h2>
        <ChevronDown className={`size-9 stroke-[1.5] transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden />
        <span className="sr-only">{open ? "Hide" : "Show"} {title}</span>
      </button>
      {open && <div className="bg-pt-panel p-6 text-pt-ink">{children}</div>}
    </section>
  );
}

function Flags({ checkIns }: { checkIns: CheckIn[] }) {
  const recent = checkIns.slice(-7);
  const flags: string[] = [];
  const last = checkIns[checkIns.length - 1];
  if (last && !last.answered) flags.push("Did not answer the latest call");
  if (recent.some((c) => c.fall)) flags.push("Fall reported this week");
  recent.flatMap((c) => c.urgent).filter((u) => !/fall|fell/.test(u)).forEach((u) => flags.push(`Mentioned "${u}"`));
  const missed = recent.flatMap((c) => c.meds).filter((m) => m.taken === "no").length;
  if (missed >= 2) flags.push(`${missed} missed doses in 7 days`);
  const moods = recent.map((c) => c.mood).filter((m): m is number => m !== null);
  if (moods.length >= 3 && moods.reduce((a, b) => a + b, 0) / moods.length < 3) flags.push("Low mood trend");
  const sleep = recent.map((c) => c.sleepHours).filter((m): m is number => m !== null);
  if (sleep.length >= 3 && sleep.reduce((a, b) => a + b, 0) / sleep.length < 6) flags.push("Short sleep trend");
  if (!flags.length) return null;
  return (
    <section className="mt-6 flex flex-wrap gap-2">
      {[...new Set(flags)].map((f) => (
        <span key={f} className="inline-flex items-center gap-1.5 rounded-full bg-status-red-soft px-3 py-1.5 text-sm font-bold">
          <AlertTriangle className="size-4" /> {f}
        </span>
      ))}
    </section>
  );
}

function Trend({ title, data, pick, domain, color }: { title: string; data: CheckIn[]; pick: (c: CheckIn) => number | null; domain: [number, number]; color: string }) {
  const rows = data.map((c) => ({ day: format(new Date(c.date), "MMM d"), v: pick(c) }));
  return (
    <div className="bg-pt-inner p-5">
      <p className="mb-3 font-bold">{title}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: -20, right: 8, top: 4 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
            <YAxis domain={domain} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }} />
            <Line type="monotone" dataKey="v" name={title} stroke={color} strokeWidth={2.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuestionItem({ q }: { q: { id: string; patientId: string; text: string; askedAt: string; answer?: string; answeredBy?: string; deliveredAt?: string } }) {
  const [text, setText] = useState("");
  const { account } = useRouteContext({ from: "/_authenticated" });
  return (
    <div className="border-b border-border pb-4 last:border-0">
      <p className="text-lg text-pt-btn">“{q.text}”</p>
      <p className="text-xs text-muted-foreground">{format(new Date(q.askedAt), "MMM d, h:mm a")}</p>
      {q.answer ? (
        <p className="mt-2 text-sm">
          <span className="font-bold">{q.answeredBy}:</span> {q.answer}{" "}
          <span className="text-muted-foreground">{q.deliveredAt ? "· Explained on call" : "· Will be shared on next call"}</span>
        </p>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void care.answerQuestion(q.patientId, q.id, text.trim(), account.displayName);
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type an answer…" className="rounded-none bg-card" />
          <Button type="submit" className="rounded-none bg-pt-btn text-primary-foreground hover:bg-pt-ink" aria-label="Send answer"><Send /> Send</Button>
        </form>
      )}
    </div>
  );
}

function PlanEditor({ p }: { p: Patient }) {
  const [items, setItems] = useState(p.planItems);
  const [newItem, setNewItem] = useState("");
  const [note, setNote] = useState("");
  const dirty = JSON.stringify(items) !== JSON.stringify(p.planItems);
  const pending = p.planChanges.filter((c) => !c.deliveredAt);
  return (
    <Panel title="Care plan">
      <div className="bg-pt-inner p-5">
      <p className="text-sm text-muted-foreground">Rosie explains changes on the next call.</p>
      <ul className="mt-4 space-y-2">
        {items.map((i, idx) => (
          <li key={idx} className="flex items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2">
            {i}
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== idx))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a plan item" />
        <Button variant="outline" onClick={() => { if (newItem.trim()) { setItems([...items, newItem.trim()]); setNewItem(""); } }}><Plus /> Add</Button>
      </div>
      <Textarea className="mt-4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, in plain words (e.g. 'Take your water pill at lunch instead of breakfast')" />
      <Button
        className="mt-3"
        disabled={!dirty && !note.trim()}
        onClick={() => {
          void care.addPlanChange(p.id, note.trim() || "The care plan was updated.", items);
          setNote("");
        }}
      >
        Save plan update
      </Button>
      {pending.length > 0 && (
        <div className="mt-5 rounded-2xl bg-status-yellow-soft p-4 text-sm">
          <p className="font-bold">Waiting to be explained on next call</p>
          <ul className="mt-1 list-disc pl-5">{pending.map((c) => <li key={c.id}>{c.text}</li>)}</ul>
        </div>
      )}
      </div>
    </Panel>
  );
}

function AskRosie({ p }: { p: Patient }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [flagIf, setFlagIf] = useState<"" | FlagIf>("");
  const [daily, setDaily] = useState(false);
  const { account } = useRouteContext({ from: "/_authenticated" });
  const list = clinicianQuestionsOf(p).reverse();
  return (
    <Panel title={`Ask ${p.preferredName} a question`}>
      <p className="text-sm">Rosie asks these as yes/no questions and brings back {p.preferredName}'s words. Your "flag if" rule decides the colour, not the AI.</p>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          clinicianQuestions
            .add(p.id, text.trim(), account.displayName, { flagIf: flagIf || undefined, daily })
            .then(() => setText(""))
            .finally(() => setBusy(false));
        }}
      >
        <Input className="min-w-64 flex-1 rounded-none bg-card" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type question here… e.g. Did you do your dialysis today?" />
        <div className="flex items-center gap-2 bg-pt-btn px-3 py-1 text-sm text-primary-foreground" role="group" aria-label="Flag if answer is">
          Flag if answer is:
          {(["yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={flagIf === v}
              onClick={() => setFlagIf(flagIf === v ? "" : v)}
              className={`px-3 py-0.5 font-bold ${flagIf === v ? (v === "yes" ? "bg-status-green text-primary-foreground" : "bg-status-red text-primary-foreground") : "bg-pt-inner/30"}`}
            >
              {v}
            </button>
          ))}
          {!flagIf && <span className="opacity-80">(never, just record)</span>}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={daily} onChange={(e) => setDaily(e.target.checked)} /> Ask every day
        </label>
        <Button type="submit" className="rounded-none bg-pt-btn text-primary-foreground hover:bg-pt-ink" disabled={busy || !text.trim()}><Plus /> Add question</Button>
      </form>
      <ul className="mt-4 space-y-3 bg-pt-inner p-5">
        {list.length === 0 && <li className="text-muted-foreground">No questions queued.</li>}
        {list.map((q) => (
          <li key={q.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
            <div>
              <p className="text-lg text-pt-btn">“{q.text}”</p>
              <p className="text-xs text-muted-foreground">
                {q.askedBy} · {format(new Date(q.createdAt), "MMM d, h:mm a")} · {q.daily ? "Every day" : "Once"} · {q.flagIf ? `Flag if ${q.flagIf} or unclear` : "No flag"}
              </p>
              {q.answer ? (
                <p className="mt-2 text-sm"><span className="font-bold">{p.preferredName} said:</span> {q.answer}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Waiting — Rosie will ask on the next call</p>
              )}
            </div>
            {(q.daily || !q.answer) && (
              <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => void clinicianQuestions.remove(p.id, q.id)}><Trash2 /></Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
