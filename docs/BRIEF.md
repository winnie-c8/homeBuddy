# Project brief

What we're building and the plan, in one page. Lovable, Claude and every teammate
read this, so **if it's wrong, update it**: when a phase item is finished, tick it;
when the team decides something, add it to the decision log.

**WiE Hackathon 2026, PointClickCare challenge. Devpost due Nov 7, 5:00 pm EST.**

## The idea

Bring a nursing home's daily check-in to seniors aging at home.

1. A **clinician prescribes** a short daily check-in for each patient: the questions to
   ask (medication, eating, dialysis, symptoms) and what counts as a concern.
2. The **senior gets an AI voice call** in the app and just talks. No typing.
3. The AI summarizes the call, and the rules mark the day **green, yellow or red**.
4. **Flags go to the clinician** with the reason and the patient's own words, so they
   know who to follow up with today.
5. **Family** see the same status and know when the care team is on it.

For slow-building problems, not emergencies: the senior's screen always says to call
911 for anything urgent, and the app never diagnoses.

## Users

| User | Needs | Screen |
|---|---|---|
| Clinician | Set questions once; see who needs attention and why | Care dashboard |
| Senior | A check-in that feels like a friendly call | Big "start my check-in" button, then voice |
| Family | Reassurance and a heads-up | Today's status and follow-up |

## Phases

Finish a phase before starting the next. The demo only needs Phase 1.

Each unticked item gets a GitHub issue (use the **Task** template; its "Done when"
boxes are the test). Put the issue number after the item, e.g. `(#3)`. The issue tracks
progress; tick the box here when the issue is closed.

### Phase 1: MVP, the demo flow (target 2:00 pm)

The full loop from patient input to clinician review, across devices:

- [x] Sign-in with separate senior, family and care team pages
- [x] Voice check-in for the senior, with an AI summary
- [x] Green / yellow / red rules and alerts, with tests (`src/lib/care.ts`)
- [x] Care dashboard and family view, using demo patients
- [ ] **Clinician sets each patient's check-in questions**, and the voice call asks them
      (the current "Questions" feature is the reverse: senior asks the doctor)
- [ ] **Save patients, check-ins and alerts in Supabase**, so a check-in on the senior's
      phone appears on the clinician's laptop. Lovable started this at 11:30 (`patients`
      and `patient_members` tables, invite codes); tick once checked on two devices
- [ ] Clinician can mark a flag "following up", and family sees it
- [ ] Seed fictional demo patients with a few days of history

### Phase 2: stronger demo (target 3:30 pm)

- [ ] Trend on the dashboard that explains itself (e.g. "ate less 3 days in a row")
- [ ] Polish the 3 screens for older eyes: large text, high contrast, one action each
- [ ] Short "how we built it" slide: Lovable plus Claude working from this brief

### Phase 3: only if ahead

- [ ] Photo logging (e.g. a swollen ankle)
- [ ] Medication and dialysis reminders
- [ ] Notifications to family

**4:15 pm: feature freeze.** Publish, rehearse the demo twice, submit to Devpost by 4:45.

## How we score on the rubric

| Category | Our answer |
|---|---|
| Problem and context | Slow-building problems at home; saves clinicians calls instead of adding work |
| User experience | A simple, separate screen for each of the 3 users; the senior never types |
| Data to insights | Flags say why, quote the patient, and show a trend |
| Workflow and multimedia | Voice replaces the daily form and the nurse's phone call |
| Use of AI | In the app: voice call, summary, flagging. In the build: Lovable and Claude from a shared brief |
| Live demo | One rehearsed end-to-end run: clinician sets questions → senior call → flag → follow-up |

## Tech stack

Lovable (builds and publishes) · GitHub (code, synced with Lovable) · Supabase (our own
project: database and sign-in) · Google Gemini with our own key (voice and summaries) ·
GitHub Actions (lint, tests, build on every push) · Figma (screen designs).

## How the data flows

The AI listens and pulls out answers; written, tested rules decide the colour. Every flag
can say which rule fired and quote the patient.

1. **Check-in, once a day** at the patient's call time. The call asks that patient's
   questions (set by the clinician) plus their meds, if they have any.
2. **The AI summarizes** the call into structured answers (`runSummary`).
3. **The rules colour the day** (`src/lib/care.ts`): 🔴 red, 🟡 yellow or 🟢 green, each
   flag with a reason and the patient's own words.
4. **Who sees what:**

| Flag | Clinician | Family | Senior |
|---|---|---|---|
| 🔴 Red (no answer, fall, urgent words, severe pain) | Alert right away | Alert right away | Screen says call 911 |
| 🟡 Yellow (missed dose, low mood, poor sleep, eating less, a clinician concern) | Yellow badge on dashboard | Alert with the reason | Nothing extra |
| 🟢 Green | Green badge | Green status | Nothing extra |

5. **Follow-up:** the clinician marks a flag "following up"; family see "Dr. X is following up".

"Notified" means it shows on that person's screen; we don't send texts or emails.
Later: checks fully per patient (no meds questions for a patient without meds), trends
across days (Phase 2).

## Who edits which files

Lovable, Claude and every teammate stay in their own files. To change someone else's
file, ask them first.

| Area | Owner | Files |
|---|---|---|
| Flag rules, data, saving, care dashboard and family data | Kaitlyn (GitHub + Claude Code) | `src/lib/care.ts`, `src/lib/care.test.ts`, `src/lib/care-store.ts`, `src/routes/_authenticated/care.*`, `src/routes/_authenticated/family.tsx` |
| Voice call and AI summary | AI-call teammate (Lovable) | `src/hooks/use-live-voice.ts`, `src/lib/live-relay.server.ts`, `src/lib/checkin.functions.ts`, the call part of `src/routes/_authenticated/senior.tsx` |
| Look and feel | Design teammate (Figma → Lovable) | Styling and layout only (`src/styles.css`, `src/components/`); not the data logic in the pages |
| Database tables and access rules | Lovable, on request | `supabase/migrations/` (never by hand) |

**The two hand-offs between the call and the rules:**

- **Into the call:** `callContext()` in `care.ts` (Kaitlyn) writes what to ask today. The
  call passes it to the AI unchanged.
- **Out of the call:** the summary type `CheckInSummary` in `checkin.functions.ts` (AI-call
  teammate). If you add or rename a field, tell Kaitlyn so the rules use it. Agreed next
  field (in place): `answers: { question, said, answer: yes | no | unclear }[]`. The AI only
  reports; `care.ts` applies each question's "flag if" rule.

## Decision log

| Time | Decision | Why |
|---|---|---|
| Nov 7 | Our own Supabase project, not Lovable Cloud | We want to own the backend |
| Nov 7 | Fictional demo data only | Privacy; this is a prototype |
| Nov 7 | Work in phases; demo needs Phase 1 only | Guarantee a working demo, add more if time allows |
| Nov 7 | Voice and summaries use Gemini with our own key, not Lovable's gateway | Team choice; the key stays server-side |
| Nov 7 | Flag rules live only in `care.ts`, owned by Kaitlyn; the AI extracts, rules decide | Explainable, testable flags |
| Nov 7 | Yellow alerts go to family; red alerts go to clinician and family | Family get a heads-up; clinicians see urgent first |
| Nov 7 | Clinician personalizes by question ("flag if…"); trends wait for Phase 2 | Smallest version that fits the deadline |
| Nov 7 | Lovable reads this brief first, via project knowledge | Keep teammates out of each other's files |
