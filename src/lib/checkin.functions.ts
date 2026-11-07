import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) })).max(400),
  meds: z.array(z.string().max(120)).max(30),
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
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["meds", "meals", "fluids", "sleepHours", "mood", "pain", "fall", "urgent", "questions", "summary"],
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
  },
} as const;

/** Turns a check-in call transcript into structured answers for the care team. */
export async function runSummary(data: z.infer<typeof Input>): Promise<CheckInSummary> {
    const { generateResponse } = await import("@lovable.dev/ai-gateway");
    const text = data.transcript.map((t) => `${t.role === "user" ? "Senior" : "Companion"}: ${t.text}`).join("\n");
    const res = await generateResponse({
      model: "openai/gpt-6-astra",
      instructions:
        "Extract a daily check-in record from a phone call between an AI companion and an older adult. " +
        "Only record what the senior actually said; use 'unclear' or null when not discussed. " +
        "List every expected medication. Do not add medical advice.",
      input: [
        {
          role: "user",
          content: `Expected medications: ${data.meds.join(", ") || "none"}\n\nTranscript:\n${text || "(empty)"}`,
        },
      ],
      text: { format: { type: "json_schema", name: "check_in", schema, strict: true } },
    });
    const out = res.output
      .flatMap((item) =>
        item.type === "message" ? item.content.flatMap((p) => (p.type === "output_text" ? [p.text] : [])) : [],
      )
      .join("");
    return JSON.parse(out) as CheckInSummary;
}

export const summarizeCheckIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }): Promise<CheckInSummary> => runSummary(data));
