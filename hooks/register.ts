// context-guard, built for Chris 2026-10-19, rebuilt 2026-11-04 on his rulings of that day; 1.0.2 on 2026-11-06;
// 1.0.3 and 1.0.4 on 2026-11-15; 1.0.5 to 1.0.7 on 2026-11-16 (standing rules text); 1.0.8 on 2026-11-16
// (rules list generated from Global Memory); 1.0.9 on 2026-11-17 (the "mute" / "unmute" shortcut, item 7);
// 1.0.12 on 2026-11-18 (no-go line, item 8); 1.0.13 and 1.0.14 on 2026-11-20 (context line, item 9);
// 1.0.15 on 2026-11-21 (the yes / no rule's offer line; a message that opens with a yes carries no no-go line);
// 1.0.16 on 2026-11-21 (P40 compact in place: the compact_now tool, item 10).
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
//    1.0.15 (Chris 2026-11-21): a yes / no answer now ends with "Would you like me to <the thing>?", so a message
//    that opens with a yes (or is only "sure", "ok", or "okay") is his answer to that line and carries no no-go line.
// 9. Context line (Chris 2026-11-20, 1.0.13): every reply opens with one line the mod hands over beside each
//    message he types: "Context 47% ▓▓▓▓░░░░░░" below 60 percent, and from 60, 65, and 70 percent the bold
//    warning line with signs, e.g. "⚠️ **Context 71% ▓▓▓▓▓▓▓░░░ Fucking wrap up!** ⚠️". Not on the "CC" and
//    "mute" shortcuts, whose replies are exact text. 1.0.14 (Chris 2026-11-20): before the first reading (a
//    session's first message) the line is "Context ##% ░░░░░░░░░░".
// 10. P40 compact in place (Chris's idea 2026-11-19; 1.0.16 on 2026-11-21, his "1" after the throwaway test): a
//    second deferred tool, compact_now. A session that is getting full writes its notes to disk, calls the tool, and
//    ends its turn; about a second after the turn ends the mod queues a real /compact, as if he had typed it,
//    with the P40 resume text as its instructions. The session keeps its row and its conversation. In a session
//    the desktop app hosts, $.session.compact is refused ("not available in a headless (-p / SDK) session
//    yet"), so the working route is $.command.run({ command: 'compact' }) (tested 2026-11-21). The direct call
//    is still tried first: its "a turn is running" refusal is how the mod learns that a waiting message started
//    a new turn, and then the compaction waits for that turn to end. Nothing calls the tool by itself: the
//    warnings are unchanged.
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
// Before the engine has measured anything (a session's first message), Chris 2026-11-20: "##" in place of the number.
export const FIRST_CONTEXT_LINE = 'Context ##% ░░░░░░░░░░'
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

// P40 compact in place (item 10). The tool is matched by its ending, so the hook is the same under any mod name.
const COMPACT_TOOL = /__compact_now$/
const COMPACT_DELAY_MS = 1_000
// One line per step goes into this file beside the notes file, so a compaction the mod started can be read back
// afterwards. Never breaks a hook.
const P40_LOG_NAME = 'P40 Compact Log.txt'
type CompactAsk = { notes: string; inProgress: string; nextStep: string }
export const P40_TEXT = (a: CompactAsk) =>
  'P40 COMPACT IN PLACE (context-guard). This session compacts and keeps going in the same session. It does ' +
  'not hand off, start a new session, or write a handoff because of this compaction.\n\n' +
  'The summary MUST end with a section titled "P40 RESUME" holding the lines below, each on its own line. ' +
  'Copy the FIRST, IN PROGRESS, NOTES, NEXT, and STOP lines exactly as written here; fill the other lines ' +
  'from the conversation, write "none" where one is empty, and never guess.\n' +
  'FIRST: Before the first reply after this compaction, read ALL of Global Memory (the rules file the ' +
  'startup instructions name; a compaction drops it), then all of the NOTES file. Open that reply with the ' +
  'context line, then the IN PROGRESS line word for word, then the answer.\n' +
  `IN PROGRESS: ${a.inProgress}\n` +
  `NOTES: ${a.notes}\n` +
  'OPEN CARD: the card or question in front of Chris, word for word: its TLDR line, every option with its ' +
  'number, and the pick. A card he has not answered stays open.\n' +
  'WAITING ON: what Chris was asked and has not answered.\n' +
  'HIS LAST WORDS: the last thing Chris typed, verbatim.\n' +
  `NEXT: ${a.nextStep}\n` +
  'STOP: After this compaction, do only NEXT, or answer Chris if he has written. Do not act on startup ' +
  'lines, the failure log, or anything else unasked.\n\n' +
  "Keep file paths, numbers, session ids, and Chris's words exactly. Drop tool output and file dumps."

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
// His answer to an offer line ("Would you like me to <the thing>?", the yes / no rule, Chris 2026-11-21): a message
// that opens with a yes, or is nothing but "sure", "ok", or "okay".
const OPENS_WITH_YES = /^\s*(yes|yeah|yep|yup|do that|do so|please do)\b/i
const WHOLE_OK = /^\s*(sure|ok|okay)[\s.!]*$/i
export const NO_GO_LINE = 'NO GO IN THIS MESSAGE: answer, record, or show only.'
export function hasGo(text: string): boolean {
  return GO_WORDS.test(text) || BARE_NUMBER.test(text) || OPENS_WITH_YES.test(text) || WHOLE_OK.test(text)
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
// P40: what compact_now was handed, waiting for the turn to end.
let compactAsked: CompactAsk | undefined
// P40: the log file, set from the folder of the last notes file a call named; none until then.
let p40LogPath: string | undefined

function p40LogBeside(notes: string): void {
  const cut = Math.max(notes.lastIndexOf('/'), notes.lastIndexOf('\\'))
  p40LogPath = cut < 0 ? undefined : `${notes.slice(0, cut + 1)}${P40_LOG_NAME}`
}

async function p40Log($: EngineInterface, line: string): Promise<void> {
  const path = p40LogPath
  if (path === undefined) return
  try {
    let old = ''
    try {
      if (await $.fs.exists(path)) old = await $.fs.read(path)
    } catch {
      // first line of a new log
    }
    await $.fs.write(path, `${old}${new Date().toISOString()} ${line}\n`)
  } catch {
    // the log never breaks a hook
  }
}

// Runs between turns. The direct call carries the rules pin itself (a mod's own hooks do not run on its own
// $.session.compact); a /compact queued through $.command.run passes this mod's session.compact hook, which pins.
async function compactInPlace($: EngineInterface, ask: CompactAsk): Promise<void> {
  const t0 = Date.now()
  const p40 = P40_TEXT(ask)
  try {
    const r = await $.session.compact({ instructions: `${p40}\n\n${PIN_HEADER}${rulesText}` })
    await p40Log($, r.skip === undefined ? `compact done (direct) in ${Date.now() - t0} ms` : `compact SKIPPED by a hook: ${String(r.skip).slice(0, 300)}`)
    return
  } catch (err) {
    const why = String(err).slice(0, 400)
    if (why.includes('a turn is running')) {
      compactAsked = ask // a waiting message started a turn: try again when that turn ends
      await p40Log($, 'a turn is running: queued again for the next turn end')
      return
    }
    // Any other refusal (in a session the desktop app hosts: "not available in a headless (-p / SDK) session
    // yet"): queue a real /compact instead.
    await p40Log($, `direct call refused, queuing a /compact: ${why.slice(0, 160)}`)
  }
  try {
    await $.command.run({ command: 'compact', args: p40 })
    await p40Log($, `compact done (queued /compact) in ${Date.now() - t0} ms`)
  } catch (err) {
    await p40Log($, `queued /compact REFUSED: ${String(err).slice(0, 400)}`)
  }
}

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
    // P40 (item 10), guarded the same way.
    try {
      await $.tool.register({
        name: 'compact_now',
        description:
          'P40 compact in place: compacts this conversation about a second after the current turn ends, and the session keeps going in the same row with its history. Call it only when Chris says to, or when a context-guard line says to. BEFORE calling, write a notes file to disk in the project folder, at _Claude\\P40 Compact Notes\\<session title>.md (leave out any character a file name cannot hold, such as a colon): line 1 "SESSION: <title>"; line 2 "IN PROGRESS: <the one task under way, what is done, the exact step it stopped on, and what comes next>"; then the open card or question word for word, what Chris was asked and has not answered, his last words, his words that still bind, files changed, sessions running, and anything else a summary would lose. Then call this tool (load it with ToolSearch first) with the notes path, that IN PROGRESS line, and the one next action. After the call, end the turn with one short line saying the compaction is queued and takes about a minute or two.',
        inputSchema: {
          type: 'object',
          properties: {
            notes: { type: 'string', description: 'Full path of the notes file just written.' },
            in_progress: { type: 'string', description: 'The IN PROGRESS line of the notes file, word for word.' },
            next: { type: 'string', description: 'The one next action after the compaction, exactly as it would be done.' },
          },
          required: ['notes', 'in_progress', 'next'],
        },
        isDeferred: true,
      })
    } catch {
      // P40 is an extra; the warnings and the rules do not depend on it
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
      context.push(CONTEXT_LINE_ORDER(pct === undefined ? FIRST_CONTEXT_LINE : contextLine(pct)))
    }
    return next({ ...e, context })
  })

  // The model's tool for "what's my context at".
  on('tool.call', { tool: 'mcp__context-guard__context_fill' }, async $ => {
    return { result: await readout($) }
  })

  // P40 (item 10): the session asks for a compaction; it is queued and runs when the turn ends. Notes first:
  // a call that names no notes file on disk is refused.
  on('tool.call', { tool: COMPACT_TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return { result: 'Refused: only the main conversation compacts.' }
    const input = e as unknown as { notes?: unknown; in_progress?: unknown; next?: unknown }
    const notes = String(input.notes ?? '').trim()
    let found = notes.length > 0
    try {
      if (found) found = await $.fs.exists(notes)
    } catch {
      // cannot check: take the path as given
    }
    if (!found) {
      await p40Log($, `compact_now refused: no notes file at "${notes.slice(0, 200)}"`)
      return { result: `Refused: there is no notes file at "${notes}". Write the notes file first, then call again.` }
    }
    p40LogBeside(notes)
    compactAsked = {
      notes,
      inProgress: String(input.in_progress ?? '').trim().slice(0, 2000) || 'none given',
      nextStep: String(input.next ?? '').trim().slice(0, 2000) || 'none given',
    }
    await p40Log($, `compact_now: queued, notes "${notes.slice(0, 200)}"`)
    return {
      result:
        'Compaction queued: it starts about a second after this turn ends. End the turn now with one short line saying so.',
    }
  }).catch(() => ({ result: 'compact_now failed inside the mod; nothing was queued.' }))

  // Between turns, never inside one. A stopped turn drops the queued compaction.
  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId !== undefined || compactAsked === undefined) return result
    const ask = compactAsked
    compactAsked = undefined
    if (e.isAborted) {
      await p40Log($, 'the turn was stopped: the queued compaction is dropped')
      return result
    }
    $.clock.after(COMPACT_DELAY_MS, () => {
      void compactInPlace($, ask)
    })
    return result
  })

  // Whatever triggers a compaction, the summarizer is told to keep the rules and the NEXT pointer.
  // An auto-compaction also records the fire point and scolds.
  on('session.compact', async ($, e, next) => {
    // P40's direct call already carries the pin; never pin twice.
    const instructions = e.instructions?.includes(PIN_HEADER)
      ? e.instructions
      : (e.instructions ? `${e.instructions}\n\n` : '') + PIN_HEADER + rulesText
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
