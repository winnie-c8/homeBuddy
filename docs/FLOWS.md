# User flows, data and edge cases

How each person uses homeBuddy, where their data lives, which rule decides what, and what
happens when things go wrong. `docs/BRIEF.md` is the roadmap; this file is the detail.
Status column: ✅ works today · 🛠 to build (issue) · ❓ needs a team decision.

## Where everything lives

One database row per senior (`patients.state`), read and written only through
`src/lib/care-store.ts`. The database's access rules decide who sees it:

| Data in the senior's record | Written by | Seen by |
|---|---|---|
| Profile, sharing choices, invite code | Senior | Senior; care team; family only while shared |
| Check-in questions + "flag if" rules | Clinician | Clinician (Rosie reads them before each call) |
| Check-ins (answers, the senior's words, summary) | The call, after it ends | Everyone linked |
| Alerts (reason, quote, who sees it, follow-up) | Rules in `care.ts`, after each check-in | Clinician; family as routed below |
| Care plan and plan changes | Clinician | Everyone linked; Rosie explains changes |
| Questions from the senior + answers | Senior (via call) / clinician | Senior, clinician |

**One rule file:** every green/yellow/red decision and every alert comes from
`src/lib/care.ts`, with tests in `care.test.ts`. The AI only reports what was said.

## Senior flow (home: `/senior`)

1. Sign in → first visit: picks "senior" and a name → sets up profile → gets an invite code. ✅
2. Shares the invite code with family and the clinician. ✅
3. Daily: taps **Talk to Rosie**. Rosie asks: how they are, sleep, meals, fluids, pain,
   mood, falls, medications (if any), then the clinician's questions. ✅
4. Hangs up → summary saved → sees "what was said". ✅
5. Chooses who can see their information (sharing switches). ✅
6. Screen always shows: **"For emergencies, call 911."** 🛠 (only Rosie says it today)

## Clinician flow (home: `/care`, patient page `/care/<id>`)

1. Sign in → picks "care team" → enters the senior's invite code. ✅
2. Sets up each patient: check-in questions with "flag if" and "every day/once" ✅;
   medications to confirm 🛠 (no screen to add them yet).
3. Dashboard: patients sorted red → yellow → green, open alerts with reason and quote. ✅
4. Acts on an alert: **On it** → **Resolved** with a short note. 🛠 #7
   (today "Mark handled" only hides it)
5. Answers the senior's questions and updates the care plan; Rosie passes both on next call. ✅

## Family flow (home: `/family`)

1. Sign in → picks "family" → enters the invite code. ✅
2. Sees today's colour, the latest summary, alerts routed to family, and the care plan. ✅
3. Sees who is handling a flag: "Dr. X is on it" / "Resolved: …". 🛠 #7
4. Read-only: family can't change anything (enforced by the database). ✅
5. If the senior stops sharing: "Not sharing right now". ✅

## Who sees which alert

| Colour | Example reasons | Clinician | Family |
|---|---|---|---|
| 🔴 Red | Missed check-in, fall, urgent words, pain ≥ 7 | Alert | Alert |
| 🟡 Yellow | Missed dose, low mood, < 5 h sleep, < 2 meals, low fluids, pain 4–6, a flagged answer | Badge + alert | Alert |
| 🟢 Green | Nothing flagged | Badge | Status |

Every alert states the reason and quotes the senior where there are words. 🛠 #6
(today only falls, urgent words, missed doses and flagged answers create alerts)

## Edge cases: what the app does

| # | Situation | What happens (deterministic) | Status |
|---|---|---|---|
| E1 | No check-in by 2 h after the call time | Day turns 🔴 "No check-in today"; clinician and family alerted | 🛠 |
| E2 | Call drops or ends early | Save what was said; questions not reached count as "unclear" (flagged if they have a rule); summary says the call ended early | Partly ✅ |
| E3 | AI summary fails | Call still saved with the senior's words; meds "unclear" → 🟡 "couldn't confirm" | ✅ |
| E4 | Vague answer ("I think so") | Rosie re-asks once in simpler words; still vague → "unclear" → flagged if the question has a rule | 🛠 #3 (Rosie), ✅ (rule) |
| E5 | Contradicting answers ("yes… actually I skipped it") | AI reports **unclear**, never picks one; rule flags it so a human checks | 🛠 (summary instruction) |
| E6 | Answers a different question / goes off-topic | Counts as "unclear" for that question | ✅ (rule) |
| E7 | Says an urgent word during the call ("chest pain", "fell") | 🔴 alert immediately, before the call ends; Rosie tells them to call 911 | ✅ |
| E8 | Two calls in one day | The day's colour is the **worst** of the day, not the latest call (a later "fine" call can't hide a fall) | 🛠 |
| E9 | Senior has no medications | No medication questions, no medication flags | ✅ |
| E10 | Flagged answer again the next day | Daily questions are asked every day; 3 flagged days in a row → 🔴 | ❓ #2 |
| E11 | One-off question answered "no" or unclear | Stays open and is asked again next call, until the good answer | ❓ #2 |
| E12 | Lag or talking over each other | Voice issue, not data | 🛠 #9 |
| E13 | Senior stops sharing with family | Family immediately loses access (database rule) | ✅ |
| E14 | Flag nobody acts on | Stays at the top of the clinician's list until marked On it / Resolved | 🛠 #7 |

## Not a medical device

The app never diagnoses or suggests treatment. Rosie only asks, listens and passes things on;
the clinician decides what to do. Emergencies: call 911.
