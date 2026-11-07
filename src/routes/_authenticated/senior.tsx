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
import { callContext, checkAnswers, detectUrgent, greetingFor } from "@/lib/care";
import { clinicianContext, clinicianQuestions, pendingClinicianQuestions } from "@/lib/clinician-questions";
import { summarizeCheckIn, type CheckInSummary } from "@/lib/checkin.functions";

export const Route = createFileRoute("/_authenticated/senior")({
  beforeLoad: ({ context }) => requireRole(context.account, "senior"),
  head: () => ({
    meta: [
      { title: "Today's check-in — homeBuddy" },
      { name: "description", content: "Press one big button to talk with Rosie, your friendly daily check-in companion." },
      { property: "og:title", content: "Today's check-in — homeBuddy" },
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
  const [showHistory, setShowHistory] = useState(false);
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
    const asked = pendingClinicianQuestions(patient);
    summarize({ data: { transcript, meds: patient.meds.map((m) => m.name), name: patient.name, clinicianQuestions: asked.map((q) => q.text) } })
      .catch((): CheckInSummary => {
        // AI summary unavailable: still save the call so the care team sees it.
        const said = transcript.filter((r) => r.role === "user").map((r) => r.text.trim()).join(" ");
        return {
          meds: patient.meds.map((m) => ({ name: m.name, taken: "unclear" as const })),
          meals: 0, fluids: "unknown", sleepHours: null, mood: null, pain: null, fall: false,
          urgent: [], questions: [], answers: [],
          summary: `Automatic summary unavailable. ${patient.preferredName} said: "${said.slice(0, 600)}"`,
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
            // The AI only reports yes/no/unclear; care.ts applies each question's rule.
            answers: checkAnswers(asked, s.answers ?? []),
          },
          s.questions,
        );
      }).then(async () => {
        const answers = lastSummary.current?.answers ?? [];
        if (answers.length) await clinicianQuestions.saveAnswers(PATIENT_ID, answers).catch(() => {});
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
    voice.start([callContext(patient, state.questions), clinicianContext(patient)].filter(Boolean).join("\n"));
  };

  const greet = greetingFor(new Date());

  const lastLine = rows[rows.length - 1];
  const history = [...patient.checkIns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return (
    <main className="min-h-dvh bg-[image:var(--gradient-sky)] pb-24">
      <section className="relative isolate overflow-hidden px-5 pb-16 pt-10 text-center">
        <svg viewBox="0 0 900 640" preserveAspectRatio="none" className="absolute inset-0 -z-10 size-full" aria-hidden="true">
          <path className="fill-sky-3" d="M0 140 Q60 110 100 160 L120 300 Q200 250 330 300 L360 520 Q450 440 600 400 Q650 350 720 380 L780 420 Q800 250 860 120 Q890 70 900 90 V640 H0Z" />
          <path className="fill-sky-1" opacity="0.85" d="M0 230 Q80 210 110 290 L120 360 Q220 330 330 380 Q360 470 380 520 Q470 470 560 470 Q600 380 690 410 L780 470 Q790 300 850 210 Q890 180 900 200 V640 H0Z" />
        </svg>
        <h1 style={{ textShadow: "0 3px 6px rgb(0 0 0 / 0.3)" }} className="text-5xl font-bold text-scene-ink md:text-6xl">
          {greet}, {patient.preferredName}
        </h1>

        <div className="mt-10 flex flex-col items-center gap-4">
          {!inCall && phase !== "saving" ? (
            <button
              onClick={begin}
              aria-label="Start checkup"
              className="animate-breathe grid size-56 place-items-center rounded-full bg-call-green text-scene-ink shadow-lg transition-transform active:scale-95 md:size-64"
            >
              <Phone className="size-28 fill-current" strokeWidth={0} />
            </button>
          ) : (
            <div className={`grid size-56 place-items-center rounded-full bg-call-green text-scene-ink shadow-lg md:size-64 ${voice.status === "connected" ? "animate-pulse" : ""}`}>
              {voice.status === "connected" ? <Volume2 className="size-24" /> : <Loader2 className="size-20 animate-spin" />}
            </div>
          )}
          <p style={{ textShadow: "0 2px 4px rgb(0 0 0 / 0.3)" }} className="text-3xl font-semibold text-scene-ink">
            {phase === "saving"
              ? "Saving your checkup…"
              : !inCall
                ? "Start Checkup"
                : voice.status === "connecting"
                  ? "Connecting…"
                  : voice.status === "stopping"
                    ? "Saying goodbye…"
                    : "Talking with Rosie"}
          </p>

          {(inCall || phase !== "ready" || result) && (
            <div aria-live="polite" className="w-full max-w-xl rounded-3xl bg-card/95 p-5 text-left text-lg shadow-lg">
              {phase === "done" && result ? (
                <>
                  <h2 className="flex items-center gap-2 text-2xl font-semibold">
                    <Check className="size-7 text-status-green" /> All done for today
                  </h2>
                  <p className="mt-2 leading-relaxed">{result.summary}</p>
                  {result.questions.length > 0 && (
                    <p className="mt-3 text-muted-foreground">
                      Your question{result.questions.length > 1 ? "s were" : " was"} sent to your care team. Rosie will share the answer next time.
                    </p>
                  )}
                </>
              ) : phase === "saving" ? (
                <p className="flex items-center gap-3"><Loader2 className="size-5 animate-spin" /> Sending today's notes to your care team…</p>
              ) : (
                <p className="truncate">
                  {lastLine ? (
                    <>
                      <span className="mr-2 font-bold">{lastLine.role === "assistant" ? "Rosie:" : "You:"}</span>
                      {lastLine.text.length > 140 ? "…" + lastLine.text.slice(-140) : lastLine.text}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Rosie will start talking in a moment…</span>
                  )}
                </p>
              )}
            </div>
          )}

          {inCall && (
            <div className="flex flex-wrap justify-center gap-4">
              <Button variant="outline" size="xl" disabled={voice.status !== "connected"} onClick={() => voice.setMuted(!voice.muted)}>
                {voice.muted ? <MicOff /> : <Mic />} {voice.muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant="destructive" size="xl" className="rounded-full" disabled={voice.status === "stopping"} onClick={voice.stop}>
                <PhoneOff /> End call
              </Button>
            </div>
          )}
          {voice.playbackBlocked && (
            <Button variant="warm" size="xl" onClick={voice.resumePlayback}>
              <Volume2 /> Tap to hear Rosie
            </Button>
          )}
          {voice.error && (
            <p role="alert" className="max-w-md rounded-2xl bg-status-red-soft px-5 py-3 text-lg">{voice.error}</p>
          )}
          <audio ref={voice.audioRef} className="hidden" />

          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="mt-8 rounded-2xl bg-sky-3 px-6 py-3 text-2xl text-scene-ink shadow-md transition-transform active:scale-95"
          >
            Chat History
          </button>
          {showHistory && (
            <div className="w-full max-w-xl space-y-3 rounded-3xl bg-card/95 p-5 text-left shadow-lg">
              {history.length === 0 && <p className="text-lg text-muted-foreground">No checkups yet.</p>}
              {history.map((c) => (
                <div key={c.date} className="border-b border-border pb-3 last:border-0">
                  <p className="font-bold">{new Date(c.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
                  <p className="text-lg">{c.answered ? c.summary : "Missed call"}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-6 rounded-2xl bg-card/90 px-5 py-2 text-lg font-bold">In an emergency, call 911.</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5">
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
      </div>
    </main>
  );
}
