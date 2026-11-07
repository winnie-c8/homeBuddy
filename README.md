# Overview
This Project was built for the Women in Engineering Hackathon at the University of Waterloo in 2026

# homeBuddy 🏡

> Bringing the reassurance of a nursing home's daily check-in to seniors aging at home.  
> *Built for the PointClickCare Challenge at the Women in Engineering (WiE) Hackathon 2026.*

---

## 💡 The Problem & Idea

Seniors living independently often face slow-building health issues—missed meals, worsening fatigue, dehydration, or skipped medications—that go unnoticed until an emergency room visit. Traditional health portals require typing and navigating complex digital interfaces that seniors find frustrating or inaccessible.

**homeBuddy** bridges the gap between seniors, clinicians, and families through voice:

1. **Clinicians prescribe daily check-ins**: Set customized questions tailored to the senior's conditions (e.g., dialysis recovery, appetite, pain levels) and define what constitutes a warning flag.
2. **Seniors just talk**: An empathetic AI companion, **Rosie**, speaks with the senior over a natural voice call. No typing or screens needed.
3. **Automated clinical triage**: Post-call transcripts are analyzed and classified into **Green, Yellow, or Red** safety statuses based on clinician rules.
4. **Actionable alerts**: Clinicians receive notifications quoting the senior's exact words, allowing them to intervene early and log handled resolutions.
5. **Family peace of mind**: Family members see daily status updates and know immediately when the care team is on top of an issue.

> **Safety Notice:** homeBuddy is an assistive monitoring and communication tool, not a medical diagnosis device. The interface always reminds seniors to dial 911 for emergencies.

---

## ✨ Features

- **Conversational Voice Check-In (`/senior`)**
  - Powered by low-latency Google Gemini Live audio.
  - Rosie asks the clinician's prescribed daily questions conversationally, re-asks unclear answers, and greets seniors based on local time.
  - Live transcript updates in real-time and transitions into an accessible post-call summary.
- **Clinician Care Hub (`/care`)**
  - High-level status overview of all assigned seniors categorized by alert severity.
  - Dedicated patient detail view (`/care/:patientId`) featuring historical vitals charts, care plan management, and question prescribing.
  - Mandatory resolution workflow: marking an alert handled requires logging the care team's action steps.
- **Family Dashboard (`/family`)**
  - Read-only shared view showing today's wellness check status and care team notes.
  - Secure patient linking via unique invite codes.
- **Accessible Design**
  - High-contrast, warm, organic illustrations and Atkinson Hyperlegible typography designed specifically for older eyes and care providers.

---

## 🛠️ Tech Stack

- **Framework**: [TanStack Start v1](https://tanstack.com/start) (React 19, TypeScript, Vite)
- **Styling**: Tailwind CSS v4, Radix UI primitives, Atkinson Hyperlegible font
- **AI & Voice Engine**:
  - **Live Voice**: Google Gemini 2.5 Live Multimodal API via server WebSocket relay (`/api/live`)
  - **Check-in Extraction**: Google Gemini Flash structured summarization
- **Backend & Database**: Supabase (PostgreSQL with Row Level Security, Auth with role separation)
- **Data Visualization**: Recharts
- **Testing**: Vitest, React Testing Library

---

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun
