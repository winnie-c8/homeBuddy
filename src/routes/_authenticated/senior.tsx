import { requireRole } from "@/lib/auth";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Check, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loading } from "@/components/status-badge";
import { useLiveVoice, type LiveEvent } from "@/hooks/use-live-voice";
import { care, patientRows, useCare } from "@/lib/care-store";
import { SeniorSetup } from "@/components/senior-setup";
import { callContext, detectUrgent } from "@/lib/care";
import { summarizeCheckIn, type CheckInSummary } from "@/lib/checkin.functions";

export const Route = createFileRoute("/_authenticated/senior")({
  beforeLoad: ({ context }) => requireRole(context.account, "senior"),
  head: () => ({
    meta: [
      { title: "Today's check-in — Hearthline" },
      { name: "description", content: "Press one big button to talk with Rosie, your friendly daily check-in companion." },
      { property: "og:title", content: "Today's check-in — Hearthline" },
      { property: "og:description", content: "A simple daily voice check-in for seniors at home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SeniorPage,
});

type Row = { role: "user" | "assistant"; text: string };

function SeniorPage() {
  const state = useCare();
  const { account } = Route.useRouteContext();
  const PATIENT_ID = state?.patients.find((p) => patientRows().some((r) => r.id === p.id && r.senior_user_id === account.id))?.id ?? "";
  const inviteCode = patientRows().find((r) => r.id === PATIENT_ID)?.invite_code;
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"ready" | "saving" | "done">("ready");
  const [result, setResult] = useState<CheckInSummary | null>(null);
  const rowsRef = useRef<Row[]>([]);
  const alerted = useRef(new Set<string>());
  const lastSummary = useRef<CheckInSummary | null>(null);
  const summarize = useServerFn(summarizeCheckIn);

  const onEvent = (e: LiveEvent) => {
    if (e.type !== "session.input_transcript.delta" && e.type !== "session.output_transcript.delta") return;
    const role = e.type === "session.input_transcript.delta" ? "user" : "assistant";
    const delta = typeof e["delta"] === "string" ? e["delta"] : "";
    if (!delta) return;
    const next = [...rowsRef.current];
    const last = next[next.length - 1];
    if (last && last.role === role) next[next.length - 1] = { role, text: last.text + delta };
    else next.push({ role, text: delta });
    rowsRef.current = next;
    setRows(next);
    if (role === "user") {
      const words = detectUrgent(next[next.length - 1]?.text ?? "").filter((w) => !alerted.current.has(w));
      if (words.length) {
        words.forEach((w) => alerted.current.add(w));
        void care.raiseAlert(PATIENT_ID, `During today's call ${account.displayName} said: "${words.join('", "')}". Please check on her.`);
        toast.error("Your family and care team have been alerted.");
      }
    }
  };

  const voice = useLiveVoice({ onEvent });
  const inCall = voice.status === "connecting" || voice.status === "connected" || voice.status === "stopping";

  useEffect(() => {
    if (voice.status !== "closed" || phase !== "ready" || !voice.hasConnected) return;
    const transcript = rowsRef.current;
    if (!transcript.some((r) => r.role === "user" && r.text.trim())) return;
    const patient = state?.patients.find((p) => p.id === PATIENT_ID);
    if (!patient) return;
    setPhase("saving");
    summarize({ data: { transcript, meds: patient.meds.map((m) => m.name) } })
      .catch((): CheckInSummary => {
        // AI summary unavailable: still save the call so the care team sees it.
        const said = transcript.filter((r) => r.role === "user").map((r) => r.text.trim()).join(" ");
        return {
          meds: patient.meds.map((m) => ({ name: m.name, taken: "unclear" as const })),
          meals: 0, fluids: "unknown", sleepHours: null, mood: null, pain: null, fall: false,
          urgent: [], questions: [],
          summary: `Automatic summary unavailable. The senior said: "${said.slice(0, 600)}"`,
        };
      })
      .then((s) => {
        lastSummary.current = s;
        const urgent = [...new Set([...s.urgent, ...alerted.current])];
        return care.addCheckIn(
          PATIENT_ID,
          {
            date: new Date().toISOString(),
            answered: true,
            meds: s.meds,
            meals: s.meals,
            fluids: s.fluids,
            sleepHours: s.sleepHours,
            mood: s.mood,
            pain: s.pain,
            fall: s.fall,
            urgent,
            summary: s.summary,
            source: "voice",
          },
          s.questions,
        );
      }).then(() => {
        setResult(lastSummary.current);
        setPhase("done");
      })
      .catch(() => {
        setPhase("ready");
        toast.error("We couldn't save today's check-in. Please try the call again.");
      });
  }, [voice.status, voice.hasConnected, phase, state, summarize]);

  if (!state) return <Loading />;
  const patient = state.patients.find((p) => p.id === PATIENT_ID);
  if (!patient) return <SeniorSetup userId={account.id} defaultName={account.displayName} />;

  const begin = () => {
    rowsRef.current = [];
    alerted.current = new Set();
    setRows([]);
    setResult(null);
    setPhase("ready");
    voice.start(callContext(patient, state.questions));
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="mx-auto max-w-3xl px-5 pb-24 pt-12 text-center">
      <h1 className="text-5xl font-semibold md:text-6xl">
        {greet}, {patient.preferredName}.
      </h1>
      <p className="mt-4 text-2xl text-muted-foreground">
        {inCall ? "Rosie is here to talk with you." : `Rosie calls every day at ${patient.callTime}.`}
      </p>

      <div className="my-14 flex flex-col items-center gap-6">
        {!inCall && phase !== "saving" && (
          <button
            onClick={begin}
            className="animate-breathe grid size-56 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
          >
            <span className="flex flex-col items-center gap-3">
              <Phone className="size-14" />
              <span className="font-display text-3xl font-semibold leading-tight">
                Talk to
                <br />
                Rosie
              </span>
            </span>
          </button>
        )}
        {inCall && (
          <>
            <div className="grid size-56 place-items-center rounded-full bg-secondary">
              {voice.status === "connected" ? (
                <Volume2 className="size-20 text-primary" />
              ) : (
                <Loader2 className="size-16 animate-spin text-primary" />
              )}
            </div>
            <p className="text-xl font-bold">
              {voice.status === "connecting" ? "Connecting…" : voice.status === "stopping" ? "Saying goodbye…" : "You're talking with Rosie"}
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" size="xl" disabled={voice.status !== "connected"} onClick={() => voice.setMuted(!voice.muted)}>
                {voice.muted ? <MicOff /> : <Mic />} {voice.muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="destructive" size="xl" className="rounded-full" disabled={voice.status === "stopping"} onClick={voice.stop}>
                <PhoneOff /> End call
              </Button>
            </div>
            {voice.playbackBlocked && (
              <Button variant="warm" size="xl" onClick={voice.resumePlayback}>
                <Volume2 /> Tap to hear Rosie
              </Button>
            )}
          </>
        )}
        {phase === "saving" && (
          <p className="flex items-center gap-3 text-2xl">
            <Loader2 className="size-7 animate-spin" /> Sending today's notes to your care team…
          </p>
        )}
        {voice.error && (
          <p role="alert" className="max-w-md rounded-2xl bg-status-red-soft px-5 py-3 text-lg">
            {voice.error}
          </p>
        )}
        <audio ref={voice.audioRef} className="hidden" />
      </div>

      {phase === "done" && result && (
        <section className="rounded-3xl border border-border bg-card p-8 text-left shadow-[var(--shadow-soft)]">
          <h2 className="flex items-center gap-3 text-3xl font-semibold">
            <Check className="size-8 text-status-green" /> All done for today
          </h2>
          <p className="mt-3 text-xl leading-relaxed">{result.summary}</p>
          {result.questions.length > 0 && (
            <p className="mt-4 text-lg text-muted-foreground">
              Your question{result.questions.length > 1 ? "s were" : " was"} sent to your care team. Rosie will share the answer next time.
            </p>
          )}
        </section>
      )}

      {rows.length > 0 && (
        <section className="mt-10 text-left">
          <h2 className="mb-3 text-xl font-semibold text-muted-foreground">What was said</h2>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <p
                key={i}
                className={
                  r.role === "assistant"
                    ? "rounded-2xl bg-secondary px-5 py-3 text-lg"
                    : "ml-10 rounded-2xl bg-primary px-5 py-3 text-lg text-primary-foreground"
                }
              >
                <span className="mr-2 font-bold">{r.role === "assistant" ? "Rosie:" : "You:"}</span>
                {r.text}
              </p>
            ))}
          </div>
        </section>
      )}

      <section className="mt-16 rounded-3xl border border-border bg-card p-8 text-left">
        <h2 className="flex items-center gap-3 text-2xl font-semibold">
          <ShieldCheck className="size-7 text-primary" /> Who can see my information
        </h2>
        <p className="mt-2 text-lg text-muted-foreground">You choose. You can change this any time.</p>
        {inviteCode && (
          <p className="mt-4 rounded-2xl bg-secondary p-4 text-lg">
            To connect family or your care team, give them this code: <span className="font-mono text-2xl font-bold tracking-widest">{inviteCode}</span>
          </p>
        )}
        {patient.contacts.length === 0 && <p className="mt-4 text-lg text-muted-foreground">No one is connected yet.</p>}
        <ul className="mt-6 divide-y divide-border">
          {patient.contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-xl font-bold">{c.name}</p>
                <p className="text-muted-foreground">{c.relation}</p>
              </div>
              <Switch
                className="scale-150"
                checked={patient.sharedWith.includes(c.id)}
                onCheckedChange={(v) => void care.setShared(patient.id, c.id, v)}
                aria-label={`Share with ${c.name}`}
              />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
