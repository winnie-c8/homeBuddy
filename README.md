# homeBuddy 🏡

**Bringing the reassurance of a nursing home's daily check-in to seniors aging at home.**

Built in one day for the **PointClickCare Challenge** at the **Women in Engineering (WiE) Hackathon 2026**, University of Waterloo.

> ⚠️ **Safety notice:** homeBuddy is a hackathon prototype for monitoring and communication. It is not a medical device and never diagnoses or gives treatment advice. The senior's screen always says to call **911** in an emergency. All patient data in this project is fictional.

<!-- Screenshots: add the image files to docs/screenshots/ and remove this comment's markers.
| Senior | Clinician | Family |
| --- | --- | --- |
| ![Senior check-in screen](docs/screenshots/senior.png) | ![Clinician care dashboard](docs/screenshots/care.png) | ![Family view](docs/screenshots/family.png) |
-->

---

## 💡 The problem

Seniors living on their own often face slow-building health problems: missed meals, growing tiredness, dehydration, skipped medications. Nobody notices these until they end in an emergency room visit.

In a nursing home, staff check on residents every day. At home, nobody does. Existing health portals don't fill the gap, because they expect seniors to log in, type and navigate complex screens.

## 🌱 Our solution

homeBuddy replaces the daily form and the nurse's phone call with a short, friendly voice call, and passes what it hears to the people who need to know.

1. **A clinician prescribes the check-in.** They write the questions for each senior (e.g. "Did you do your dialysis today?") and say which answers should raise a flag.
2. **The senior just talks.** Rosie, an AI voice companion, calls through the app and asks those questions in a natural conversation. No typing, no menus.
3. **The day gets a colour.** After the call, the AI turns the conversation into structured answers, and written rules mark the day **🟢 green**, **🟡 yellow** or **🔴 red**.
4. **The clinician sees who needs attention and why.** Every flag says which rule fired and quotes the senior's own words.
5. **Family stay in the loop.** They see the same status and know when the care team is already on it.

## 👥 How each person uses it

| Person | Screen | What they do |
| --- | --- | --- |
| **Senior** | `/senior` | Taps one big button to talk to Rosie. After the call, sees a simple summary of what was said. Chooses who can see their information and shares an invite code with family and the care team. |
| **Clinician** | `/care` and `/care/:patientId` | Sees all their patients, sorted red → yellow → green, with open alerts at the top. On a patient's page: sets check-in questions and "flag if" rules, updates the care plan, views history charts, and handles alerts ("On it" → "Resolved" with a note). |
| **Family** | `/family` | Read-only view of today's colour, the latest summary, alerts meant for family, and who on the care team is following up. Access stops as soon as the senior stops sharing. |

### Who is told about what

| Colour | Example reasons | Clinician | Family | Senior |
| --- | --- | --- | --- | --- |
| 🔴 Red | Missed check-in, a fall, urgent words like "chest pain", pain 7/10 or higher | Alert right away | Alert right away | Screen says call 911 |
| 🟡 Yellow | Missed medication, low mood, under 5 h sleep, eating less, an answer the clinician flagged | Yellow badge | Alert with the reason | Nothing extra |
| 🟢 Green | Nothing flagged | Green badge | Green status | Nothing extra |

## ⚙️ How it works (technical)

```
 Senior's browser                 App server                     External services
 ────────────────                 ──────────                     ─────────────────
 Microphone audio  ──WebSocket──▶  /api/live relay  ──WebSocket──▶  Gemini Live (voice)
 Rosie's voice     ◀─────────────                    ◀────────────
                                    (adds the senior's questions
                                     and keeps the API key secret)

 Call transcript   ──────────────▶  summarizeCheckIn ────────────▶  Gemini Flash (summary)
                                    returns structured answers

 Rules in care.ts colour the day (green / yellow / red) and create alerts
        │
        ▼
 Supabase (Postgres) ◀── row-level security decides who can read and write each record
        │
        ▼
 Clinician and family pages read the same record and refresh every 20 seconds
```

### Frontend
- **TanStack Start** (React 19 + TypeScript, built with Vite) with file-based routes in `src/routes/`. Each role has its own pages under `src/routes/_authenticated/`, and `requireRole` (`src/lib/auth.ts`) keeps people on the pages for their role.
- **Tailwind CSS v4** and **Radix UI** components, with the **Atkinson Hyperlegible** font, large text and high contrast for older eyes.
- **Recharts** for the clinician's history charts.
- The voice call is handled in `src/hooks/use-live-voice.ts`: it streams microphone audio to the server and plays Rosie's replies back.

### Backend
- **Voice relay** (`src/lib/live-relay.server.ts`): a WebSocket at `/api/live` that sits between the browser and Google's Gemini Live API. It adds the senior's questions for the day, and it keeps the Gemini API key on the server so it never reaches the browser.
- **Call summary** (`src/lib/checkin.functions.ts`): after the call, a server function sends the transcript to Gemini Flash. Gemini returns structured answers (for each question: what the senior said, and yes / no / unclear). The AI only reports; it doesn't decide the colour.
- **Safety rules** (`src/lib/care.ts`, tested in `care.test.ts`): plain, deterministic code that turns the answers into green / yellow / red and decides who is alerted. All the rules live in this one file so they're easy to check and test.
- **Database and sign-in** (Supabase): Postgres plus Supabase Auth. Each senior has one record (`patients.state`), read and written through `src/lib/care-store.ts`. Family and clinicians link to a senior with an invite code (`join_patient`).
- **Access rules** (`supabase/migrations/`): row-level security enforces who sees what *in the database itself*, not just in the UI. Family only see a senior while the senior shares with them, family can never edit, and roles are set once at signup and can't be changed by the user.

### Design choices
- **The AI listens; the rules decide.** Gemini extracts answers, but every flag comes from written, tested rules, so each one can say exactly why it fired.
- **One record per senior** keeps the app simple while the database still enforces privacy.
- **Not a medical device.** Rosie asks, listens and passes things on. The clinician decides what to do.

## 🛠️ Tech stack

| Layer | Tools |
| --- | --- |
| Framework | TanStack Start v1 (React 19, TypeScript, Vite) |
| Styling | Tailwind CSS v4, Radix UI, Atkinson Hyperlegible |
| Live voice | Google Gemini Live (native audio) via a server WebSocket relay |
| Check-in analysis | Google Gemini Flash (structured output) |
| Database and auth | Supabase (Postgres, row-level security, Auth) |
| Charts | Recharts |
| Testing | Vitest, React Testing Library |
| CI | GitHub Actions (lint, tests and build on every push) |
| Built with | Lovable, Claude Code, Figma |

## 🚀 Running it yourself

You'll need your **own** Supabase project and Gemini API key. This repo doesn't include working credentials for either.

### Prerequisites
- [Bun](https://bun.sh), a JavaScript runtime and package manager (like Node.js + npm)
- A free [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- Chrome (or another browser with microphone access)

### 1. Install

```bash
git clone https://github.com/winnie-c8/homeBuddy.git
cd homeBuddy
bun install
```

### 2. Set up your Supabase project
1. Create a new project at [supabase.com](https://supabase.com).
2. Create the tables and access rules by running the SQL files in `supabase/migrations/`, in filename order. You can paste each one into the Supabase **SQL Editor**, or use the [Supabase CLI](https://supabase.com/docs/guides/cli): `supabase link` then `supabase db push`.
3. In **Project Settings → API**, copy your **Project URL** and **publishable key**.
4. Point the app at your project:
   - In `src/integrations/supabase/client.ts`, replace `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` with your values.
   - In `.env`, replace the `SUPABASE_*` and `VITE_SUPABASE_*` values with yours.

The publishable key is meant to be public: what it can do is limited by the access rules. **Never** put your Supabase *secret* (service role) key in the code.

### 3. Add your Gemini key
The Gemini key must stay on the server. Set it in your terminal before starting the app (don't commit it):

```bash
export GEMINI_API_KEY=your-gemini-api-key
```

### 4. Run

```bash
bun run dev     # start the app at http://localhost:8080
bun run test    # run the tests
bun run build   # production build
```

Create three accounts (senior, family, care team). As the senior, copy the invite code from the senior screen, then enter it from the family and care team accounts to link them.

## 📁 Project layout

```
src/
  routes/                 pages (file-based routing)
    _authenticated/       signed-in pages: senior, care (clinician), family
  hooks/use-live-voice.ts browser side of the voice call
  lib/
    care.ts               green / yellow / red rules and alert routing (+ tests)
    care-store.ts         reads and writes each senior's record in Supabase
    checkin.functions.ts  AI call summary (server)
    live-relay.server.ts  voice relay to Gemini Live (server)
    auth.ts               roles and page access
  components/             UI components
supabase/migrations/      database tables and access rules
docs/                     hackathon brief and user flows
```

`docs/BRIEF.md` is the plan we built from on the day, and `docs/FLOWS.md` describes each user's flow and the edge cases.

## 👩‍💻 Team

Built in 7 hours by:
- **Winnie Chen** ([@winnie-c8](https://github.com/winnie-c8))
- **Kaitlyn Chan** ([@kaitlynlaichan](https://github.com/kaitlynlaichan))
- **Caitlin Lim** ([@clim08-source](https://github.com/clim08-source))
