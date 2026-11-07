import { requireRole } from "@/lib/auth";
import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import type React from "react";
import patientRectangles from "@/assets/patient-rectangles.svg.asset.json";
import { ArrowLeft, ChevronDown, Phone, Plus, Send, Trash2, AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loading, StatusBadge, StatusDot } from "@/components/status-badge";
import { clinicianQuestions, clinicianQuestionsOf, everyDaysOf, frequencyLabel, type ClinicianQuestion } from "@/lib/clinician-questions";
import { care, useCare } from "@/lib/care-store";
import { questionHistory, checkInStatus, findings, patientStatus, type CheckIn, type FlagIf, type Patient } from "@/lib/care";

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
    <img src={patientRectangles.url} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-fill" />
    <main className="relative mx-auto max-w-5xl px-5 pb-24 pt-8">
      <Link to="/care" className="inline-flex items-center gap-1 text-sm text-pt-inner hover:text-scene-ink">
        <ArrowLeft className="size-4" /> All patients
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <h1 className="text-6xl font-bold text-pt-inner md:text-7xl">{p.name}</h1>
        <StatusBadge status={patientStatus(p)} />
      </div>
      <dl className="mt-4 flex flex-wrap gap-3 text-lg">
        <Info label="Age" value={String(p.age)} />
        <Info label="City" value={p.city} />
        {p.conditions.length > 0 && <Info label="Conditions" value={p.conditions.join(", ")} />}
        <Info label="Daily call" value={p.callTime} icon />
      </dl>

      <Flags checkIns={checkIns} />

      <AskRosie p={p} />

      <Panel title="Graphs">
        <div className="grid gap-5 md:grid-cols-2">
          {clinicianQuestionsOf(p).map((q) => (
            <QuestionGraph key={q.id} p={p} q={q} />
          ))}
          <Trend title="Medication adherence (%)" data={checkIns} pick={(c) => (c.answered && c.meds.length ? Math.round((c.meds.filter((m) => m.taken === "yes").length / c.meds.length) * 100) : null)} domain={[0, 100]} color="var(--chart-1)" />
          <Trend title="Mood (1–5)" data={checkIns} pick={(c) => c.mood} domain={[1, 5]} color="var(--chart-2)" />
          <Trend title="Sleep (hours)" data={checkIns} pick={(c) => c.sleepHours} domain={[0, 10]} color="var(--chart-3)" />
          <Trend title="Appetite (meals/day)" data={checkIns} pick={(c) => (c.answered ? c.meals : null)} domain={[0, 3]} color="var(--chart-4)" />
        </div>
      </Panel>

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
          <li key={idx} className="flex items-center justify-between gap-2 bg-card px-3 py-2">
            {i}
            <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setItems(items.filter((_, j) => j !== idx))}><Trash2 /></Button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a plan item" className="rounded-none bg-card" />
        <Button className="rounded-none bg-pt-btn text-primary-foreground hover:bg-pt-ink" onClick={() => { if (newItem.trim()) { setItems([...items, newItem.trim()]); setNewItem(""); } }}><Plus /> Add</Button>
      </div>
      <Textarea className="mt-4 rounded-none bg-card" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed, in plain words (e.g. 'Take your water pill at lunch instead of breakfast')" />
      <Button
        className="mt-3 rounded-none bg-pt-btn text-primary-foreground hover:bg-pt-ink"
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
  const [everyDays, setEveryDays] = useState("");
  const [redAfter, setRedAfter] = useState("");
  const [kind, setKind] = useState<"yesno" | "number">("yesno");
  const [unit, setUnit] = useState("");
  const [below, setBelow] = useState("");
  const [above, setAbove] = useState("");
  const hasRule = kind === "yesno" ? !!flagIf : below !== "" || above !== "";
  const { account } = useRouteContext({ from: "/_authenticated" });
  const list = clinicianQuestionsOf(p).reverse();
  return (
    <Panel title={`Ask ${p.preferredName} a question`}>
      <p className="text-sm">Rosie asks these and brings back {p.preferredName}'s answer and words. Your "flag if" rule decides the colour, not the AI. Each question gets its own graph and table in Graphs below.</p>
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          setBusy(true);
          clinicianQuestions
            .add(
              p.id,
              text.trim(),
              account.displayName,
              kind === "number"
                ? { kind, unit: unit.trim() || undefined, below: below === "" ? undefined : Number(below), above: above === "" ? undefined : Number(above), everyDays: everyDays ? Number(everyDays) : undefined, redAfter: redAfter ? Number(redAfter) : undefined }
                : { flagIf: flagIf || undefined, everyDays: everyDays ? Number(everyDays) : undefined, redAfter: redAfter ? Number(redAfter) : undefined },
            )
            .then(() => setText(""))
            .finally(() => setBusy(false));
        }}
      >
        <Input className="min-w-64 flex-1 rounded-none bg-card" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type question here… e.g. Did you do your dialysis today?" />
        <div className="flex items-center gap-2 bg-pt-btn px-3 py-1 text-sm text-primary-foreground" role="group" aria-label="Answer type">
          Answer:
          {(["yesno", "number"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={kind === v} onClick={() => setKind(v)} className={`px-3 py-0.5 font-bold ${kind === v ? "bg-primary text-primary-foreground" : "bg-pt-inner/30"}`}>
              {v === "yesno" ? "yes / no" : "number"}
            </button>
          ))}
        </div>
        {kind === "number" ? (
          <div className="flex flex-wrap items-center gap-2 bg-pt-btn px-3 py-1 text-sm text-primary-foreground" role="group" aria-label="Number rule">
            Unit
            <Input className="h-8 w-24 rounded-none bg-card text-foreground" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="glasses" />
            Flag if below
            <Input className="h-8 w-16 rounded-none bg-card text-foreground" type="number" value={below} onChange={(e) => setBelow(e.target.value)} />
            or above
            <Input className="h-8 w-16 rounded-none bg-card text-foreground" type="number" value={above} onChange={(e) => setAbove(e.target.value)} />
          </div>
        ) : (
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
        )}
        <label className="flex items-center gap-2 bg-pt-btn px-3 py-1 text-sm text-primary-foreground">
          Turns red after
          <Input className="h-8 w-14 rounded-none bg-card text-foreground" type="number" min={1} value={redAfter} onChange={(e) => setRedAfter(e.target.value)} placeholder="–" />
          days in a row
          <span className="opacity-80">
            {!hasRule ? "(set a flag rule first)" : redAfter === "1" ? "(right away)" : !redAfter ? "(blank = never)" : ""}
          </span>
        </label>
        <label className="flex items-center gap-2 bg-pt-btn px-3 py-1 text-sm text-primary-foreground">
          Ask every
          <Input className="h-8 w-14 rounded-none bg-card text-foreground" type="number" min={1} value={everyDays} onChange={(e) => setEveryDays(e.target.value)} placeholder="–" />
          days
          <span className="opacity-80">{everyDays === "1" ? "(every call)" : !everyDays ? "(blank = once)" : ""}</span>
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
                {q.askedBy} · {format(new Date(q.createdAt), "MMM d, h:mm a")} · {frequencyLabel(q)} · {q.kind === "number"
                  ? `Number${q.unit ? ` (${q.unit})` : ""} · ${[q.below !== undefined ? `flag below ${q.below}` : "", q.above !== undefined ? `flag above ${q.above}` : ""].filter(Boolean).join(", ") || "no flag"}`
                  : q.flagIf ? `Flag if ${q.flagIf} or unclear` : "No flag"}
                {(q.flagIf || q.below !== undefined || q.above !== undefined) && ` · ${q.redAfter === 1 ? "Red right away" : q.redAfter ? `Red after ${q.redAfter} days in a row` : "Never red"}`}
              </p>
              {q.answer ? (
                <p className="mt-2 text-sm"><span className="font-bold">{p.preferredName} said:</span> {q.answer}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Waiting — Rosie will ask on the next call</p>
              )}
            </div>
            {(everyDaysOf(q) >= 1 || !q.answer) && (
              <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => void clinicianQuestions.remove(p.id, q.id)}><Trash2 /></Button>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * One graph per clinician question, one bar/point per day it was answered.
 * Yes/no: a bar per day (green = fine, red = flagged, grey = unclear).
 * Number: the amount per day with the clinician's limits drawn as dashed lines.
 */
function QuestionGraph({ p, q }: { p: Patient; q: ClinicianQuestion }) {
  const [view, setView] = useState<"graph" | "table">("graph");
  const all = questionHistory(p, q.text);
  const rule =
    q.kind === "number"
      ? [q.unit, q.below !== undefined ? `flag below ${q.below}` : "", q.above !== undefined ? `flag above ${q.above}` : ""].filter(Boolean).join(" · ")
      : q.flagIf ? `flag if ${q.flagIf}` : "no flag";
  const header = (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <p className="font-bold">“{q.text}”</p>
        <p className="text-xs text-muted-foreground">{q.kind === "number" ? "Number" : "Yes / no"} · {rule} · {frequencyLabel(q)}</p>
      </div>
      <div className="flex shrink-0 text-xs font-bold" role="group" aria-label="View">
        {(["graph", "table"] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`px-2.5 py-1 ${view === v ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {v === "graph" ? "Graph" : "Table"}
          </button>
        ))}
      </div>
    </div>
  );
  const h = all.slice(-14);
  if (view === "table")
    return (
      <div className="bg-card p-5">
        {header}
        <AnswerTable q={q} rows={all} />
      </div>
    );
  if (!h.length)
    return (
      <div className="bg-card p-5">
        {header}
        <div className="flex h-32 items-center justify-center border-2 border-dashed border-border text-sm text-muted-foreground">
          {q.kind === "number" ? `Graph: ${q.unit || "amount"} per day${q.below !== undefined ? `, flag line at ${q.below}` : ""}${q.above !== undefined ? `, flag line at ${q.above}` : ""}` : "Graph: one bar per day (green = fine, red = flagged)"} — fills in after the first call
        </div>
      </div>
    );
  const last3 = h.slice(-3);
  const fine = last3.filter((x) => !x.flagged).length;
  const colour = (x: (typeof h)[number]) => (x.answer === "unclear" && x.value === null ? "var(--muted-foreground)" : x.flagged ? "var(--status-red)" : "var(--status-green)");
  const rows = h.map((x) => ({
    day: format(new Date(x.date), "EEE d"),
    v: q.kind === "number" ? x.value : 1,
    label: q.kind === "number" ? (x.value ?? "unclear") : x.answer,
    said: x.said,
    fill: colour(x),
  }));
  const tip = ({ active, payload }: { active?: boolean | undefined; payload?: readonly { payload?: (typeof rows)[number] }[] | undefined }) => {
      const r = active ? payload?.[0]?.payload : undefined;
      return r ? (
        <div className="border border-border bg-card px-3 py-2 text-xs shadow">
          <p className="font-bold">{r.day}: {String(r.label)}{q.kind === "number" && q.unit && typeof r.label === "number" ? ` ${q.unit}` : ""}</p>
          {r.said && <p>“{r.said}”</p>}
        </div>
      ) : null;
    };
  return (
    <div className="bg-card p-5">
      {header}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          {q.kind === "number" ? (
            <LineChart data={rows} margin={{ left: -20, right: 8, top: 6 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} allowDecimals={false} />
              <Tooltip content={tip} />
              {q.below !== undefined && <ReferenceLine y={q.below} stroke="var(--status-red)" strokeDasharray="4 4" label={{ value: `flag below ${q.below}`, fontSize: 10, fill: "var(--status-red)", position: "insideBottomRight" }} />}
              {q.above !== undefined && <ReferenceLine y={q.above} stroke="var(--status-red)" strokeDasharray="4 4" label={{ value: `flag above ${q.above}`, fontSize: 10, fill: "var(--status-red)", position: "insideTopRight" }} />}
              <Line type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={2.5} connectNulls dot={(d: { cx?: number; cy?: number; index?: number }) => (
                <circle key={d.index} cx={d.cx} cy={d.cy} r={5} fill={rows[d.index ?? 0]?.fill} stroke="none" />
              )} />
            </LineChart>
          ) : (
            <BarChart data={rows} margin={{ left: -20, right: 8, top: 6 }}>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis hide domain={[0, 1]} />
              <Tooltip content={tip} cursor={{ fill: "var(--muted)" }} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]} label={{ position: "insideTop", fontSize: 11, fill: "white", formatter: (_: unknown, __: unknown, i: number) => rows[i]?.label }}>
                {rows.map((r, i) => <Cell key={i} fill={r.fill} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Fine {fine} of the last {last3.length} time{last3.length === 1 ? "" : "s"} · green = fine, red = flagged, grey = unclear
      </p>
    </div>
  );
}

/** Every saved answer to one question, newest first: the raw data behind the graph. */
function AnswerTable({ q, rows }: { q: ClinicianQuestion; rows: ReturnType<typeof questionHistory> }) {
  return (
    <div className="max-h-56 overflow-y-auto text-sm">
      <table className="w-full text-left">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-1 pr-3">Day</th>
            <th className="py-1 pr-3">Answer</th>
            <th className="py-1 pr-3">Their words</th>
            <th className="py-1">Flag</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-muted-foreground">No answers yet. Each call adds a row here.</td>
            </tr>
          )}
          {[...rows].reverse().map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-1 pr-3 whitespace-nowrap">{format(new Date(r.date), "EEE MMM d")}</td>
              <td className="py-1 pr-3 font-semibold">{q.kind === "number" ? (r.value === null ? "unclear" : `${r.value}${q.unit ? ` ${q.unit}` : ""}`) : r.answer}</td>
              <td className="py-1 pr-3">{r.said ? `“${r.said}”` : "—"}</td>
              <td className="py-1">{r.flagged ? <span className="font-bold text-status-red">Flagged</span> : "Fine"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
