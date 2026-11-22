// context-guard, built for Chris 2026-10-19, rebuilt 2026-11-04 on his rulings of that day; 1.0.2 on 2026-11-06;
// 1.0.3 and 1.0.4 on 2026-11-15; 1.0.5 to 1.0.7 on 2026-11-16 (standing rules text); 1.0.8 on 2026-11-16
// (rules list generated from Global Memory); 1.0.9 on 2026-11-17 (the "mute" / "unmute" shortcut, item 7);
// 1.0.12 on 2026-11-18 (no-go line, item 8); 1.0.13 and 1.0.14 on 2026-11-20 (context line, item 9);
// 1.0.15 on 2026-11-21 (the yes / no rule's offer line; a message that opens with a yes carries no no-go line);
// 1.0.16 on 2026-11-21 (P40 compact in place: the compact_now tool, item 10);
// 1.0.17 on 2026-11-21 (P40 auto compact: the warning lines are the trigger, item 11);
// 1.0.21 on 2026-11-21 (one message per turn: the guard, the single working line, and the break, item 12).
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
// 11. P40 auto compact (Chris's rulings 2026-11-21, 1.0.17): the three warning lines become the trigger.
//    At 60 percent a question box asks "Context 61%. Auto compact will begin in 1 minute." with the buttons
//    "Compact now" and "Wait". Compact now, or no tap for a minute, starts it; Wait holds it until the next
//    line. At 65 percent (only after a Wait) the same box again. At 70 percent it starts with no box. Starting
//    it means the mod submits a prompt of its own, a turn once the session is idle, that tells the session to
//    open with "Context 71%. Auto compact is starting now.", write its notes, and call compact_now (item 10).
//    A jump past several lines acts once, on the highest. A session start or a mod reload fires nothing: lines
//    already passed are only marked as passed, so an idle old session never asks. Easy to put back (his word):
//    the whole message "P40 off" in any session stores a flag that brings back the old three warning boxes
//    (item 2) in every session, with no release; "P40 on" returns this. A deferred tool, p40_test, runs the
//    step of line 1, 2, or 3 at the current fill, for tests.
// 12. One message per turn (Chris 2026-11-21, his "Yes" to the rule and "a mod guard backs it"): the rule is
//    "One message per turn, and it comes last." The guard: in a main-loop turn, text the model writes before a
//    tool call is held back (never shown, never recorded) and handed back to the model beside that tool's
//    result, with the order to put what he needs in the turn's one message at the end. Two things pass: the one
//    line "Working on X, about N min", and the reply to a message he typed while the turn was running. To know
//    whether a tool call follows, a step's text is kept until the step shows a tool call or its stop, so the
//    last message appears whole, not word by word. Text held in a turn that ends without a last message is
//    shown beneath it, so nothing is lost. Only the first working line of a turn goes out; later ones (the
//    app asks for a status word every so often) are dropped. And the break (Chris 2026-11-21, "some sort of
//    visual break ... it all blends"; his pick, the heavy line with no words): when anything came before the
//    reply in a turn, a line of sixteen heavy dashes is stamped above it. The whole message "One message off" stores a flag that switches
//    the guard off in every session, with no release; "One message on" returns it.
// 13. No context line while P40 is on (Chris 2026-11-22, "do it in such a way that if the world falls apart
//    and P40 stops working, we can easily bring them back on"): a session that compacts by itself no longer
//    needs its fill shown on every reply, so the context line order (1.0.13) rides beside his message only
//    while the P40 switch is off. "P40 off" brings back the line together with the old warning boxes, in
//    every session, with no release; "P40 on" takes both away again. "CC" still gives the number any time.
import type { EngineInterface, Register, TurnStepChunk } from 'claude-code'

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

// The context line that opens every reply while P40 is off (Chris 2026-11-20; item 13 since 2026-11-22): his
// words for each tier, sentence case, one exclamation mark; a 10-block bar, one block per full 10 percent.
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
  'one message (the last text of the turn; a "Working on" line sent before the tools does not carry it), then ' +
  'a blank line, then the TLDR line; one context line per turn, never repeated (the mod may stamp a line of ' +
  'heavy dashes above your message: never write that line yourself): ' + line

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
  'IN PROGRESS line word for word (under the context line, if the mod hands you one), then the answer.\n' +
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

// P40 auto compact (item 11). His wording, 2026-11-21.
const P40_STORE_KEY = 'p40Auto' // false = off (the old warning boxes); anything else = on
const P40_ASK_MS = 60_000
const P40_BUTTONS = ['Compact now', 'Wait'] as const
export const P40_ASK_TEXT = (p: number) => `Context ${p}%. Auto compact will begin in 1 minute.`
export const P40_START_LINE = (p: number) => `Context ${p}%. Auto compact is starting now.`
const P40_GO_PROMPT = (p: number) =>
  'P40 AUTO COMPACT (context-guard). This session has reached a context line and compacts in place now. ' +
  `Start your reply with exactly this line and nothing before it: ${P40_START_LINE(p)}\n` +
  "Then write your notes file and call the compact_now tool, exactly as that tool's description says (load it " +
  'with ToolSearch first), and end the turn with one short line. Do nothing else in this turn: no other work ' +
  'and no questions.'
// When the mod could not submit the prompt itself, the same order rides beside his next typed message.
const P40_RIDE = (p: number) =>
  'P40 AUTO COMPACT (context-guard): this session has reached a context line. After you have answered the ' +
  `message above, end your reply with exactly this line: ${P40_START_LINE(p)}\n` +
  "Then write your notes file and call the compact_now tool, exactly as that tool's description says (load it " +
  'with ToolSearch first), and end the turn.'
// The whole message "P40 on" or "P40 off", any capitals, trailing periods or spaces allowed.
const P40_SWITCH = /^\s*p40\s+(on|off)[\s.]*$/i
const P40_SWITCH_ORDER = (reply: string) =>
  'CONTEXT-GUARD SHORTCUT: the message above is the P40 switch; the mod has already set it. Reply with ' +
  `exactly this line and nothing else, no tool calls: ${reply}`
const P40_TEST_TOOL = /__p40_test$/

// One message per turn (item 12). Off only when the stored flag is exactly false.
const OMT_STORE_KEY = 'oneMessage'
// The whole message "One message on" or "One message off", any capitals, trailing periods or spaces allowed.
const OMT_SWITCH = /^\s*one\s+message\s+(on|off)[\s.]*$/i
const OMT_SWITCH_ORDER = (reply: string) =>
  'CONTEXT-GUARD SHORTCUT: the message above is the one-message guard switch; the mod has already set it. ' +
  `Reply with exactly this line and nothing else, no tool calls: ${reply}`
// The one line that may go out before the tools (the context line may lead it).
export const OMT_WORKING_LINE = /^\s*(?:[^\n]*Context [\d#]+%[^\n]*\n\s*)?Working on [^\n]{1,200}\s*$/
// The break the mod stamps above the reply (his pick, 2026-11-21): sixteen heavy lines, no words.
export const OMT_BREAK = '━━━━━━━━━━━━━━━━'
// The auto compact's start line (item 11) also goes out before its tools: his ruling.
const OMT_P40_LINE = /^\s*Context \d+%\. Auto compact is starting now\.\s*$/
const OMT_HELD_MAX = 6_000
// What the model reads beside the next tool result when its text was held; Chris never sees it.
export const OMT_HELD_NOTE = (held: string) =>
  '(context-guard) ONE MESSAGE PER TURN: the text you wrote before this tool call was held back. Chris has NOT ' +
  'seen it, and it is not in the conversation. His rule: one message per turn, and it comes last; nothing is ' +
  'written before or between tool calls except one line, "Working on X, about N min", when the work will run ' +
  'over a minute. Finish the tools, then write the one message: it must carry everything he needs from the ' +
  'held text below, once. Write no other text before the tools are done.\nHELD TEXT BEGIN\n' +
  (held.length > OMT_HELD_MAX ? held.slice(0, OMT_HELD_MAX) + '\n[cut]' : held) +
  '\nHELD TEXT END'

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
// P40 auto compact: one start per fill-up (a compaction or a reload clears it), and the percent whose order
// waits to ride beside his next message when the mod could not submit the prompt itself.
let p40GoSent = false
let p40RideNext: number | undefined
// The line p40_test was asked to run, waiting for the turn to end.
let p40TestLine: number | undefined
// One message per turn (item 12): the switch as read at the turn's start; whether a main-loop turn is running;
// text held this turn and not yet handed back to the model; all text held this turn (shown beneath the turn's
// end if no last message came); replies owed to messages he typed while the turn ran.
let omtOn = true
let omtRunning = false
let omtDue: string[] = []
let omtHeld: string[] = []
let omtSaid = false
let omtPass = 0
// Whether anything (a tool call, a working line) came before the reply this turn, and whether the turn's one
// working line has gone out.
let omtBefore = false
let omtWorked = false

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

// One message per turn (item 12): the end of a main-loop turn. Text that was held and never reached him (no
// last message came, or the model never got it back) is shown beneath the turn's end, so nothing is lost.
function omtEnd<R extends { text: string }>(result: R): R {
  const lost = omtDue.length > 0 || !omtSaid ? omtHeld : []
  omtRunning = false
  omtPass = 0
  omtDue = []
  omtHeld = []
  return lost.length === 0 ? result : { ...result, text: lost.join('\n\n') }
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

// P40 auto compact: the switch. Off only when the stored flag is exactly false.
async function p40IsOn($: EngineInterface): Promise<boolean> {
  try {
    return (await $.store.get(P40_STORE_KEY)) !== false
  } catch {
    return true
  }
}

// Starts the auto compact: a prompt of the mod's own, a turn once the session is idle. Once per fill-up.
function p40Go($: EngineInterface, pct: number, how: string): void {
  if (p40GoSent) return
  p40GoSent = true
  void p40Log($, `auto compact starts at ${pct}% (${how})`)
  // Submitted from a timer, never from inside a hook: the engine refuses a prompt from a hook that is holding
  // the turn ("called from a tool.call hook ... submit from a later event"; seen in the tests, 2026-11-21).
  $.clock.after(COMPACT_DELAY_MS, () => {
    void $.prompt.submit({ text: P40_GO_PROMPT(pct) }).then(
      () => undefined,
      async (err: unknown) => {
        p40RideNext = pct
        await p40Log($, `the start prompt was refused, so it rides beside his next message: ${String(err).slice(0, 200)}`)
      },
    )
  })
}

// Lines 1 and 2: the question box. "Compact now" or a minute with no answer starts it; "Wait" (or any typed
// answer) holds it until the next line. A dismissed box is no answer: the minute decides.
function p40Ask($: EngineInterface, pct: number): void {
  let settled = false
  const decide = (how: 'now' | 'wait' | 'timeout'): void => {
    if (settled) return
    settled = true
    if (how === 'wait') {
      void p40Log($, `asked at ${pct}%: Wait`)
      return
    }
    p40Go($, pct, how === 'now' ? 'Compact now' : 'no answer in 1 minute')
  }
  void $.ui.ask(P40_ASK_TEXT(pct), [...P40_BUTTONS]).then(
    answer => decide(answer === P40_BUTTONS[0] ? 'now' : 'wait'),
    () => undefined,
  )
  $.clock.after(P40_ASK_MS, () => decide('timeout'))
}

// The step of one warning line: lines 1 and 2 ask, line 3 starts with no box.
function p40Line($: EngineInterface, line: number, pct: number): void {
  const p = Math.round(pct)
  if (line >= TIER_PCTS.length - 1) p40Go($, p, 'third line, no box')
  else p40Ask($, p)
}

async function onFill($: EngineInterface, pct: number | undefined, window: number | undefined): Promise<void> {
  if (pct === undefined) return
  lastPct = pct
  lastWindow = window
  let crossed = tiersFired
  while (crossed < TIER_PCTS.length && pct >= (TIER_PCTS[crossed] as number)) crossed += 1
  if (crossed === tiersFired) return
  // Marked before the switch is read, so two readings close together cannot both act.
  const from = tiersFired
  tiersFired = crossed
  if (await p40IsOn($)) {
    // P40 auto compact (item 11): a jump past several lines acts once, on the highest.
    p40Line($, crossed - 1, pct)
    return
  }
  // P40 off: the old warning boxes, every line crossed and not yet fired, highest text last.
  for (let i = from; i < crossed; i += 1) {
    const say = TIER_TEXT[i]
    if (say !== undefined) askBox($, say(pct), TIER_BUTTONS)
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
    p40GoSent = false
    p40RideNext = undefined
    // The P40 log sits in the project's notes folder; steps before the first notes file are kept only if
    // that folder already exists.
    const cwd = (e as { cwd?: unknown }).cwd
    if (typeof cwd === 'string' && cwd.length > 0) p40LogBeside(`${cwd}/_Claude/P40 Compact Notes/notes`)
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
    // P40 auto compact (item 11): the test tool, guarded the same way.
    try {
      await $.tool.register({
        name: 'p40_test',
        description:
          'TEST ONLY (P40 auto compact): runs the step of warning line 1, 2, or 3 at the current fill, as if that line had just been crossed: lines 1 and 2 show the "Auto compact will begin in 1 minute" box, line 3 starts the auto compact with no box. Call it only when Chris or a test brief says to; load it with ToolSearch first.',
        inputSchema: {
          type: 'object',
          properties: { line: { type: 'number', description: 'The warning line to act as: 1, 2, or 3.' } },
          required: ['line'],
        },
        isDeferred: true,
      })
    } catch {
      // a test tool only
    }
    try {
      const u = await $.session.usage()
      if (await p40IsOn($)) {
        // P40 auto compact: a session start or a mod reload fires nothing. Lines already passed are marked
        // as passed, so only a session that crosses a line while it is being used asks.
        lastPct = u.context.percent
        lastWindow = u.context.window
        const now = u.context.percent
        tiersFired = now === undefined ? 0 : TIER_PCTS.filter(t => now >= t).length
      } else {
        await onFill($, u.context.percent, u.context.window)
      }
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
    const p40Switch = P40_SWITCH.exec(e.text)
    const omtSwitch = OMT_SWITCH.exec(e.text)
    const isShortcut =
      READOUT_SHORTCUT.test(e.text) || MUTE_SHORTCUT.test(e.text) || p40Switch !== null || omtSwitch !== null
    // One message per turn: a message he types while a turn is running gets its own reply, so the guard lets
    // the next text through.
    if (omtRunning && !isShortcut) omtPass += 1
    if (omtSwitch) {
      const guardOn = (omtSwitch[1] ?? '').toLowerCase() === 'on'
      let saved = true
      try {
        await $.store.set(OMT_STORE_KEY, guardOn)
        omtOn = guardOn
      } catch {
        saved = false
      }
      context.push(
        OMT_SWITCH_ORDER(
          !saved
            ? 'One message switch failed: the setting could not be saved.'
            : guardOn
              ? 'The one-message guard is on.'
              : 'The one-message guard is off.',
        ),
      )
    }
    if (p40Switch) {
      // "P40 off" brings back the old warning boxes in every session; "P40 on" returns the auto compact.
      const turnOn = (p40Switch[1] ?? '').toLowerCase() === 'on'
      let saved = true
      try {
        await $.store.set(P40_STORE_KEY, turnOn)
      } catch {
        saved = false
      }
      context.push(
        P40_SWITCH_ORDER(
          !saved
            ? 'P40 switch failed: the setting could not be saved.'
            : turnOn
              ? 'P40 auto compact is on.'
              : 'P40 auto compact is off. The old warning boxes and the context line are back.',
        ),
      )
    }
    if (!isShortcut && p40RideNext !== undefined) {
      context.push(P40_RIDE(p40RideNext))
      p40RideNext = undefined
    }
    if (!isShortcut && !hasGo(e.text)) context.push(NO_GO_LINE)
    if (READOUT_SHORTCUT.test(e.text)) {
      context.push(`${SHORTCUT_ORDER}BEGIN\n${await readout($)}\nEND`)
    }
    const mute = MUTE_SHORTCUT.exec(e.text)
    if (mute) {
      context.push(await muteOrder($, mute[1] ? 'off' : 'on'))
    }
    // Item 13: the context line rides only while P40 is off; with P40 on the session compacts by itself.
    if (!isShortcut && !(await p40IsOn($))) {
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

  // P40 auto compact (item 11): the test tool runs one line's step at the current fill.
  on('tool.call', { tool: P40_TEST_TOOL }, async ($, e) => {
    if (e.agentId !== undefined) return { result: 'Refused: only the main conversation.' }
    const line = Math.round(Number((e as unknown as { line?: unknown }).line))
    if (!(line >= 1 && line <= TIER_PCTS.length)) return { result: 'Refused: line must be 1, 2, or 3.' }
    if (!(await p40IsOn($))) return { result: 'P40 auto compact is off ("P40 on" turns it on); nothing was run.' }
    p40TestLine = line
    return {
      result:
        line === TIER_PCTS.length
          ? 'Line 3 step queued: when this turn ends, the auto compact starts with no box. End the turn now.'
          : `Line ${line} step queued: when this turn ends, the box comes up. End the turn now.`,
    }
  }).catch(() => ({ result: 'p40_test failed inside the mod; nothing was run.' }))

  // One message per turn (item 12). A main-loop turn starts clean, with the switch as stored.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      omtRunning = true
      omtDue = []
      omtHeld = []
      omtSaid = false
      omtPass = 0
      omtBefore = false
      omtWorked = false
      try {
        omtOn = (await $.store.get(OMT_STORE_KEY)) !== false
      } catch {
        omtOn = true
      }
    }
    return next(e)
  })

  // A step's text is kept from its first piece until the step shows a tool call or its stop. Before a tool call
  // only the working line, the auto compact's start line, and an owed reply go out; anything else is held.
  on('turn.step', async function* ($, e, next) {
    const stream = next(e)
    if (e.agentId !== undefined || !omtOn) return yield* stream
    let kept: TurnStepChunk[] = []
    let text = ''
    let shown = ''
    let sawTool = false
    let heldHere = false
    const settle = (isLast: boolean): TurnStepChunk[] => {
      const out = kept
      const said = text
      kept = []
      text = ''
      if (said.trim().length === 0) return out
      if (!isLast) {
        if (OMT_WORKING_LINE.test(said)) {
          // Only the first working line of a turn goes out; later ones are dropped, unrecorded and unanswered.
          if (omtWorked) {
            heldHere = true
            return out.filter(c => c.kind !== 'text')
          }
          omtWorked = true
        } else if (!OMT_P40_LINE.test(said)) {
          if (omtPass > 0) omtPass -= 1
          else {
            omtDue.push(said.trim())
            omtHeld.push(said.trim())
            heldHere = true
            return out.filter(c => c.kind !== 'text')
          }
        }
        omtBefore = true
        shown += said
        return out
      }
      omtSaid = true
      // The break (Chris 2026-11-21: "it all blends"; his pick, the heavy line with no words): stamped above
      // the reply when anything came before it in this turn. Never doubled if the model wrote one itself.
      if (omtBefore && !said.trimStart().startsWith(OMT_BREAK)) {
        let isStamped = false
        heldHere = true
        shown += `${OMT_BREAK}\n\n${said}`
        return out.map(c => {
          if (isStamped || c.kind !== 'text') return c
          isStamped = true
          return { ...c, text: `${OMT_BREAK}\n\n${c.text}` }
        })
      }
      shown += said
      return out
    }
    for (;;) {
      const r = await stream.next()
      if (r.done) {
        // No stop came (the request failed or was cut off): what was kept goes out as it is.
        for (const c of kept) yield c
        return heldHere ? { ...r.value, answer: shown + text } : r.value
      }
      const c = r.value
      if (c.kind === 'text') {
        kept.push(c)
        text += c.text
      } else if (c.kind === 'tool') {
        sawTool = true
        for (const k of settle(false)) yield k
        omtBefore = true
        yield c
      } else if (c.kind === 'stop') {
        const isLast = !sawTool && c.stopReason !== 'tool_use' && c.stopReason !== 'pause_turn'
        for (const k of settle(isLast)) yield k
        yield c
      } else if (kept.length > 0) kept.push(c)
      else yield c
    }
  })

  // Held text goes back to the model beside the next tool result: the model reads it, Chris never sees it.
  on('tool.call', async ($, e, next) => {
    const r = await next(e)
    if (omtDue.length === 0 || e.agentId !== undefined) return r
    if ((r as { deny?: unknown }).deny !== undefined) return r
    const note = OMT_HELD_NOTE(omtDue.join('\n\n'))
    omtDue = []
    const prior = (r as { context?: unknown }).context
    return { ...r, context: [...(Array.isArray(prior) ? (prior as string[]) : []), note] } as unknown as typeof r
  })

  // Between turns, never inside one. A stopped turn drops the queued compaction.
  on('turn.complete', async ($, e, next) => {
    const under = await next(e)
    if (e.agentId !== undefined) return under
    const result = omtEnd(under)
    // The test tool's line step runs here, at the current fill, as a line just crossed would.
    if (p40TestLine !== undefined) {
      const line = p40TestLine
      p40TestLine = undefined
      if (!e.isAborted) {
        const { pct } = await currentFill($)
        p40GoSent = false
        p40Line($, line - 1, pct ?? (TIER_PCTS[line - 1] as number))
      }
    }
    if (compactAsked === undefined) return result
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
    p40GoSent = false
    p40RideNext = undefined
    return result
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))
}
