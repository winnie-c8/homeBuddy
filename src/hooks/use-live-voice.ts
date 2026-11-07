import { useCallback, useEffect, useRef, useState } from "react";

// Browser side of the Gemini Live voice call: captures 16 kHz mic audio, plays 24 kHz replies.

export type LiveEvent = {
  type: string;
  error?: { message?: string };
  [key: string]: unknown;
};

type LiveState = {
  status: "idle" | "connecting" | "connected" | "stopping" | "closed";
  error: string | null;
  hasConnected: boolean;
  muted: boolean;
  playbackBlocked: boolean;
};

const initialState: LiveState = { status: "idle", error: null, hasConnected: false, muted: false, playbackBlocked: false };

export function useLiveVoice(options: { url?: string; onEvent?: (event: LiveEvent) => void } = {}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const controller = useRef<ReturnType<typeof createLiveVoice> | null>(null);
  const latest = useRef(options);
  const [call, setCall] = useState(initialState);

  useEffect(() => {
    latest.current = options;
  });
  useEffect(
    () => () => {
      controller.current?.stop();
      controller.current = null;
    },
    [],
  );

  const start = useCallback((context?: string) => {
    if (controller.current) return;
    const endpoint = new URL(latest.current.url ?? "/api/live", window.location.href);
    endpoint.protocol = endpoint.protocol === "https:" ? "wss:" : "ws:";
    const voice = createLiveVoice(endpoint.href, context ?? "", (event) => {
      if (controller.current !== voice) return;
      if (event.type === "app.connected") setCall((p) => ({ ...p, status: "connected", hasConnected: true }));
      else if (event.type === "app.stopping") setCall((p) => ({ ...p, status: "stopping" }));
      else if (event.type === "app.closed") {
        controller.current = null;
        setCall((p) => ({ ...p, status: "closed", muted: false, playbackBlocked: false }));
      } else if (event.type === "app.playback.blocked" || event.type === "app.playback.resumed")
        setCall((p) => ({ ...p, playbackBlocked: event.type === "app.playback.blocked" }));
      else if (event.type === "app.error") setCall((p) => ({ ...p, error: event.error?.message ?? "Voice request failed." }));
      try {
        latest.current.onEvent?.(event);
      } catch {
        console.error("Live UI event handler failed");
      }
    });
    controller.current = voice;
    setCall({ ...initialState, status: "connecting" });
    void voice.start();
  }, []);

  const stop = useCallback(() => controller.current?.stop(), []);
  const setMuted = useCallback((muted: boolean) => {
    if (controller.current?.setMuted(muted)) setCall((p) => ({ ...p, muted }));
  }, []);
  const resumePlayback = useCallback(() => void controller.current?.resumePlayback(), []);

  return { ...call, audioRef, start, stop, setMuted, resumePlayback };
}

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function createLiveVoice(url: string, context: string, onEvent: (e: LiveEvent) => void) {
  let state: "idle" | "starting" | "active" | "stopping" | "closed" = "idle";
  let socket: WebSocket | undefined;
  let mic: MediaStream | undefined;
  let inCtx: AudioContext | undefined;
  let outCtx: AudioContext | undefined;
  let processor: ScriptProcessorNode | undefined;
  let playAt = 0;
  let muted = false;
  const sources = new Set<AudioBufferSourceNode>();

  function release() {
    if (state === "closed") return;
    state = "closed";
    window.removeEventListener("pagehide", stop);
    mic?.getTracks().forEach((t) => t.stop());
    processor?.disconnect();
    void inCtx?.close().catch(() => {});
    void outCtx?.close().catch(() => {});
    socket?.close();
    onEvent({ type: "app.closed" });
  }

  function stop() {
    if (state === "stopping" || state === "closed") return;
    state = "stopping";
    onEvent({ type: "app.stopping" });
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "session.close" }));
    release();
  }

  function fail(message: string) {
    if (state === "stopping" || state === "closed") return;
    onEvent({ type: "app.error", error: { message } });
    stop();
  }

  function play(b64: string) {
    if (!outCtx) return;
    const bin = atob(b64);
    const pcm = new Int16Array(bin.length >> 1);
    for (let i = 0; i < pcm.length; i++) pcm[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16 >> 16;
    const buf = outCtx.createBuffer(1, pcm.length, 24000);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const src = outCtx.createBufferSource();
    src.buffer = buf;
    src.connect(outCtx.destination);
    playAt = Math.max(playAt, outCtx.currentTime + 0.05);
    src.start(playAt);
    playAt += buf.duration;
    sources.add(src);
    src.onended = () => sources.delete(src);
  }

  function interrupt() {
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    sources.clear();
    playAt = 0;
  }

  async function start() {
    if (state !== "idle") return;
    state = "starting";
    window.addEventListener("pagehide", stop);
    try {
      outCtx = new AudioContext({ sampleRate: 24000 });
      inCtx = new AudioContext({ sampleRate: 16000 });
      void outCtx.resume();
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      return fail("Please allow the microphone so Rosie can hear you.");
    }
    if (state !== "starting") return release();
    socket = new WebSocket(url);
    socket.onopen = () => socket?.send(JSON.stringify({ type: "app.start", context }));
    socket.onerror = () => fail("Voice connection failed. Please try again.");
    socket.onclose = () => {
      if (state === "starting" || state === "active") fail("The voice call ended unexpectedly. Please try again.");
    };
    socket.onmessage = (m) => {
      let e: LiveEvent;
      try {
        e = JSON.parse(String(m.data));
      } catch {
        return;
      }
      if (e.type === "app.ready") {
        if (state !== "starting" || !inCtx || !mic) return;
        state = "active";
        const node = inCtx.createMediaStreamSource(mic);
        processor = inCtx.createScriptProcessor(2048, 1, 1);
        processor.onaudioprocess = (ev) => {
          if (state !== "active" || muted || socket?.readyState !== WebSocket.OPEN) return;
          const f = ev.inputBuffer.getChannelData(0);
          const pcm = new Int16Array(f.length);
          for (let i = 0; i < f.length; i++) pcm[i] = Math.max(-1, Math.min(1, f[i])) * 0x7fff;
          socket.send(JSON.stringify({ type: "app.audio", data: toBase64(new Uint8Array(pcm.buffer)) }));
        };
        node.connect(processor);
        processor.connect(inCtx.destination);
        onEvent({ type: "app.connected" });
        if (outCtx?.state !== "running") onEvent({ type: "app.playback.blocked" });
      } else if (e.type === "app.audio" && typeof e["data"] === "string") play(e["data"]);
      else if (e.type === "app.interrupted") interrupt();
      else if (e.type === "app.error") {
        onEvent(e);
      } else if (e.type === "app.closed") {
        if (state === "active" || state === "starting") stop();
      } else onEvent(e);
    };
  }

  function setMuted(value: boolean) {
    if (state !== "starting" && state !== "active") return false;
    muted = value;
    return true;
  }

  async function resumePlayback() {
    try {
      await outCtx?.resume();
      onEvent({ type: outCtx?.state === "running" ? "app.playback.resumed" : "app.playback.blocked" });
    } catch {
      onEvent({ type: "app.playback.blocked" });
    }
  }

  return { start, stop, setMuted, resumePlayback };
}
