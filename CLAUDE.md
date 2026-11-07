@AGENTS.md
@docs/BRIEF.md

## Working in this repo with Claude Code

- This repo is synced with Lovable. Lovable commits straight to `main`, so pull before starting work: `git switch main && git pull`.
- Work on a branch named after the change, e.g. `kaitlyn/trend-view`. Merge into `main` only after the checks below pass and the owner has looked at it.
- Before merging, run: `bun install`, `bunx eslint . --rule "prettier/prettier: off"`, `bun run test`, `bun run build` (the same as the GitHub check). Don't reformat files Lovable wrote.
- Never add a `Co-Authored-By` line (or any Claude attribution) to commits or pull requests in this repo, including merge commits. Claude must not appear as a contributor.
- Database changes (tables, columns, access rules) go through Lovable: write the prompt, or send it with the Lovable connector if it's connected. The Supabase connector is read-only, for checking tables, data and access rules.
- Don't edit files Lovable manages (see the Lovable block in `AGENTS.md`). If one needs changing, write the prompt for a teammate to send to Lovable.
- The deadline is 5:00 pm EST. Prefer the smallest change that makes the MVP flow work; say so when something would take longer than 30 minutes.
