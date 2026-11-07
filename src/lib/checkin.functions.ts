import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Tried in order. gemini-flash-lite-latest answers in ~1s; gemini-flash-latest has been
// hanging until timeout, so it is only a last resort. gemini-2.5-flash-lite is gone for
// new accounts (404) and was dropped.
const GEMINI_TEXT_MODELS = ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-flash-latest"];
const RETRYABLE = new Set([429, 500, 503, 504]);
const MODEL_TIMEOUT_MS = 10000;

const Input = z.object({
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) })).max(400),
  meds: z.array(z.string().max(120)).max(30),
  name: z.string().max(120).optional(),
  clinicianQuestions: z.array(z.string().max(500)).max(20).optional(),
});

export type CheckInSummary = {
  meds: { name: string; taken: "yes" | "no" | "unclear" }[];
  meals: number;
  fluids: "good" | "low" | "unknown";
  sleepHours: number | null;
  mood: number | null;
  pain: number | null;
  fall: boolean;
  urgent: string[];
  questions: string[];
  summary: string;
  /** One entry per care-team question: the senior's own words, and whether the answer is a concern. */
  answers: { question: string; said: string; concern: boolean }[];
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["meds", "meals", "fluids", "sleepHours", "mood", "pain", "fall", "urgent", "questions", "summary", "answers"],
  properties: {
    meds: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "taken"],
        properties: { name: { type: "string" }, taken: { type: "string", enum: ["yes", "no", "unclear"] } },
      },
    },
    meals: { type: "integer", description: "Meals eaten so far today, 0-3" },
    fluids: { type: "string", enum: ["good", "low", "unknown"] },
    sleepHours: { type: ["number", "null"] },
    mood: { type: ["integer", "null"], description: "1 (very low) to 5 (very good)" },
    pain: { type: ["integer", "null"], description: "0-10" },
    fall: { type: "boolean" },
    urgent: { type: "array", items: { type: "string" }, description: "Urgent symptoms mentioned, e.g. chest pain" },
    questions: { type: "array", items: { type: "string" }, description: "Questions the senior wants passed to the care team" },
    summary: { type: "string", description: "2-3 plain sentences for the care team" },
    answers: {
      type: "array",
      description:
        "One entry per care-team question, question copied exactly. 'said' = the senior's own words (empty if not answered). 'concern' = true if the answer suggests a problem the care team should follow up on.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "said", "concern"],
        properties: { question: { type: "string" }, said: { type: "string" }, concern: { type: "boolean" } },
      },
    },
  },
} as const;

/** Turns a check-in call transcript into structured answers for the care team. */
export async function runSummary(data: z.infer<typeof Input>): Promise<CheckInSummary> {
    const key = process.env["GEMINI_API_KEY"];
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    const text = data.transcript.map((t) => `${t.role === "user" ? data.name || "Senior" : "Rosie"}: ${t.text}`).join("\n");
    const payload = JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "Extract a daily check-in record from a phone call between an AI companion and an older adult. " +
                "Only record what the senior actually said; use 'unclear' or null when not discussed. " +
                "List every expected medication. Do not add medical advice. " +
                "Write the summary about the senior by name (e.g. 'Margaret slept well...'), never 'the senior' or 'the patient'.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: `Senior's name: ${data.name || "unknown"}\nExpected medications: ${data.meds.join(", ") || "none"}\nCare team questions (copy each exactly into answers): ${(data.clinicianQuestions ?? []).join(" | ") || "none"}\n\nTranscript:\n${text || "(empty)"}` }],
          },
        ],
        generationConfig: { responseMimeType: "application/json", responseJsonSchema: schema },
      });
    for (const model of GEMINI_TEXT_MODELS) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      }).catch((e: unknown) => {
        console.error("Gemini summary network error", model, e);
        return null;
      });
      if (!res) continue;
      if (!res.ok) {
        console.error("Gemini summary failed", model, res.status, (await res.text()).slice(0, 300));
        if (RETRYABLE.has(res.status) || res.status === 404) continue;
        throw new Error("Summary service failed");
      }
      const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      const out = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      try {
        const parsed = JSON.parse(out) as CheckInSummary;
        return { ...parsed, answers: parsed.answers ?? [] };
      } catch {
        console.error("Gemini summary bad JSON", model);
      }
    }
    throw new Error("Summary service failed");
}

export const summarizeCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<CheckInSummary> => runSummary(data));
