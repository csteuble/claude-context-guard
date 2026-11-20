// context-guard, built for Chris 2026-10-19, rebuilt 2026-11-04 on his rulings of that day; 1.0.2 on 2026-11-06;
// 1.0.3 and 1.0.4 on 2026-11-15; 1.0.5 to 1.0.7 on 2026-11-16 (standing rules text); 1.0.8 on 2026-11-16
// (rules list generated from Global Memory); 1.0.9 on 2026-11-17 (the "mute" / "unmute" shortcut, item 7).
//
// 1. Meter: the engine pushes the context fill on every change (session.measure). No timer.
// 2. Three warnings, each a question box (the one channel both his desktop and phone draw), at fixed points of
//    60, 65, and 70 percent (Chris, 2026-11-15). Each fires once per session and re-arms after a compaction.
//    The real auto-compaction fire point is still measured on an auto-compaction and stored per window size.
// 3. On an auto-compaction: a scolding box, and the standing rules pinned into the summary.
// 4. A tool, mcp__context-guard__context_fill (deferred; the model loads it with ToolSearch), called only when
//    Chris asks where context is at. It answers with the readout, which the model shows as is.
// 5. The standing rules ride as hidden context beside every message Chris types (prompt.submit); the
//    text is fetched from the GitHub repo at session start, baked copy as fallback. When the fetch fails,
//    a RULES BROKEN box pops at session start and the readout carries the RULES BROKEN lines.
//    (prompt.compose and prompt.context are blocked for mods by the default security plugin; tested 2026-11-04.)
// 6. Shortcuts (whole message only): "CC" or "Context" gets the readout alone; "CC TEST" pops the 60 percent
//    box once and nothing else. A mod's only way to write in chat without a Claude turn is a plain notice,
//    which cannot carry the bold line and forced blank lines, so "CC" goes to Claude with the readout
//    already written and the order to reply with it alone. "CC TEST" is answered by the mod: the box pops
//    and the message is dropped, so no Claude turn runs and no line is shown.
// 7. "mute" / "unmute" (whole message, Chris 2026-11-17): the mod runs tools\Set Mute.ps1 on or off, which SETS
//    the default playback device's mute state (never a toggle), then hands Claude the one-word reply
//    ("Muted." or "Unmuted.") the way "CC" hands over the readout; a failed set is a one-line reply saying so.
//    The script is found through installed_plugins.json, so the hook needs no path of its own. If the
//    engine refuses $.process.run, the order carries the exact PowerShell command for Claude to run instead.
// 8. No-go line (Chris 2026-11-18, failure-log card 3, Option 1): when a message holds none of his go words
//    and is not a bare option number, one line rides beside it saying so. It nudges; it blocks nothing.
// 9. Context line (Chris 2026-11-20, 1.0.13): every reply opens with one line the mod hands over beside each
//    message he types: "Context 47% ▓▓▓▓░░░░░░" below 60 percent, and from 60, 65, and 70 percent the bold
//    warning line with signs, e.g. "⚠️ **Context 71% ▓▓▓▓▓▓▓░░░ Fucking wrap up!** ⚠️". Not on the "CC" and
//    "mute" shortcuts, whose replies are exact text.
import type { EngineInterface, Register } from 'claude-code'

import { RULES, RULES_URL } from './rules'

const STORE_KEY = 'firePoints'

// Chris, 2026-11-15: fixed points, no longer tied to the fire point.
const TIER_PCTS = [60, 65, 70] as const

// Chris's wording, 2026-11-15. The number is the actual percent at that moment.
const TIER_TEXT = [
  (p: number) => `CONTEXT: ${p}% - Wrap up soon.`,
  (p: number) => `CONTEXT: ${p}% - I said wrap up!`,
  (p: number) => `CONTEXT: ${p}% - WRAP THE FUCK UP!!`,
] as const

// The context line that opens every reply (Chris 2026-11-20): his words for each tier, sentence case, one
// exclamation mark; a 10-block bar, one block per full 10 percent.
const CONTEXT_LINE_TEXT = ['Wrap up soon.', 'I said wrap up!', 'Fucking wrap up!'] as const
export function contextLine(pct: number): string {
  const p = Math.round(pct)
  const filled = Math.min(10, Math.max(0, Math.floor(p / 10)))
  const bar = '▓'.repeat(filled) + '░'.repeat(10 - filled)
  let tier = -1
  TIER_PCTS.forEach((t, i) => {
    if (p >= t) tier = i
  })
  const say = CONTEXT_LINE_TEXT[tier]
  return say === undefined ? `Context ${p}% ${bar}` : `⚠️ **Context ${p}% ${bar} ${say}** ⚠️`
}
const CONTEXT_LINE_ORDER = (line: string) =>
  'CONTEXT LINE (context-guard): make this exact line, character for character, the very first line of your ' +
  'reply, then a blank line, then the TLDR line; one context line per reply, never repeated: ' + line

// Button pairs, Chris 2026-11-15. Two labels each, so the dialog adds no button of its own.
const TIER_BUTTONS = ['Good Day to you', 'I said Good Day!'] as const
const COMPACTED_BUTTONS = ['Sure fucked that up', 'Fuck fuck fuck fuck'] as const
const RULES_BROKEN_BUTTONS = ['Got it', 'Thanks'] as const

const COMPACTED_TEXT = (p: number) =>
  `Auto-compacted at ${p} percent. WE BLEW IT: the warnings were there and nobody wrapped up. I am dumber now. Say handoff and start a new session immediately.`

const RULES_BROKEN_BOX = 'RULES BROKEN\nStart a new session or tell Claude to fix it.'

const PIN_HEADER =
  'COMPACTION INSTRUCTIONS FROM THE context-guard PLUGIN: the summary MUST end with a section titled ' +
  '"STANDING RULES (kept through compaction)" that reproduces the text below word for word, and a section ' +
  'titled "NEXT" naming the exact next action, the card or table in front of the person, and the last thing ' +
  'they said. Keep every format rule the person stated during the conversation, verbatim.\n\n'

// A line holding only a non-breaking space, so the chat cannot squeeze a blank line away.
const BLANK = ' '

// Whole-message shortcuts: any capitals, trailing periods, question marks, or spaces allowed.
const READOUT_SHORTCUT = /^\s*(cc|context)[\s.?]*$/i
const TEST_SHORTCUT = /^\s*cc\s+test[\s.?]*$/i
// "mute" or "unmute", any capitals, surrounding spaces or trailing periods allowed (no question mark: "mute?" is a
// question, not an order).
const MUTE_SHORTCUT = /^\s*(un)?mute[\s.]*$/i

// His go list (Global Memory, ACT-ONLY-ON-GO gate G1): "execute", "go", "do it", "fix it", "change it", "build",
// "write it", or a bare option number on a presented card.
const GO_WORDS = /\b(execute|go|do it|fix it|change it|build|write it)\b/i
const BARE_NUMBER = /^\s*\d+[\s.!]*$/
export const NO_GO_LINE = 'NO GO IN THIS MESSAGE: answer, record, or show only.'
export function hasGo(text: string): boolean {
  return GO_WORDS.test(text) || BARE_NUMBER.test(text)
}

// The setter's command, one PowerShell line with no double quotes (argv goes through Windows quoting): it finds
// the installed mod through installed_plugins.json and runs tools\Set Mute.ps1 with on or off.
const MUTE_SCRIPT = (state: 'on' | 'off') =>
  "$j = Join-Path $env:USERPROFILE '.claude\\plugins\\installed_plugins.json'; " +
  "$p = (Get-Content -Raw $j | ConvertFrom-Json).plugins.'context-guard@claude-context-guard'[0].installPath; " +
  `& (Join-Path $p 'tools\\Set Mute.ps1') ${state}`
const MUTE_ARGV = (state: 'on' | 'off') => [
  'powershell',
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  MUTE_SCRIPT(state),
]

// Module state; a reload starts it over, which is right (fresh flags).
let rulesText = RULES
let rulesSource: 'repo' | 'baked' = 'baked'
let lastPct: number | undefined
let lastWindow: number | undefined
let tiersFired = 0

async function loadRules($: EngineInterface): Promise<void> {
  try {
    const res = await $.http.fetch(RULES_URL)
    if (res.ok && res.text.trim().length > 100) {
      rulesText = res.text.trim()
      rulesSource = 'repo'
      return
    }
  } catch {
    // offline or blocked: the baked copy stands
  }
  rulesText = RULES
  rulesSource = 'baked'
}

async function recordFirePoint($: EngineInterface, window: number | undefined, pct: number): Promise<void> {
  if (!window) return
  try {
    const stored = ((await $.store.get(STORE_KEY)) as Record<string, number> | undefined) ?? {}
    await $.store.set(STORE_KEY, { ...stored, [String(window)]: pct })
  } catch {
    // best effort
  }
}

function askBox($: EngineInterface, text: string, buttons: readonly string[]): void {
  // The box is the one channel both his desktop and phone draw (tested 2026-11-04). It waits for a click;
  // the answer is not used, so a dismissal is fine too.
  void $.ui.ask(text, [...buttons]).catch(() => undefined)
}

async function onFill($: EngineInterface, pct: number | undefined, window: number | undefined): Promise<void> {
  if (pct === undefined) return
  lastPct = pct
  lastWindow = window
  // Fire every tier crossed and not yet fired, highest text last.
  while (tiersFired < TIER_PCTS.length) {
    const threshold = TIER_PCTS[tiersFired]
    const say = TIER_TEXT[tiersFired]
    if (threshold === undefined || say === undefined || pct < threshold) break
    tiersFired += 1
    askBox($, say(pct), TIER_BUTTONS)
  }
}

async function currentFill($: EngineInterface): Promise<{ pct?: number; tokens?: number; window?: number }> {
  let pct = lastPct
  let tokens: number | undefined
  let window = lastWindow
  try {
    const u = await $.session.usage()
    pct = u.context.percent ?? pct
    tokens = u.context.tokens
    window = u.context.window ?? window
  } catch {
    // report what the last push gave
  }
  return { pct, tokens, window }
}

// The readout, exactly as Chris set it (2026-11-15): two blank lines, the CONTEXT line with only
// "CONTEXT: NN%" in bold, then two blank lines; when the rules did not load from GitHub, one blank line and
// the two italic RULES BROKEN lines go before the closing blank lines. Each blank line is a paragraph
// holding a non-breaking space; the two italic lines are joined by a hard line break.
async function readout($: EngineInterface): Promise<string> {
  const { pct, tokens, window } = await currentFill($)
  const line = `**CONTEXT: ${pct ?? '?'}%** (${tokens ?? '?'} of ${window ?? '?'} tokens)`
  const parts: string[] = [BLANK, BLANK, line]
  if (rulesSource !== 'repo') {
    parts.push(BLANK, '*RULES BROKEN*\\\n*Start a new session or tell Claude to fix it.*')
  }
  parts.push(BLANK, BLANK)
  return parts.join('\n\n')
}

const SHORTCUT_ORDER =
  'CONTEXT-GUARD SHORTCUT: the message above is the readout shortcut. Reply with exactly the text between ' +
  'the BEGIN and END marker lines below, character for character (keep every line that holds only a ' +
  'non-breaking space, the bold, the italics, and the backslash line break), with nothing before or after it ' +
  'and no tool calls. Do not include the marker lines.\n'

const MUTE_ORDER = (reply: string) =>
  'CONTEXT-GUARD SHORTCUT: the message above is the mute shortcut; the mod has already run it. Reply with ' +
  `exactly this line and nothing else, no tool calls: ${reply}`

const MUTE_FALLBACK_ORDER = (state: 'on' | 'off') =>
  'CONTEXT-GUARD SHORTCUT: the message above is the mute shortcut, and the mod could not run it itself. Run ' +
  'this exact command with your PowerShell tool, then reply with exactly the line it prints and nothing else ' +
  `("${state === 'on' ? 'Muted.' : 'Unmuted.'}" when it worked; when it prints FAILED, one line saying the ` +
  `mute did not work and why):\n${MUTE_SCRIPT(state).replace('& (Join-Path', 'powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path')}`

// Runs the setter; answers the hidden-context order for Claude.
async function muteOrder($: EngineInterface, state: 'on' | 'off'): Promise<string> {
  const want = state === 'on' ? 'Muted.' : 'Unmuted.'
  let r: { exitCode: number; stdout: string; stderr: string }
  try {
    r = await $.process.run(MUTE_ARGV(state), { timeoutMs: 30_000 })
  } catch {
    return MUTE_FALLBACK_ORDER(state)
  }
  const out = r.stdout.trim()
  if (r.exitCode === 0 && out === want) return MUTE_ORDER(want)
  const why = (out || r.stderr.trim() || `exit code ${r.exitCode}`).replace(/\s+/g, ' ').slice(0, 200)
  return MUTE_ORDER(`${state === 'on' ? 'Mute' : 'Unmute'} failed: ${why}`)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadRules($)
    tiersFired = 0
    if (rulesSource !== 'repo') askBox($, RULES_BROKEN_BOX, RULES_BROKEN_BUTTONS)
    // Deferred (2026-11-06): a tool kept in front is not announced to the model when the mod attaches after
    // the conversation started (the 11-06 mid-session attach), while deferred tools are listed and loaded
    // with ToolSearch. The register call is guarded so a rejection can never skip next(e).
    try {
      await $.tool.register({
        name: 'context_fill',
        description:
          'Answers how full the context window is right now, as a ready-made readout. Call it only when Chris asks where context is at; load it with ToolSearch first. Show its result exactly as returned, with nothing added.',
        inputSchema: { type: 'object', properties: {} },
        isDeferred: true,
      })
    } catch {
      // the tool is a convenience; the warnings and the rules do not depend on it
    }
    try {
      const u = await $.session.usage()
      await onFill($, u.context.percent, u.context.window)
    } catch {
      // no usage yet
    }
    return next(e)
  })

  // The engine pushes every change of the fill; no timer.
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      await onFill($, e.context.percent, e.context.window)
    }
    return next(e)
  })

  // The standing rules ride beside every message Chris types; the shortcuts are read here too.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    if (TEST_SHORTCUT.test(e.text)) {
      const { pct } = await currentFill($)
      askBox($, TIER_TEXT[0](pct ?? TIER_PCTS[0]), TIER_BUTTONS)
      // Chris, 2026-11-15: no "CC TEST" line in chat. The engine shows a drop's reason, so the reason is a
      // zero-width space (a drop needs a non-empty reason).
      return { drop: '​' }
    }
    const context = [...(e.context ?? []), rulesText]
    const isShortcut = READOUT_SHORTCUT.test(e.text) || MUTE_SHORTCUT.test(e.text)
    if (!isShortcut && !hasGo(e.text)) context.push(NO_GO_LINE)
    if (READOUT_SHORTCUT.test(e.text)) {
      context.push(`${SHORTCUT_ORDER}BEGIN\n${await readout($)}\nEND`)
    }
    const mute = MUTE_SHORTCUT.exec(e.text)
    if (mute) {
      context.push(await muteOrder($, mute[1] ? 'off' : 'on'))
    }
    if (!isShortcut) {
      const { pct } = await currentFill($)
      if (pct !== undefined) context.push(CONTEXT_LINE_ORDER(contextLine(pct)))
    }
    return next({ ...e, context })
  })

  // The model's tool for "what's my context at".
  on('tool.call', { tool: 'mcp__context-guard__context_fill' }, async $ => {
    return { result: await readout($) }
  })

  // Whatever triggers a compaction, the summarizer is told to keep the rules and the NEXT pointer.
  // An auto-compaction also records the fire point and scolds.
  on('session.compact', async ($, e, next) => {
    const instructions = (e.instructions ? `${e.instructions}\n\n` : '') + PIN_HEADER + rulesText
    const result = await next({ ...e, instructions })
    if (e.trigger === 'precompute' || result.skip !== undefined) return result
    const pct = lastPct
    if (e.trigger === 'auto' && pct !== undefined) {
      await recordFirePoint($, lastWindow, pct)
      askBox($, COMPACTED_TEXT(pct), COMPACTED_BUTTONS)
    }
    tiersFired = 0
    return result
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))
}
