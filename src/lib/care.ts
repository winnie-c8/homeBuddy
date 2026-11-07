// Domain model, sample patients and status/alert rules for Hearthline (demo data, client-side).

export type Status = "green" | "yellow" | "red";
export type Taken = "yes" | "no" | "unclear";

export type Medication = { id: string; name: string; dose: string; time: "morning" | "midday" | "evening" | "bedtime" };
export type Contact = { id: string; name: string; relation: string; phone: string; kind: "family" | "care" };

export type CheckIn = {
  id: string;
  date: string; // ISO
  answered: boolean;
  meds: { name: string; taken: Taken }[];
  meals: number; // 0-3
  fluids: "good" | "low" | "unknown";
  sleepHours: number | null;
  mood: number | null; // 1-5
  pain: number | null; // 0-10
  fall: boolean;
  urgent: string[];
  summary: string;
  source: "voice" | "sample";
  /** Answers to the care team's questions, already checked against each question's rule. */
  answers?: QuestionAnswer[];
};

/** What the AI heard for a yes/no question. It never decides whether that is a concern. */
export type YesNo = "yes" | "no" | "unclear";
/** A care-team question's flag rule: flag when the answer is this. No rule = just record it. */
export type FlagIf = "yes" | "no";
export type QuestionAnswer = { question: string; said: string; answer: YesNo; flagIf?: FlagIf | undefined; flagged: boolean };

/**
 * The rule for care-team questions. Deterministic: same answer + same rule = same result.
 * With a rule, the answer that matches it is flagged, and so is "unclear" (couldn't confirm).
 */
export function isAnswerFlagged(answer: YesNo, flagIf: FlagIf | undefined): boolean {
  if (!flagIf) return false;
  return answer === "unclear" || answer === flagIf;
}

/** Match the AI's answers to the questions that were asked, and apply each question's rule. */
export function checkAnswers(
  asked: { text: string; flagIf?: FlagIf }[],
  heard: { question: string; said: string; answer: YesNo }[],
): QuestionAnswer[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  return asked.map((q) => {
    const h = heard.find((a) => norm(a.question) === norm(q.text));
    const said = h?.said.trim() ?? "";
    // Not asked or no words captured counts as unclear.
    const answer: YesNo = h && said ? h.answer : "unclear";
    return { question: q.text, said, answer, flagIf: q.flagIf, flagged: isAnswerFlagged(answer, q.flagIf) };
  });
}

export type Question = {
  id: string;
  patientId: string;
  text: string;
  askedAt: string;
  answer?: string;
  answeredBy?: string;
  answeredAt?: string;
  deliveredAt?: string;
};

export type PlanChange = { id: string; text: string; createdAt: string; deliveredAt?: string };

export type Alert = {
  id: string;
  patientId: string;
  at: string;
  level: "urgent" | "warning";
  message: string;
  notified: string[];
  acknowledged?: boolean;
  /** How the care team resolved it — required before an alert can be marked handled. */
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
};

export type Patient = {
  id: string;
  name: string;
  preferredName: string;
  age: number;
  city: string;
  callTime: string; // "09:30"
  conditions: string[];
  meds: Medication[];
  planItems: string[];
  planChanges: PlanChange[];
  contacts: Contact[];
  /** Contact ids the senior has chosen to share their information with. */
  sharedWith: string[];
  checkIns: CheckIn[];
};

export type CareState = {
  patients: Patient[];
  questions: Question[];
  alerts: Alert[];
};

export const URGENT_WORDS = [
  "fell", "fall down", "fallen", "chest pain", "chest hurts", "can't breathe", "cannot breathe",
  "short of breath", "trouble breathing", "dizzy", "fainted", "bleeding", "ambulance", "emergency",
];

export function detectUrgent(text: string): string[] {
  const t = text.toLowerCase();
  // Whole words only, so "fellow" doesn't count as "fell".
  return URGENT_WORDS.filter((w) => new RegExp(`(^|[^a-z'])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z'])`).test(t));
}

/** Status of one check-in: red = act now, yellow = watch, green = on track. */
export function checkInStatus(c: CheckIn | undefined): Status {
  if (!c) return "yellow";
  if (!c.answered || c.fall || c.urgent.length > 0 || (c.pain ?? 0) >= 7) return "red";
  const missedDose = c.meds.some((m) => m.taken !== "yes");
  if (
    missedDose ||
    (c.mood !== null && c.mood <= 2) ||
    (c.pain ?? 0) >= 4 ||
    c.fluids === "low" ||
    c.meals < 2 ||
    (c.sleepHours !== null && c.sleepHours < 5) ||
    (c.answers ?? []).some((a) => a.flagged)
  )
    return "yellow";
  return "green";
}

export function latestCheckIn(p: Patient): CheckIn | undefined {
  return [...p.checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function patientStatus(p: Patient): Status {
  return checkInStatus(latestCheckIn(p));
}

export function adherence(checkIns: CheckIn[]): number | null {
  const doses = checkIns.flatMap((c) => (c.answered ? c.meds : []));
  if (!doses.length) return null;
  return Math.round((doses.filter((d) => d.taken === "yes").length / doses.length) * 100);
}

/** Alerts a check-in should raise, and who they go to. */
export function alertsForCheckIn(p: Patient, c: CheckIn): Omit<Alert, "id">[] {
  const family = p.contacts.filter((x) => x.kind === "family" && p.sharedWith.includes(x.id)).map((x) => x.name);
  const care = p.contacts.filter((x) => x.kind === "care").map((x) => x.name);
  const out: Omit<Alert, "id">[] = [];
  if (!c.answered) {
    out.push({ patientId: p.id, at: c.date, level: "urgent", message: `${p.preferredName} did not answer today's check-in call.`, notified: [...family, ...care] });
    return out;
  }
  if (c.fall) out.push({ patientId: p.id, at: c.date, level: "urgent", message: `${p.preferredName} reported a fall.`, notified: [...family, ...care] });
  const other = c.urgent.filter((u) => !/fall|fell/.test(u));
  if (other.length) out.push({ patientId: p.id, at: c.date, level: "urgent", message: `${p.preferredName} mentioned: ${other.join(", ")}.`, notified: [...family, ...care] });
  const missed = c.meds.filter((m) => m.taken === "no").map((m) => m.name);
  if (missed.length) out.push({ patientId: p.id, at: c.date, level: "warning", message: `Missed dose: ${missed.join(", ")}.`, notified: [...family, ...care] });
  for (const a of (c.answers ?? []).filter((x) => x.flagged)) {
    const what = a.answer === "unclear" ? "couldn't confirm an answer" : `answered ${a.answer}`;
    const quote = a.said ? ` — "${a.said}"` : "";
    out.push({ patientId: p.id, at: c.date, level: "warning", message: `Care team question "${a.question}": ${what}${quote}`, notified: [...family, ...care] });
  }
  return out;
}

// ---------- Sample data ----------

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

type Profile = { adherence: number; mood: number; sleep: number; meals: number; pain: number };

function history(p: Omit<Patient, "checkIns">, prof: Profile, seed: number, days: number, today: Date): CheckIn[] {
  const r = rng(seed);
  const list: CheckIn[] = [];
  for (let d = days; d >= 1; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const [h, m] = p.callTime.split(":").map(Number);
    date.setHours(h ?? 9, m ?? 0, 0, 0);
    const mood = Math.max(1, Math.min(5, Math.round(prof.mood + (r() - 0.5) * 2)));
    const sleep = Math.max(3, Math.round((prof.sleep + (r() - 0.5) * 3) * 2) / 2);
    const meals = Math.max(1, Math.min(3, Math.round(prof.meals + (r() - 0.5) * 1.5)));
    const pain = Math.max(0, Math.min(8, Math.round(prof.pain + (r() - 0.5) * 3)));
    const meds = p.meds.map((med) => ({ name: med.name, taken: (r() < prof.adherence ? "yes" : "no") as Taken }));
    list.push({
      id: `${p.id}-c${d}`,
      date: date.toISOString(),
      answered: true,
      meds,
      meals,
      fluids: r() < 0.8 ? "good" : "low",
      sleepHours: sleep,
      mood,
      pain,
      fall: false,
      urgent: [],
      summary: `Slept about ${sleep} hours, ${meals} meals, mood ${mood}/5, pain ${pain}/10.`,
      source: "sample",
    });
  }
  return list;
}

export function createSampleState(today = new Date()): CareState {
  const careTeam: Contact[] = [
    { id: "dr-patel", name: "Dr. Anjali Patel", relation: "Family physician", phone: "416-555-0142", kind: "care" },
    { id: "nurse-ruiz", name: "Marco Ruiz, RN", relation: "Home care nurse", phone: "416-555-0177", kind: "care" },
  ];
  const base: Array<[Omit<Patient, "checkIns">, Profile, number]> = [
    [
      {
        id: "margaret", name: "Margaret Thompson", preferredName: "Margaret", age: 82, city: "Toronto", callTime: "09:30",
        conditions: ["Type 2 diabetes", "High blood pressure"],
        meds: [
          { id: "m1", name: "Metformin", dose: "500 mg", time: "morning" },
          { id: "m2", name: "Lisinopril", dose: "10 mg", time: "morning" },
          { id: "m3", name: "Atorvastatin", dose: "20 mg", time: "evening" },
        ],
        planItems: ["Walk 15 minutes after lunch", "Check blood sugar before breakfast", "Drink 6 glasses of water a day"],
        planChanges: [{ id: "pc1", text: "Metformin moves from evening to morning, with breakfast.", createdAt: new Date(today.getTime() - 864e5).toISOString() }],
        contacts: [
          { id: "daniel", name: "Daniel Thompson", relation: "Son", phone: "647-555-0110", kind: "family" },
          { id: "sarah", name: "Sarah Lee", relation: "Daughter", phone: "905-555-0123", kind: "family" },
          ...careTeam,
        ],
        sharedWith: ["daniel", "sarah", "dr-patel", "nurse-ruiz"],
      },
      { adherence: 0.93, mood: 4, sleep: 7, meals: 2.8, pain: 2 }, 11,
    ],
    [
      {
        id: "henri", name: "Henri Gagnon", preferredName: "Henri", age: 88, city: "Ottawa", callTime: "10:00",
        conditions: ["Heart failure", "Arthritis"],
        meds: [
          { id: "m1", name: "Furosemide", dose: "40 mg", time: "morning" },
          { id: "m2", name: "Bisoprolol", dose: "5 mg", time: "morning" },
          { id: "m3", name: "Acetaminophen", dose: "500 mg", time: "bedtime" },
        ],
        planItems: ["Weigh yourself every morning", "Limit salt", "Keep legs raised when resting"],
        planChanges: [],
        contacts: [{ id: "claire", name: "Claire Gagnon", relation: "Daughter", phone: "613-555-0190", kind: "family" }, ...careTeam],
        sharedWith: ["claire", "dr-patel", "nurse-ruiz"],
      },
      { adherence: 0.7, mood: 3, sleep: 6, meals: 2.2, pain: 4 }, 23,
    ],
    [
      {
        id: "aisha", name: "Aisha Rahman", preferredName: "Aisha", age: 79, city: "Mississauga", callTime: "08:45",
        conditions: ["Osteoporosis", "Mild memory loss"],
        meds: [
          { id: "m1", name: "Alendronate", dose: "70 mg weekly", time: "morning" },
          { id: "m2", name: "Vitamin D", dose: "1000 IU", time: "morning" },
          { id: "m3", name: "Donepezil", dose: "5 mg", time: "bedtime" },
        ],
        planItems: ["Use the walker indoors", "Night light on in the hallway"],
        planChanges: [],
        contacts: [{ id: "omar", name: "Omar Rahman", relation: "Son", phone: "905-555-0155", kind: "family" }, ...careTeam],
        sharedWith: ["omar", "dr-patel", "nurse-ruiz"],
      },
      { adherence: 0.88, mood: 3.4, sleep: 6.5, meals: 2.5, pain: 3 }, 37,
    ],
    [
      {
        id: "walter", name: "Walter Kim", preferredName: "Walter", age: 91, city: "Toronto", callTime: "11:00",
        conditions: ["Glaucoma"],
        meds: [{ id: "m1", name: "Latanoprost eye drops", dose: "1 drop", time: "bedtime" }],
        planItems: ["Eye drops every night", "Lunch program on Tuesdays"],
        planChanges: [],
        contacts: [{ id: "grace", name: "Grace Kim", relation: "Granddaughter", phone: "416-555-0166", kind: "family" }, ...careTeam],
        sharedWith: ["grace", "dr-patel"],
      },
      { adherence: 0.98, mood: 4.3, sleep: 7.5, meals: 3, pain: 1 }, 41,
    ],
    [
      {
        id: "doris", name: "Doris Okafor", preferredName: "Doris", age: 85, city: "Hamilton", callTime: "09:00",
        conditions: ["COPD", "Depression"],
        meds: [
          { id: "m1", name: "Tiotropium inhaler", dose: "1 puff", time: "morning" },
          { id: "m2", name: "Sertraline", dose: "50 mg", time: "morning" },
        ],
        planItems: ["Breathing exercises twice a day", "Call friend group on Thursdays"],
        planChanges: [],
        contacts: [{ id: "james", name: "James Okafor", relation: "Nephew", phone: "289-555-0101", kind: "family" }, ...careTeam],
        sharedWith: ["james", "dr-patel", "nurse-ruiz"],
      },
      { adherence: 0.85, mood: 2.6, sleep: 5.8, meals: 2, pain: 2 }, 53,
    ],
  ];

  const patients: Patient[] = base.map(([p, prof, seed]) => ({ ...p, checkIns: history(p, prof, seed, 14, today) }));
  const at = (h: number, min: number) => {
    const d = new Date(today);
    d.setHours(h, min, 0, 0);
    return d.toISOString();
  };
  // Today's notable events.
  const aisha = patients.find((p) => p.id === "aisha")!;
  aisha.checkIns.push({
    id: "aisha-today", date: at(8, 45), answered: true,
    meds: aisha.meds.map((m) => ({ name: m.name, taken: "yes" })), meals: 1, fluids: "low", sleepHours: 5,
    mood: 2, pain: 6, fall: true, urgent: ["fell"],
    summary: "Aisha said she slipped getting out of bed last night. She is sore in her left hip but can walk with her walker.",
    source: "sample",
  });
  const doris = patients.find((p) => p.id === "doris")!;
  doris.checkIns.push({
    id: "doris-today", date: at(9, 0), answered: false, meds: [], meals: 0, fluids: "unknown", sleepHours: null,
    mood: null, pain: null, fall: false, urgent: [], summary: "No answer after 3 attempts.", source: "sample",
  });
  const henri = patients.find((p) => p.id === "henri")!;
  henri.checkIns.push({
    id: "henri-today", date: at(10, 0), answered: true,
    meds: [{ name: "Furosemide", taken: "no" }, { name: "Bisoprolol", taken: "yes" }, { name: "Acetaminophen", taken: "yes" }],
    meals: 2, fluids: "good", sleepHours: 6, mood: 3, pain: 4, fall: false, urgent: [],
    summary: "Henri forgot his water pill this morning. Knees are achy. Wants to know if he can skip it on outing days.",
    source: "sample",
  });

  const alerts: Alert[] = [];
  for (const p of patients) {
    const c = p.checkIns.find((x) => x.id.endsWith("today"));
    if (c) alertsForCheckIn(p, c).forEach((a, i) => alerts.push({ ...a, id: `${p.id}-a${i}` }));
  }

  const questions: Question[] = [
    { id: "q1", patientId: "henri", text: "Can I skip my water pill on days I go out?", askedAt: at(10, 4) },
    { id: "q2", patientId: "margaret", text: "Is it okay to take my vitamins with the new morning pill?", askedAt: new Date(today.getTime() - 864e5).toISOString() },
    { id: "q3", patientId: "aisha", text: "When is my next bone scan?", askedAt: at(8, 50) },
  ];

  return { patients, questions, alerts };
}

/** Plain text the voice companion receives before a call. */
/** Time-of-day greeting for the senior's local clock. */
export function greetingFor(now: Date): "Good morning" | "Good afternoon" | "Good evening" {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Warning signs from the last few days that Rosie should follow up on today. */
export function followUps(p: Patient, now: Date = new Date(), days = 3): string[] {
  const since = now.getTime() - days * 86400000;
  const recent = p.checkIns
    .filter((c) => c.answered && new Date(c.date).getTime() >= since && new Date(c.date).getTime() <= now.getTime())
    .sort((a, b) => b.date.localeCompare(a.date));
  const out: string[] = [];
  for (const c of recent) {
    const d = new Date(c.date);
    const ago = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
    const when = ago <= 0 ? "Earlier today" : ago === 1 ? "Yesterday" : `${ago} days ago`;
    const notes: string[] = [];
    if (c.pain !== null && c.pain >= 3) notes.push(`pain ${c.pain}/10`);
    if (c.fall) notes.push("a fall or near-fall");
    if (c.urgent.length) notes.push(`mentioned ${c.urgent.join(", ")}`);
    if (c.mood !== null && c.mood <= 2) notes.push("low mood");
    if (c.fluids === "low") notes.push("not drinking much");
    if (c.sleepHours !== null && c.sleepHours < 5) notes.push(`only ${c.sleepHours} hours of sleep`);
    const missed = c.meds.filter((m) => m.taken === "no").map((m) => m.name);
    if (missed.length) notes.push(`missed ${missed.join(", ")}`);
    if (notes.length) out.push(`${when}: ${notes.join("; ")}. Their words/summary: ${c.summary}`);
  }
  return out;
}

export function callContext(p: Patient, questions: Question[], now: Date = new Date()): string {
  const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const day = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const lines = [
    `Right now it is ${time} on ${day} for them. Open with "${greetingFor(now)}, ${p.preferredName}!"`,
    `Name: ${p.name} (call them ${p.preferredName}), age ${p.age}.`,
    `Medications to confirm today: ${p.meds.map((m) => `${m.name} ${m.dose} (${m.time})`).join("; ")}.`,
    `Current care plan: ${p.planItems.join("; ")}.`,
  ];
  const changes = p.planChanges.filter((c) => !c.deliveredAt);
  if (changes.length) lines.push(`New care plan changes to explain simply: ${changes.map((c) => c.text).join(" ")}`);
  const answers = questions.filter((q) => q.patientId === p.id && q.answer && !q.deliveredAt);
  if (answers.length)
    lines.push(`Answers from the care team to share: ${answers.map((q) => `They asked "${q.text}" — ${q.answeredBy} says: ${q.answer}`).join(" ")}`);
  const fu = followUps(p, now);
  if (fu.length)
    lines.push(
      `Things they mentioned in recent calls — early in the call, gently ask how each is doing now (e.g. "Yesterday you said your head hurt — is it still bothering you?"):\n- ${fu.join("\n- ")}`,
    );
  return lines.join("\n");
}
