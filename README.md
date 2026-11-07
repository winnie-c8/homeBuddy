# homeBuddy 🏡

**Bringing the reassurance of a nursing home's daily check-in to seniors aging at home.**

Built for the **PointClickCare Challenge** at the **Women in Engineering (WiE) Hackathon 2026**, University of Waterloo.

> ⚠️ **Safety notice:** homeBuddy is an assistive monitoring and communication tool, not a medical diagnosis device. The interface always reminds seniors to call **911** in an emergency.

---

## 💡 The Problem

Seniors living independently often face slow-building health issues, such as missed meals, growing fatigue, dehydration or skipped medications. These go unnoticed until they end in an emergency room visit.

Existing health portals don't help much: they expect seniors to type, log in and navigate complex screens, which many find frustrating or inaccessible.

## 🌱 Our Solution

homeBuddy connects seniors, clinicians and families through a simple daily voice call.

1. **Clinicians prescribe the check-in.** They set questions tailored to each senior's conditions (e.g. dialysis recovery, appetite, pain levels) and define which answers should raise a flag.
2. **Seniors just talk.** Rosie, a warm AI companion, asks those questions over a natural voice call. No typing and no menus to navigate.
3. **Calls are triaged automatically.** After each call, the transcript is analyzed and given a **Green**, **Yellow** or **Red** status based on the clinician's rules.
4. **Clinicians get actionable alerts.** Each alert quotes the senior's own words, so the care team can step in early and log how they handled it.
5. **Families stay in the loop.** Family members see the daily status and know right away when the care team is already on an issue.

## ✨ Features

### 🗣️ Voice Check-In — `/senior`
- Low-latency, natural conversation powered by Google Gemini Live audio
- Rosie greets seniors based on their local time, asks the prescribed questions conversationally and re-asks when an answer is unclear
- Optional per-patient **Short call** mode: just a greeting plus the care team's questions
- Live transcript during the call, followed by an easy-to-read summary

### 🩺 Clinician Care Hub — `/care`
- Overview of all assigned seniors, sorted by alert severity
- Patient detail page (`/care/:patientId`) with vitals history charts, care plan management and question prescribing
- Required resolution notes: an alert can only be marked handled once the care team logs what they did

### 👨‍👩‍👧 Family Dashboard — `/family`
- Read-only view of today's check-in status and care team notes
- Secure linking to a senior through a unique invite code

### ♿ Accessible by Design
- High-contrast colours and warm, friendly illustrations
- Atkinson Hyperlegible typography, designed for readability by older adults and busy care providers

## 🛠️ Tech Stack

| Layer | Tools |
| --- | --- |
| Framework | TanStack Start v1 (React 19, TypeScript, Vite) |
| Styling | Tailwind CSS v4, Radix UI primitives, Atkinson Hyperlegible |
| Live voice | Google Gemini 2.5 Live API via a server WebSocket relay (`/api/live`) |
| Check-in analysis | Google Gemini Flash (structured summarization) |
| Backend & database | Supabase (PostgreSQL with Row Level Security, Auth with role separation) |
| Charts | Recharts |
| Testing | Vitest, React Testing Library |

## 🚀 Getting Started

### Prerequisites
- [Bun](https://bun.sh)
- A [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://aistudio.google.com/app/apikey)
- A browser with microphone access (Chrome recommended)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/winnie-c8/wie-hackathon.git
cd wie-hackathon

# 2. Install dependencies
bun install

# 3. Add your environment variables (see below)

# 4. Start the dev server
bun run dev

# 5. Run tests
bun run test
```

### Environment variables

Create a `.env` file in the project root:

```bash
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

## 👩‍💻 Team

Built in 7 hours by:
- **Winnie Chen** ([@winnie-c8](https://github.com/winnie-c8))
- **Kaitlyn** ([@kaitlynlaichan](https://github.com/kaitlynlaichan))
- **Caitlin** ([@clim08-source](https://github.com/clim08-source))
