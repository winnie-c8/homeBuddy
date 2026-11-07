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
- Demo data lives in a browser-only store (`src/lib/care-store.ts`, localStorage) seeded from `src/lib/care.ts`; why: sample patients first, real accounts and Lovable Cloud come later.
- Status (green/yellow/red) and alert routing rules live only in `src/lib/care.ts` with tests in `care.test.ts`; why: one source of truth for safety rules.
- Voice calls use the persistent `/api/live` relay (`src/lib/live-relay.server.ts`, wired in `src/server.ts` and `live-vite-plugin.ts`); the browser sends patient context in `app.start`; why: Live sessions need an open control socket for the whole call.
- Post-call transcripts are structured by `runSummary` in `src/lib/checkin.functions.ts`; why: keeps AI extraction server-side and testable.
