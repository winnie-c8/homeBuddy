import process from "node:process";

// Voice calls run on Google's Gemini Live API with the project's own GEMINI_API_KEY.
// The browser streams 16 kHz PCM audio to this relay; the relay keeps the key server-side.

export type LiveConfig = { key: string; model: string; voice: string };

const GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025";
const GEMINI_VOICE = "Aoede";
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

const baseInstructions = `You are Rosie, a warm, patient daily check-in companion for an older adult living at home.
Speak slowly and clearly in simple English. Use short sentences. Ask one question at a time and wait.
If the person seems confused, gently repeat or rephrase. Never rush them.
Your job in this call, in order: greet them by name; ask how they slept; confirm each medication listed below
one by one (did they take it today?); ask about meals and drinking water or fluids; ask about any pain (0 to 10);
ask about their mood; ask if they have had any falls or near-falls; explain any care plan changes and answers from
their care team listed below in plain language; ask if they have any questions for their care team; then thank them and say goodbye.
Safety: You never give medical advice, diagnoses, or dosing guidance. If asked, say you will pass the question to their care team.
If they mention a fall, chest pain, trouble breathing, or feeling very unwell, tell them calmly that you are alerting
their care team and family right away, and if it is an emergency they should call 911.
Stop talking and listen when the person interrupts.`;

export function buildInstructions(context: string) {
  return context ? `${baseInstructions}\n\nToday's information about this person (from the app):\n${context}` : baseInstructions;
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
