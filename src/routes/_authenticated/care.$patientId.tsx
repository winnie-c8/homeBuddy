import { requireRole } from "@/lib/auth";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, Phone, Plus, Send, Trash2, AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loading, StatusBadge, StatusDot } from "@/components/status-badge";
import { clinicianQuestions, clinicianQuestionsOf } from "@/lib/clinician-questions";
import { care, useCare } from "@/lib/care-store";
import { checkInStatus, patientStatus, type CheckIn, type FlagIf, type Patient } from "@/lib/care";

export const Route = createFileRoute("/_authenticated/care/$patientId")({
  beforeLoad: ({ context }) => requireRole(context.account, "care_team"),
  head: () => ({
    meta: [
      { title: "Patient details — Hearthline" },
      { name: "description", content: "Trends, flagged risks, questions and care plan for one patient." },
      { property: "og:title", content: "Patient details — Hearthline" },
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
    <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <Link to="/care" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All patients
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-4xl font-semibold">{p.name}</h1>
        <StatusBadge status={patientStatus(p)} />
      </div>
      <p className="mt-1 text-muted-foreground">
        {p.age} · {p.city} · {p.conditions.join(", ")} · <Phone className="inline size-3.5" /> Daily call {p.callTime}
      </p>

      <Flags checkIns={checkIns} />

      <section className="mt-8 grid gap-5 md:grid-cols-2">
        <Trend title="Medication adherence (%)" data={checkIns} pick={(c) => (c.answered && c.meds.length ? Math.round((c.meds.filter((m) => m.taken === "yes").length / c.meds.length) * 100) : null)} domain={[0, 100]} color="var(--chart-1)" />
        <Trend title="Mood (1–5)" data={checkIns} pick={(c) => c.mood} domain={[1, 5]} color="var(--chart-2)" />
        <Trend title="Sleep (hours)" data={checkIns} pick={(c) => c.sleepHours} domain={[0, 10]} color="var(--chart-3)" />
        <Trend title="Appetite (meals/day)" data={checkIns} pick={(c) => (c.answered ? c.meals : null)} domain={[0, 3]} color="var(--chart-4)" />
      </section>

      <AskRosie p={p} />

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-border bg-card p-6">
          <h2 className="text-2xl font-semibold">Questions from {p.preferredName}</h2>
          <p className="text-sm text-muted-foreground">Answers are explained on the next call.</p>
          <div className="mt-4 space-y-4">
            {questions.length === 0 && <p className="text-muted-foreground">No questions yet.</p>}
            {questions.map((q) => <QuestionItem key={q.id} q={q} />)}
          </div>
        </section>
        <PlanEditor p={p} />
      </div>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold">Check-in history</h2>
        <ul className="mt-4 divide-y divide-border">
          {[...checkIns].reverse().map((c) => (
            <li key={c.id} className="flex gap-4 py-3">
              <StatusDot status={checkInStatus(c)} className="mt-1.5 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(c.date), "EEE MMM d, h:mm a")} {c.source === "voice" && "· voice call"}
                </p>
                <p>{c.summary}</p>
                {c.answered && c.meds.some((m) => m.taken !== "yes") && (
                  <p className="text-sm text-accent">Not confirmed: {c.meds.filter((m) => m.taken !== "yes").map((m) => m.name).join(", ")}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
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
    <div className="rounded-3xl border border-border bg-card p-5">
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
    <div className="rounded-2xl bg-muted p-4">
      <p className="font-bold">"{q.text}"</p>
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
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Write an answer in plain language" className="bg-card" />
          <Button type="submit" size="icon" aria-label="Send answer"><Send /></Button>
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
    <section className="rounded-3xl border border-border bg-card p-6">
      <h2 className="text-2xl font-semibold">Care plan</h2>
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
    </section>
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
    <section className="mt-8 rounded-3xl border border-border bg-card p-6">
      <h2 className="text-2xl font-semibold">{p.preferredName}'s check-in questions</h2>
      <p className="text-sm text-muted-foreground">Rosie asks these as yes/no questions and brings back {p.preferredName}'s words. Your "flag if" rule decides the colour, not the AI.</p>
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
        <Input className="min-w-64 flex-1" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Did you do your dialysis today?" />
        <label className="flex items-center gap-2 text-sm">
          Flag if
          <select className="rounded-md border border-input bg-background px-2 py-2" value={flagIf} onChange={(e) => setFlagIf(e.target.value as "" | FlagIf)}>
            <option value="">never (just record)</option>
            <option value="no">answer is No</option>
            <option value="yes">answer is Yes</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4" checked={daily} onChange={(e) => setDaily(e.target.checked)} /> Ask every day
        </label>
        <Button type="submit" disabled={busy || !text.trim()}><Plus /> Add question</Button>
      </form>
      <ul className="mt-4 space-y-3">
        {list.length === 0 && <li className="text-muted-foreground">No questions queued.</li>}
        {list.map((q) => (
          <li key={q.id} className="flex items-start justify-between gap-3 rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">"{q.text}"</p>
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
    </section>
  );
}
