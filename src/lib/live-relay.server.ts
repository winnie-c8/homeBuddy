import process from "node:process";
import { SHORT_CALL_MARKER } from "./care";

// Voice calls run on Google's Gemini Live API with the project's own GEMINI_API_KEY.
// The browser streams 16 kHz PCM audio to this relay; the relay keeps the key server-side.

export type LiveConfig = { key: string; model: string; voice: string };

const GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";
const GEMINI_VOICE = "Kore";
const GEMINI_LIVE_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export type LiveSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onMessage(handler: (data: unknown) => void): void;
  onClose(handler: () => void): void;
  onError(handler: () => void): void;
};

export type LiveExecutionContext = { waitUntil(task: Promise<unknown>): void };

type WorkerSocket = WebSocket & { accept(): void };
declare const WebSocketPair: { new (): { 0: WorkerSocket; 1: WorkerSocket } };

export function getLiveConfig(): LiveConfig {
  const key = process.env["GEMINI_API_KEY"] ?? "";
  if (!key) throw new Error("Missing GEMINI_API_KEY");
  return { key, model: GEMINI_LIVE_MODEL, voice: GEMINI_VOICE };
}

export function validateLiveUpgrade(request: Request, options: { allowMissingOrigin?: boolean } = {}): Response | null {
  const origin = request.headers.get("origin");
  if (origin === null ? !options.allowMissingOrigin : origin !== new URL(request.url).origin) {
    return new Response("Voice connection origin rejected", { status: 403 });
  }
  if (request.method !== "GET" || request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket required", { status: 426 });
  }
  return null;
}

function workerSocket(socket: WorkerSocket): LiveSocket {
  return {
    get readyState() {
      return socket.readyState;
    },
    send: (data) => socket.send(data),
    close: (code, reason) => socket.close(code, reason),
    onMessage: (handler) => socket.addEventListener("message", (event) => handler(event.data)),
    onClose: (handler) => socket.addEventListener("close", handler),
    onError: (handler) => socket.addEventListener("error", handler),
  };
}

export function handleLiveRequest(request: Request): Response {
  const waitUntil = (request as Request & Partial<LiveExecutionContext>).waitUntil;
  let config: LiveConfig;
  try {
    config = getLiveConfig();
  } catch {
    return new Response("Voice is not configured", { status: 503 });
  }
  const rejected = validateLiveUpgrade(request);
  if (rejected) return rejected;
  const pair = new WebSocketPair();
  pair[1].accept();
  bindLiveConnection(workerSocket(pair[1]), config, { waitUntil: waitUntil ?? (() => {}) });
  const response: ResponseInit & { webSocket: WebSocket } = { status: 101, webSocket: pair[0] };
  return new Response(null, response);
}

const fullInstructions = `You are Rosie, a warm, friendly daily check-in companion for an older adult living at home — like a kind neighbour
who rings every day. Talk the way a caring friend does on the phone: relaxed, natural, a little chatty. Use contractions, small
reactions ("Oh good!", "Aw, I'm sorry, that sounds rough"), and their name now and then. Keep your turns short — one or two sentences —
then let them talk. Ask one question at a time.

Open with a greeting for the time of day given below (good morning / good afternoon / good evening), using their name, and ask how they're doing.
If there are things from recent calls listed below, bring them up early and caringly, e.g. "Yesterday you mentioned your head hurt — is it still bothering you?"

You MUST get a clear, direct answer to every item below. Weave them into the conversation with friendly transitions
("Speaking of breakfast…", "Before I forget…"), but the question itself must be plain and specific — never guess or assume an answer:
- Sleep: "About how many hours did you sleep last night?"
- Each medication listed below, by name: "Did you take your [medicine] today?" (yes or no)
- Meals: "How many meals have you had today?"
- Fluids: "Have you been drinking enough water today?"
- Pain: "Do you have any pain today? On a scale from 0 to 10, how bad is it?"
- Mood: "How's your mood today — good, okay, or low?"
- Falls: "Have you had any falls or near-falls since we last talked?"
- Any care plan changes or care team answers listed below — explain them simply. Share each one only once: never repeat anything marked "Already answered on an earlier call", and don't re-ask about issues it already settled unless they bring it up.
- Questions from the care team listed below: ask EVERY one, one at a time, with a friendly lead-in ("Oh, your care team wanted me to ask…").
  Keep the meaning exactly the same, ask it plainly, and get a clear answer before moving on. Don't skip any, and don't comment on what the answer means.
- Questions: "Is there anything you'd like me to ask your care team?"
Clear answers matter. An answer is NOT clear if it is vague ("I think so", "maybe", "not much", "sort of"), off-topic, cut off,
hard to hear, or missing the detail asked for (a number, a yes/no, which medicine). When that happens, re-ask kindly in simpler words —
offer choices if it helps ("Was that a yes or a no?", "More like 2 hours, or closer to 6?"). Re-ask up to two more times.
If it's still unclear, say "No problem, I'll let your care team know we weren't sure" and move on. This applies to every
check-in item and every care-team question. Never fill in or guess an answer yourself.
Briefly repeat back important answers so nothing is misunderstood. When everything is covered, thank them warmly and say goodbye until tomorrow.

Safety: You never give medical advice, diagnoses, or dosing guidance. If asked, say you'll pass the question to their care team.
If they mention a fall, chest pain, trouble breathing, or feeling very unwell, tell them calmly that you're alerting
their care team and family right away, and if it is an emergency they should call 911.
Stop talking and listen when the person interrupts.`;

/** Short call: greeting, the care team's questions, goodbye (patients with "Short call" on). */
const shortInstructions = `You are Rosie, a warm, friendly daily check-in companion for an older adult living at home — like a kind neighbour
who rings every day. Keep it brief and kind: one or two short sentences per turn, one question at a time.

This is a SHORT call. Ask ONLY these, in order, then say goodbye:
1. Greet them for the time of day given below, using their name, and ask how they're doing. Listen and react kindly in one sentence.
2. Questions from the care team listed below: ask EVERY one, one at a time, plainly, with a short lead-in ("Your care team wanted me to ask…").
   Keep the meaning exactly the same and get a clear answer (yes/no, or a number if it asks for an amount).
   If an answer is vague, re-ask once in simpler words ("Was that a yes or a no?"). If still unclear, say "No problem, I'll let your care team know" and move on.
3. If answers from the care team or care plan changes are listed below, share each one simply and kindly (only once).
4. Ask: "Is there anything you'd like me to ask your care team?" If they ask something, repeat it back so it's passed on exactly, and say their care team will answer on a later call. Never answer medical questions yourself.
Do NOT ask about sleep, meals, water, pain, mood or falls unless they bring it up.
When done, thank them warmly and say goodbye until tomorrow.

Safety: You never give medical advice, diagnoses, or dosing guidance. If asked, say you'll pass the question to their care team.
If they mention a fall, chest pain, trouble breathing, or feeling very unwell, tell them calmly that you're alerting
their care team and family right away, and if it is an emergency they should call 911.
Stop talking and listen when the person interrupts.`;

export function buildInstructions(context: string) {
  // The app marks short-call patients in their call notes (see SHORT_CALL_MARKER in care.ts).
  const base = context.includes(SHORT_CALL_MARKER) ? shortInstructions : fullInstructions;
  return context ? `${base}\n\nToday's information about this person (from the app):\n${context}` : base;
}

async function asText(data: unknown): Promise<string> {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) return new TextDecoder().decode(data as Uint8Array);
  if (typeof Blob !== "undefined" && data instanceof Blob) return data.text();
  return String(data);
}

type GeminiMessage = {
  setupComplete?: unknown;
  serverContent?: {
    modelTurn?: { parts?: { inlineData?: { data?: string; mimeType?: string }; text?: string }[] };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    interrupted?: boolean;
    turnComplete?: boolean;
  };
  goAway?: unknown;
  error?: { message?: string };
};

export function bindLiveConnection(browser: LiveSocket, config: LiveConfig, ctx: LiveExecutionContext) {
  let gemini: WebSocket | undefined;
  let ready = false;
  let closed = false;
  let resolveDone: () => void = () => {};
  ctx.waitUntil(new Promise<void>((r) => (resolveDone = r)));

  const emit = (event: object) => {
    if (browser.readyState === 1) {
      try {
        browser.send(JSON.stringify(event));
      } catch {
        /* browser too slow; drop */
      }
    }
  };
  const toGemini = (msg: object) => {
    if (gemini?.readyState === 1) gemini.send(JSON.stringify(msg));
  };
  const finish = (reason?: string) => {
    if (closed) return;
    closed = true;
    if (reason) emit({ type: "app.error", error: { message: reason } });
    emit({ type: "app.closed" });
    try {
      gemini?.close(1000);
    } catch {
      /* ignore */
    }
    try {
      browser.close(1000);
    } catch {
      /* ignore */
    }
    resolveDone();
  };

  function open(context: string) {
    const ws = new WebSocket(`${GEMINI_LIVE_URL}?key=${encodeURIComponent(config.key)}`);
    gemini = ws;
    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          setup: {
            model: `models/${config.model}`,
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice } } },
              // Native-audio models "think" before speaking by default, which adds seconds of delay.
              thinkingConfig: { thinkingBudget: 0 },
            },
            // Reply as soon as the person stops talking instead of waiting for a long silence.
            realtimeInputConfig: {
              automaticActivityDetection: {
                startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
                endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",
                prefixPaddingMs: 100,
                silenceDurationMs: 500,
              },
            },
            systemInstruction: { parts: [{ text: buildInstructions(context) }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        }),
      );
    });
    ws.addEventListener("message", (event) => {
      void asText(event.data).then((raw) => {
        let msg: GeminiMessage;
        try {
          msg = JSON.parse(raw) as GeminiMessage;
        } catch {
          return;
        }
        if (msg.error) return finish("The voice service rejected the call.");
        if (msg.setupComplete !== undefined && !ready) {
          ready = true;
          emit({ type: "app.ready" });
          toGemini({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: "The call has just connected. Greet me warmly by name and begin the check-in." }] }],
              turnComplete: true,
            },
          });
          return;
        }
        const sc = msg.serverContent;
        if (!sc) return;
        if (sc.interrupted) emit({ type: "app.interrupted" });
        for (const part of sc.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) emit({ type: "app.audio", data: part.inlineData.data });
        }
        if (sc.inputTranscription?.text) emit({ type: "session.input_transcript.delta", delta: sc.inputTranscription.text });
        if (sc.outputTranscription?.text) emit({ type: "session.output_transcript.delta", delta: sc.outputTranscription.text });
      });
    });
    ws.addEventListener("close", (event) => {
      const why = (event as CloseEvent).reason;
      if (!closed) console.error("Gemini Live closed", (event as CloseEvent).code, why);
      finish(closed ? undefined : ready ? undefined : "Voice could not start. Please check the Gemini key and try again.");
    });
    ws.addEventListener("error", () => finish("Voice connection to Google failed."));
  }

  browser.onMessage((data) => {
    void asText(data).then((raw) => {
      let event: { type?: string; context?: unknown; data?: unknown };
      try {
        event = JSON.parse(raw);
      } catch {
        return;
      }
      if (event.type === "app.start" && !gemini) {
        open(typeof event.context === "string" ? event.context.slice(0, 6000) : "");
      } else if (event.type === "app.audio" && ready && typeof event.data === "string") {
        toGemini({ realtimeInput: { audio: { data: event.data, mimeType: "audio/pcm;rate=16000" } } });
      } else if (event.type === "session.close") {
        finish();
      }
    });
  });
  browser.onClose(() => finish());
  browser.onError(() => finish());
}
