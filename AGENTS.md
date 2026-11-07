<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Each senior's record (plan, contacts, sharing, check-ins, questions, alerts) is one `patients.state` JSON row read/written via `src/lib/care-store.ts`; family/care team link through `join_patient` invite codes into `patient_members`, and RLS shows family the row only while the senior shares with them; why: one record per senior keeps the existing UI model while access is enforced by the database.
- Status (green/yellow/red) and alert routing rules live only in `src/lib/care.ts` with tests in `care.test.ts`; why: one source of truth for safety rules.
- Voice calls use the persistent `/api/live` relay (`src/lib/live-relay.server.ts`, wired in `src/server.ts` and `live-vite-plugin.ts`) proxying to Google Gemini Live with the server-only `GEMINI_API_KEY`; summaries call Gemini directly too; why: the team chose its own Gemini key, and the key must never reach the browser.
- Post-call transcripts are structured by `runSummary` in `src/lib/checkin.functions.ts`; why: keeps AI extraction server-side and testable.
- Accounts use the connected Supabase auth; profile rows come from the `handle_new_user` trigger, roles from signup metadata or a one-time `choose_role` call (Google/phone users), roles live only in `user_roles`, and role pages sit under `src/routes/_authenticated/` gated by `requireRole` in `src/lib/auth.ts`; why: roles must never be user-editable.

## Team rules

Read `docs/BRIEF.md` first: it says what we're building, for whom, and what the MVP is.

- **MVP first.** Don't start a nice-to-have until the end-to-end flow in the brief works.
- **Demo data only.** Never add real patient names or health information. Seed obviously fictional patients.
- **One home for the safety rules.** The green / yellow / red rules and flag logic live in one file, with tests next to it. Change them there, nowhere else.
- **Not a medical device.** The senior's screen always says to call 911 for emergencies; the AI never diagnoses or gives treatment advice.
- **Branches.** Lovable works on `main`. Anyone coding outside Lovable works on a branch, keeps it small, and merges into `main` often.
- **Never rewrite `main`.** No force pushes, rebases or squashes of pushed commits. Undo with a revert commit.
- **Keep `main` working.** Run `bun run test` and `bun run build` before merging. GitHub runs these plus lint on every push; formatting style isn't checked, so don't reformat files Lovable wrote.
- **Secrets stay out of the repo.** The Supabase publishable key in `.env` is fine. Anything secret goes in Lovable's Secrets.
- **Write decisions down.** When the team decides something, add it to the decision log in `docs/BRIEF.md`.
