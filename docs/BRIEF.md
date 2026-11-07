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
project: database and sign-in) · Lovable's AI gateway (voice and summaries) · GitHub
Actions (lint, tests, build on every push) · Figma (optional, later).

## Who owns what

| Area | Owner |
|---|---|
| Prompting Lovable | TBD |
| Supabase | TBD |
| Design | TBD |
| Pitch and Devpost | TBD |
| Code outside Lovable, checks | Kaitlyn (with Claude Code) |

## Decision log

| Time | Decision | Why |
|---|---|---|
| Nov 7 | Our own Supabase project, not Lovable Cloud | We want to own the backend |
| Nov 7 | Fictional demo data only | Privacy; this is a prototype |
| Nov 7 | Work in phases; demo needs Phase 1 only | Guarantee a working demo, add more if time allows |
