# context-guard

Chris's context guard, a Claude Code mod. Built 2026-10-19, rebuilt 2026-11-04 on his rulings of that day.

What it does:

1. **Meter.** The engine pushes the context fill on every change (`session.measure`). No timer, no tokens.
2. **Three warnings** before auto-compaction, each a question box (the one channel both the desktop app and the phone draw; toasts, the status line, bands, panes, log rows, and native notifications were all tested 2026-11-04 and do not show). Tiers sit at the fire point minus 15 / 8 / 3 points: placeholder 68 / 75 / 80 on a 200K window until the first real auto-compaction measures the fire point, which is then stored per window size and persists across sessions. Each tier fires once per session and re-arms after a compaction.
   - `Context NN percent. WRAP UP SOON. ...`
   - `Context NN percent. I SAID WRAP UP! ...`
   - `Context NN percent. WRAP UP NOW!! ...`
3. **On an auto-compaction:** a scolding box ("We blew it ... say handoff and start a new session immediately"), the fire point recorded, and the standing rules pinned into the compaction summary with a NEXT section.
4. **`mcp__context-guard__context_fill`**, a tool the model calls only when Chris asks where context is at. Zero cost until asked.
5. **Standing rules ride beside every message Chris types** (`prompt.submit` context, about 600 tokens). This replaces the 30-minute rules-reload timer. The text comes from `Standing Rules.md` in this repo, fetched at every session start; `hooks/rules.ts` holds a baked fallback for when the fetch fails. `prompt.compose` and `prompt.context` are blocked for mods by the default security plugin, so they are not used.

## Changing the rules

Edit `Standing Rules.md` on the `main` branch. Every new session picks it up at start. No reinstall. Keep the baked copy in `hooks/rules.ts` in step when convenient.

## Install

At the prompt of a terminal Claude Code session:

```
/plugin install context-guard --marketplace csteuble/claude-context-guard
```

Answer `y` to add the marketplace, then pick a scope (user). The repo is private; the installing account needs access to it and GitHub set up for Claude.

## Checks

`claude plugin validate .` passes; `tsc -p .` is clean once the engine has laid the types; `claude plugin test .` runs 8 tests (tiers, jump, auto and manual compaction, stored fire point, rules fetch and fallback, the tool).
