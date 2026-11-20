# context-guard

Chris's context guard, a Claude Code mod. Built 2026-10-19, rebuilt 2026-11-04 on his rulings of that day.

What it does:

1. **Meter.** The engine pushes the context fill on every change (`session.measure`). No timer, no tokens.
2. **Three warnings** at fixed points of 60, 65, and 70 percent, each a question box (the one channel both the desktop app and the phone draw; toasts, the status line, bands, panes, log rows, and native notifications were all tested 2026-11-04 and do not show). Each fires once per session and re-arms after a compaction. NN is the actual percent at that moment. Buttons: `Good Day to you` / `I said Good Day!`. The answer is not used; either button closes the box.
   - `CONTEXT: NN% - Wrap up soon.`
   - `CONTEXT: NN% - I said wrap up!`
   - `CONTEXT: NN% - WRAP THE FUCK UP!!`
   The real auto-compaction fire point is still measured on every auto-compaction and stored per window size; it no longer moves the warnings.
3. **On an auto-compaction:** a scolding box ("We blew it ... say handoff and start a new session immediately", buttons `Sure fucked that up` / `Fuck fuck fuck fuck`), the fire point recorded, and the standing rules pinned into the compaction summary with a NEXT section.
4. **`mcp__context-guard__context_fill`**, a tool the model calls only when Chris asks where context is at. Zero cost until asked. It answers with the readout, which the model shows exactly as returned: two blank lines, `**CONTEXT: NN%** (tokens of window tokens)`, two blank lines. Each blank line is a paragraph holding a non-breaking space, so the chat cannot squeeze it away. When the rules did not load from GitHub, one blank line and the italic lines `*RULES BROKEN*` / `*Start a new session or tell Claude to fix it.*` (joined by a hard line break) go before the closing blank lines. Since 1.0.2 it is registered as a deferred tool: the model loads it with ToolSearch (`select:mcp__context-guard__context_fill`) and then calls it. Deferred is what gets it announced when the mod attaches after a conversation has started (the 2026-11-06 mid-session attach left a kept-in-front tool registered but never announced).
5. **Standing rules ride beside every message Chris types** (`prompt.submit` context, about 600 tokens). This replaces the 30-minute rules-reload timer. The text comes from `Standing Rules.md` in this repo, fetched at every session start; `hooks/rules.ts` holds a baked fallback for when the fetch fails. `prompt.compose` and `prompt.context` are blocked for mods by the default security plugin, so they are not used. When the fetch fails, a box pops at session start: `RULES BROKEN` / `Start a new session or tell Claude to fix it.`, buttons `Got it` / `Thanks`.
6. **Shortcuts**, read only when they are the whole message (any capitals; trailing periods, question marks, and spaces allowed):
   - `CC` or `Context`: the reply is the readout alone. A mod's only way to write in chat without a Claude turn is a plain notice, which cannot carry the bold line or the forced blank lines, so the mod writes the readout into the message's hidden context with the order to reply with it alone, and Claude replies.
   - `CC TEST`: the mod pops the 60 percent warning box once with the current percent and drops the message, so no Claude turn runs. The drop's reason is a zero-width space, so no text line shows. The test does not use up the real 60 percent warning.
   - `mute` or `unmute` (no question mark): the mod runs `tools/Set Mute.ps1 on` or `off`, which SETS the PC's default playback device muted or unmuted through the Windows Core Audio API (never a toggle), then hands Claude the one-word reply, `Muted.` or `Unmuted.`, the way `CC` hands over the readout. A failed set makes the reply one line saying so. If the engine refuses the mod's `$.process.run`, Claude is handed the exact PowerShell command to run instead. Works from the phone over Remote Control, since the hook runs on the PC.

## Changing the rules

Never edit `Standing Rules.md` or the baked copy by hand. Since 1.0.8 the one source is the STANDING RULES section of Chris's Global Memory (`C:\HomeInnovation\000 VAULT\_System\Global Memory.md`); the vault script `Check Rules Copies.py --push "<what changed>"` writes both files from it, bumps the version, pushes to `main`, and updates the PC install. Every new session picks up `Standing Rules.md` at start; the baked copy changing makes each rules edit a code change (run the tests and the delivery check).

## Install

At the prompt of a terminal Claude Code session:

```
/plugin install context-guard --marketplace csteuble/claude-context-guard
```

Answer `y` to add the marketplace, then pick a scope (user). The repo is private; the installing account needs access to it and GitHub set up for Claude.

## Checks

`claude plugin validate .` passes; `tsc -p .` is clean once the engine has laid the types; `claude plugin test .` runs 29 tests (warnings and their text, jump, auto and manual compaction, stored fire point, rules fetch and fallback, RULES BROKEN box and readout, the tool, the shortcuts, mute and unmute).

## Versions

- 1.0.14 (2026-11-20): before the first reading (a session's first message) the context line is `Context ##% ░░░░░░░░░░`; one test added (29 total).
- 1.0.13 (2026-11-20): every reply opens with the context line the mod hands over.
- 1.0.12 (2026-11-18): the no-go line rides beside a message that holds none of Chris's go words.

- 1.0.9 (2026-11-17): the `mute` / `unmute` shortcut and its setter `tools/Set Mute.ps1`; four tests added (19 total).

- 1.0.8 (2026-11-16): the rules list is now generated from Chris's Global Memory (his rulings D1, C2, C3, C6, and C7): one go list on the question line, the answer-first line gains the two-read cap, and the two Wood Usage lines leave the list for the Wood Usage project.
- 1.0.7 (2026-11-16): three standing rules lines reworded on Chris's rulings: the SendUserMessage line is now plain text before the next tool call (SendUserMessage in Cowork), and "(in Code)" in the header and the context line.
- 1.0.6 (2026-11-16): one new standing rule (reads top down; "come back to it" re-presents all the rest), added to `Standing Rules.md` and the baked copy.
- 1.0.5 (2026-11-16): the baked fallback rules in `hooks/rules.ts` re-synced to `Standing Rules.md` word for word (it still carried the two rules replaced on 2026-11-12 and lacked the context line).
- 1.0.4 (2026-11-15): two buttons of Chris's on every box: warnings `Good Day to you` / `I said Good Day!`, auto-compaction `Sure fucked that up` / `Fuck fuck fuck fuck`, RULES BROKEN `Got it` / `Thanks`; `CC TEST` shows no line in chat.
- 1.0.3 (2026-11-15): warnings at fixed 60 / 65 / 70 with new text; the readout is the bold CONTEXT line between forced blank lines, with no fire point, tiers, or rules source; RULES BROKEN box and readout lines when the rules did not load from GitHub; the `CC`, `Context`, and `CC TEST` shortcuts; 15 tests.
- 1.0.2 (2026-11-06): the tool is deferred so it is announced on a mid-conversation attach; the register call is guarded so a refusal cannot stop session start; two tests added (10 total); the marketplace entry carries the version.
- 1.0.1 (2026-11-05): the first warning is fixed at 65 percent (Chris's ruling); tiers 2 and 3 stay at the fire point minus 8 and 3.
- 1.0.0 (2026-11-04): first release.
