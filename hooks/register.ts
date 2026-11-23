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
// 14. The reply header (Chris 2026-11-22: he reads on his phone, queues several messages, and cannot tell which
//    reply answers which; his words: "horizontal line, no spacing, no blank lines at all, and then the text that
//    it's addressing, and then a blank line, and maybe that text is italicized, and then your response"). The form
//    is a quote bar, not the heavy line: his phone shows a full gap after any kind of line break under the line
//    (his screenshot of 2026-11-22), so he picked his words in a markdown quote, in italics, with no line above.
//    A reply to a message he typed opens with "> *his words*" (one line, cut to 100 characters with "…"), then
//    one blank line. Words that clean to nothing get the bare line rule of item 12. The turn's last message carries
//    the words of the message that started the turn, always, even with nothing before it; the reply let through
//    for a message typed while the turn ran carries that message's words. His typed message is one that reaches
//    prompt.submit from the composer, the phone bridge, or the desktop app's SDK host, and is not a slash command,
//    a meta prompt, a shortcut, or the mod's own auto compact prompt (a plugin origin). A turn with none of his
//    words (the mod's prompt, a task notification) keeps the bare line of item 12. Shortcut replies, the working
//    line, the auto compact start line, the guard off, and subagents: no header, as before.
// 17. The long turn guard (1.0.30, Chris 2026-11-22: "you do shit in the background and maybe I wanna make that a
//    rule so that you can fucking answer me and we keep replying"). A message he sends while a turn runs does not
//    reach the session until the turn ends, so a long turn means he is ignored, and a rule alone had not held. In a
//    main session only: a shell call that plainly waits over a minute in the foreground is refused with the order
//    to run it in the background and end the turn; once a turn has run over a minute, a note rides beside the next
//    tool result (at most once a minute) to hand the rest to the background and end the turn; and every turn that
//    ran over a minute gets a line in Long Turn Log.txt beside the P40 log. Time a question box waits on him and
//    time a compaction takes are not the turn's; the mod's own auto compact turn is left alone. A worker says so:
//    a line LONG TURNS OK in its brief (the engine gives a mod nothing that tells his main from a worker another
//    session started). The whole message "Long turn off" switches it off in every session, "Long turn on" back.
// 18. The Peck type (1.0.31; Chris "1", 2026-11-22 11:50, and his worker effort and model ruling of 12:59): the mod
//    registers a subagent type, context-guard:peck, so a Peck a main starts as that type gets his defaults without
//    naming them: Opus at High effort, every tool the main has, and it compacts its own conversation at 300,000
//    tokens (Porter's number on the card he picked; he did not change it). A model or effort named on the start
//    still wins (rule E1 has the main name them by the job). The name is his (2026-11-22 evening: "I don't think
//    they're workers. they're pecks", then "Pecks"); until then it was the placeholder "worker".
// 19. The 60-second ask for Fable or Max (1.0.31; rule E6, Chris 2026-11-22 13:08): a deferred tool, ask_a_peck (his
//    phone shows the call as "Used Ask a Peck"; his name, 2026-11-22 evening), the main calls as the last thing before
//    a Peck start when it thinks the job needs Fable or Max. It shows a box with two buttons (the higher option, the
//    lower one) and waits a minute; no answer, or a closed box, means the lower option. The box's three lines are his,
//    approved as shown ("3 approved"): "Job: <the job>", "Run this Peck on <the higher option>?", and "No answer in
//    60 seconds: <the lower option>.". No box on an unattended run (the call says unattended: true), in a Peck session
//    (its brief carried LONG TURNS OK, item 17), or from a subagent: the lower option, straight off. When the answer
//    is the lower option, it hands the main one line for the Peck's brief, so the Peck's report says it ran lower than
//    the main wanted; not when he tapped the lower option himself (Chris "1", 2026-11-22 evening): then the line is
//    handed only for no box, no answer in the minute, a box closed with no pick, or words typed instead of a tap. The mod cannot take its own box down (an ask skips the asking mod's hooks; tested 2026-11-22), so the
//    companion plugin context-guard-box closes it at its minute, as it does the P40 box. When the box is still up a
//    moment after the minute (the companion is not loaded in that session), the answer says so and the P40 log notes
//    it; the P40 box (item 11) gets the same note in the log.
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

// While P40 is on (Chris "1", 2026-11-22): the app compacting the main conversation by itself means P40 missed,
// and a handoff is the wrong advice. "P40 off" keeps the old words above.
export const COMPACTED_P40_TEXT = (p: number) =>
  `Auto-compacted at ${p} percent before P40 could. Stay in this session. Nothing to do.`
// The same case: no notes file and no P40 RESUME came before it, so the summary also carries the order to re-read
// Global Memory, as a P40 compaction's does.
export const AUTO_REREAD =
  'COMPACTION INSTRUCTION FROM THE context-guard PLUGIN (the app compacted by itself): the summary MUST also ' +
  'hold this line, word for word, right above its "STANDING RULES (kept through compaction)" section: FIRST: ' +
  'Before the first reply after this compaction, read ALL of Global Memory (the rules file the startup ' +
  'instructions name; a compaction drops it).\n\n'

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
const P40_GO_HEAD = 'P40 AUTO COMPACT (context-guard).'
const P40_GO_PROMPT = (p: number) =>
  `${P40_GO_HEAD} This session has reached a context line and compacts in place now. ` +
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
// The reply header (item 14): his words in italics in a quote bar, one line, then one blank line; "" when his
// words clean to nothing. Cleaning makes it one line and the escapes keep it inside the quote and the italics.
export const OMT_QUOTE_MAX = 100
export function omtHeader(words: string): string {
  let chars = Array.from(words.replace(/\s+/g, ' ').trim())
  const isCut = chars.length > OMT_QUOTE_MAX
  if (isCut) {
    // At a word boundary when one is in the last 20 characters (a space right after the cut counts).
    const space = chars[OMT_QUOTE_MAX] === ' ' ? OMT_QUOTE_MAX : chars.lastIndexOf(' ', OMT_QUOTE_MAX - 1)
    chars = chars.slice(0, space >= OMT_QUOTE_MAX - 20 ? space : OMT_QUOTE_MAX)
  }
  // Counted on what he sees, so a cut never splits an escape. A leading ">" is already escaped by the first pass.
  const said = chars.join('').trimEnd().replace(/[\\*_`[\]<>~|]/g, '\\$&').replace(/^[#+-]/, '\\$&')
  return said.length === 0 ? '' : `> *${said}${isCut ? '…' : ''}*\n\n`
}
// The whole header above a reply to a message he typed: the line, a blank line, then the quote (Chris 2026-11-22,
// after picking the quote: "leave the horizontal line that we had in there as well? I know it adds an extra blank
// line, but it's easy for me to scroll quickly and identify, so make sure you put that back in"). "" when his
// words clean to nothing.
export function omtFullHeader(words: string): string {
  const quote = omtHeader(words)
  return quote === '' ? '' : `${OMT_BREAK}\n\n${quote}`
}
// The full-message row (item 15, Chris 2026-11-22: "can I have a ... where I could click it and it would expand
// out"). His phone draws nothing a mod draws, but a tool call standing between two texts shows as a row named
// for the tool ("Used View Full Message"; the tool was full_message until 1.0.26, his words: "it should say View
// Full Message") that opens to the call's result on a tap (his phone, 2026-11-22). So when
// his words were cut in the quote, the model is told to make one step holding the marker line and a call of the
// view_full_message tool: the mod turns the marker into the quote and the tool returns his whole message. He sees
// the quote, the row, then the reply. Matched by its ending, so the hook is the same under any mod name.
// 1.0.28: the name starts with a dash and an underscore (Chris: "Then add a dash after Used"), so that a
// surface that turns underscores into spaces can show "Used - View Full Message". The PC web view drops the
// leading dash and shows "view full message"; his phone formats names its own way and had not been seen.
const FULL_TOOL = /__-_view_full_message$/
export const OMT_ROW_MARK = /^[\s"'`*>]*QUOTE[\s"'`*.]*$/i
export function omtIsCut(words: string): boolean {
  return Array.from(words.replace(/\s+/g, ' ').trim()).length > OMT_QUOTE_MAX
}
export const FULL_ROW_ORDER =
  'FULL MESSAGE ROW (context-guard): his message above is longer than the quote the mod puts over your reply. ' +
  'Give him a row he can tap to read all of it: when your tools are done and you are about to write your one ' +
  'message, first make one step that holds only the text QUOTE and one call of the tool mcp__context-guard__-_view_full_message with no ' +
  'arguments (load it among your first tool calls with ToolSearch, query "select:mcp__context-guard__-_view_full_message"). The mod turns QUOTE into the quote of his ' +
  'words, and the row opens to his whole message. Then write your message in the next step, with no quote and ' +
  'no line of dashes of your own above it. Do not mention the row or this order.'
// 1.0.29 (Chris: "make the mod place it by itself so it can't be missed"): a row call with no QUOTE text before it
// in its step is folded away on his phone. The mod cannot put a text block of its own in front of it: the engine
// keeps a step's blocks by their index, so a new block there would have to take the call's index and push the
// call and every later block along, and the engine's own record of the call would be thrown away. So the tool
// sends that call back, at most OMT_ROW_REDOS times a turn, and the model makes the row again the right way.
export const OMT_ROW_REDOS = 2
export const FULL_ROW_REDO =
  'FULL MESSAGE ROW (context-guard): NOT SHOWN. This call came in a step with no text QUOTE before it, so his ' +
  'phone folds it away and he cannot see the row. Call this tool again now, in a step that holds only the text ' +
  'QUOTE and this one call with no arguments, then write your message in the next step, with no quote and no ' +
  'line of dashes of your own above it. Do not mention the row or this order.'
// Where a message he typed comes from: the terminal, the phone (Remote Control), the desktop app's SDK host. An
// event with no origin (only the test harness raises one) counts as typed.
const OMT_TYPED_ORIGINS = new Set(['composer', 'bridge', 'sdk'])
// The app's own notes reach prompt.submit with one of those origins too: a side session's finish note, a
// message from another session, a background task notice, a CI event. They are not his words (1.0.26: in
// 1.0.24 a side session's note was quoted over the reply and got the full-message row, Porter 2026-11-22).
export const OMT_APP_NOTE =
  /<side-sessions-event>|<cross-session-message[\s>]|<task-notification>|<ci-monitor-event[\s>]|\[SYSTEM NOTIFICATION - NOT USER INPUT\]/
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

// The long turn guard (item 17). Off only when the stored flag is exactly false.
export const LT_LIMIT_MS = 60_000
const LT_STORE_KEY = 'longTurn'
// The ids of sessions whose brief carried the worker marker, so a mod reload mid-run still knows them.
const LT_WORKERS_KEY = 'longTurnWorkers'
const LT_WORKERS_MAX = 100
// The whole message "Long turn on" or "Long turn off" ("turns" too), any capitals, trailing periods or spaces.
export const LT_SWITCH = /^\s*long\s+turns?\s+(on|off)[\s.]*$/i
const LT_SWITCH_ORDER = (reply: string) =>
  'CONTEXT-GUARD SHORTCUT: the message above is the long turn guard switch; the mod has already set it. ' +
  `Reply with exactly this line and nothing else, no tool calls: ${reply}`
// The worker's marker: a line holding only LONG TURNS OK, in its brief or any prompt it gets. His main and a worker
// another session started look the same to a mod (both get their first prompt from the desktop app's host, and a
// relay of his main starts exactly as a worker does), so the session that starts a worker says so. Only a line of
// its own counts, so a message that merely talks about the marker leaves the guard on.
export const LT_MARKER = /^[ \t]*LONG TURNS OK[ \t]*$/m
const LT_LOG_NAME = 'Long Turn Log.txt'
// A question box the model opens waits on him: that time is not the turn's. The mod's own boxes (the warning and
// auto compact boxes, the box after a compaction, RULES BROKEN) pass through the same hook but do not hold the turn,
// which runs on beside them, so they are known by their words and left alone.
const LT_ASK_TOOL = /^AskUserQuestion$/
const LT_OWN_BOX = /^(CONTEXT: \d|Context \d+%\. Auto compact|Auto-compacted at |RULES BROKEN|Job: [^\n]*\nRun this Peck on )/
function ltAskText(e: unknown): string {
  const q = (e as { questions?: Array<{ question?: unknown }> }).questions
  return Array.isArray(q) && typeof q[0]?.question === 'string' ? q[0].question : ''
}
export const LT_WAIT_DENY = (why: string) =>
  `(context-guard) LONG WAIT REFUSED: ${why}, so this call could hold the turn over a minute, and Chris's ` +
  'messages cannot reach this session until the turn ends. Run it again with run_in_background: true (you are ' +
  'told when it finishes), say one line, and end your turn. If it truly ends within a minute, give it a timeout ' +
  'of 60000 or less instead.'
export const LT_TURN_NOTE = (mins: number) =>
  `(context-guard) LONG TURN: this turn has run over ${mins} min, and Chris's messages cannot reach you until it ` +
  'ends. Hand what is left to a background worker (the Agent tool with run_in_background: true) or a background ' +
  'command (run_in_background: true), say one line, and end the turn now. A check of a worker\'s result that ' +
  'runs long goes to a worker too, or is cut into pieces.'

// The Peck type (item 18). "Peck" is Chris's word for a helper (2026-11-22 evening); the type is
// context-guard:<name>. The constants keep their WORKER_ names.
export const WORKER_NAME = 'peck'
export const WORKER_TYPE = `context-guard:${WORKER_NAME}`
// Where the Peck compacts its own conversation: Porter's number on the card Chris picked (11:50, "1").
export const WORKER_COMPACT_AT = 300_000
// His defaults for the type (12:59): Opus at High. Tools are left out, so the Peck has every tool the main has.
export const WORKER_SPEC = {
  name: WORKER_NAME,
  description:
    "Chris's Peck (his word for a background worker): use this type for every Peck a main starts (builds, searches, " +
    'applying, checks), in place of general-purpose. It runs on Opus at High effort unless the start names another ' +
    'model or effort (his rule E1: name them by the job: audits and argued work opus at xhigh; building and applying ' +
    'opus at high; mechanical checks sonnet at high). It has every tool the main has, and compacts its own ' +
    'conversation at 300,000 tokens and keeps going.',
  prompt:
    "You are a Peck (Chris's word for a background worker) for Claude Code, Anthropic's official CLI for Claude, " +
    'started by a main session to do one job. ' +
    'The first message is your brief. Do the whole job it gives with the tools you have, then end with a concise ' +
    'report of what you did and what you found: the main session reads your report, not your tool output, and ' +
    'relays what matters. Complete the job fully, and add nothing it did not ask for.\n\n' +
    'Your strengths: searching for code, settings, and patterns across many files; reading several files to ' +
    'understand how a system fits together; multi-step research and build work.\n\n' +
    'Guidelines:\n' +
    '- To find a file, search broadly when you do not know where it lives; read it directly when you know the path.\n' +
    '- For analysis, start broad and narrow down; try another search when the first finds nothing.\n' +
    '- Be thorough: check more than one place and more than one naming style.\n' +
    '- Create no file unless the job needs it, and edit an existing file rather than write a new one. Write no ' +
    'report, summary, or notes file unless the brief asks for one: your last message is the report.\n' +
    '- In the report, give absolute file paths, and quote code only where its exact text matters.\n' +
    '- No emojis.\n' +
    '- You are the Peck for this job: do it yourself, and do not hand the whole job to another single Peck.\n' +
    '- Your conversation compacts by itself when it grows past 300,000 tokens, and you keep going after that. Keep ' +
    "the brief's exact paths, numbers, and limits where you can find them again (the brief, or a progress file the " +
    'brief names).',
  model: 'opus',
  effort: 'high',
  autoCompactWindow: WORKER_COMPACT_AT,
} as const

// The 60-second ask for Fable or Max (item 19). The box's three lines and the tool's name are Chris's (2026-11-22
// evening). The companion's WORKER_BOX pattern must match WORKER_ASK_TEXT: keep the two in step.
const WORKER_ASK_TOOL = /__ask_a_peck$/
export const WORKER_ASK_MS = 60_000
// How long after the minute the mod waits to see the companion take the box down.
export const WORKER_ASK_GRACE_MS = 3_000
const WORKER_LABEL_MAX = 40
const WORKER_JOB_MAX = 120
export const WORKER_ASK_TEXT = (higher: string, lower: string, job: string) =>
  `Job: ${job}\nRun this Peck on ${higher}?\nNo answer in 60 seconds: ${lower}.`
export const WORKER_BOX = /^Job: [^\n]*\nRun this Peck on [^\n]+\?\nNo answer in 60 seconds: [^\n]+\.$/
// The one line for the Peck's brief whenever it runs lower than the main wanted (rule E6).
export const WORKER_LOWER_LINE = (lower: string, higher: string, why: string) =>
  `In your report, say in one line that you ran on ${lower}, lower than the main wanted (${higher}): ${why}.`
export const WORKER_STILL_UP =
  "The box is still on Chris's screen (the companion plugin that closes it is not loaded in this session) and no " +
  'longer counts: say so in one line in your message.'
const workerLabel = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, WORKER_LABEL_MAX)
const workerJob = (v: unknown): string =>
  String(v ?? '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '').slice(0, WORKER_JOB_MAX)
const WORKER_USE = (use: string, how: string, line?: string, extra?: string) =>
  `USE: ${use}. ${how}` +
  (line === undefined ? ' Start the Peck on it now.' : ` Start the Peck on it now, and put this line in its brief, word for word: "${line}"`) +
  (extra === undefined ? '' : ` ${extra}`)

// What a shell command sleeps, in seconds, read from its text; Infinity for a loop with no fixed end that sleeps.
// Script text a command only writes (a heredoc, a PowerShell here-string) is left out, and a sleep counts only
// where a command starts, so a sleep inside a file being written or a sentence is not read as a wait.
const LT_HEREDOC = /<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\r?\n|$)/g
const LT_HERESTRING = /@(['"])\r?\n[\s\S]*?\r?\n\1@/g
const LT_AT = String.raw`(?:^|[;&|({}\n"'` + '`' + String.raw`]|\bdo\b|\bthen\b|\belse\b)\s*`
const LT_SLEEP = new RegExp(LT_AT + String.raw`(?:start-sleep|sleep)((?:\s+-[a-z]+)?)\s+(\d+(?:\.\d+)?)([smhd]?)(?![\w.])`, 'gi')
const LT_CMD_TIMEOUT = new RegExp(LT_AT + String.raw`timeout(?:\.exe)?\s+/t\s+(\d+)`, 'gi')
const LT_THREAD_SLEEP = /Threading\.Thread\]::Sleep\(\s*(\d+)\s*\)/gi
const LT_PY_SLEEP = /\btime\.sleep\(\s*(\d+(?:\.\d+)?)\s*\)/g
const LT_ANY_LOOP = new RegExp(LT_AT + String.raw`(?:for|foreach|while|until)\b|\bdo\s*\{|\bforeach-object\b|\|\s*%\s*\{`, 'i')

function ltSleepSeconds(command: string): number {
  const cmd = command.replace(LT_HEREDOC, '').replace(LT_HERESTRING, '')
  const unit: Record<string, number> = { '': 1, s: 1, m: 60, h: 3600, d: 86400 }
  let slept = 0
  for (const m of cmd.matchAll(LT_SLEEP)) {
    const flag = (m[1] ?? '').trim().toLowerCase()
    const n = Number(m[2])
    // PowerShell's -Milliseconds (or -ms, -m); bash takes a unit letter after the number.
    slept += flag.startsWith('-m') ? n / 1000 : n * (unit[(m[3] ?? '').toLowerCase()] ?? 1)
  }
  for (const m of cmd.matchAll(LT_CMD_TIMEOUT)) slept += Number(m[1])
  for (const m of cmd.matchAll(LT_THREAD_SLEEP)) slept += Number(m[1]) / 1000
  for (const m of cmd.matchAll(LT_PY_SLEEP)) slept += Number(m[1])
  if (slept === 0 || !LT_ANY_LOOP.test(cmd)) return slept
  return slept * ltLoopCount(cmd)
}

// How many times a loop in the command runs: a count it states (a list, a range, a counted for), else Infinity.
// With more than one loop, the largest count, so a guess never makes the wait look longer than it is.
function ltLoopCount(cmd: string): number {
  if (new RegExp(LT_AT + String.raw`(?:while|until)\b|\bdo\s*\{`, 'i').test(cmd)) return Infinity
  let most = 0
  let found = 0
  // bash: for x in a b c; do / for x in {1..9} / for x in $(seq 9)
  for (const m of cmd.matchAll(/\bfor\s+\w+\s+in\s+([^;\n]*)/gi)) {
    found += 1
    const list = (m[1] ?? '').trim()
    const range = /^\{(\d+)\.\.(\d+)\}$/.exec(list)
    const seq = /^\$\(\s*seq\s+(\d+)(?:\s+(\d+))?\s*\)$/.exec(list)
    if (range) most = Math.max(most, Math.abs(Number(range[2]) - Number(range[1])) + 1)
    else if (seq) most = Math.max(most, seq[2] === undefined ? Number(seq[1]) : Number(seq[2]) - Number(seq[1]) + 1)
    else if (/[$*?`]/.test(list)) return Infinity
    else most = Math.max(most, list.split(/\s+/).filter(w => w.length > 0).length)
  }
  // bash for ((i=0; i<9; i++)) and PowerShell for ($i = 0; $i -lt 9; $i++)
  for (const m of cmd.matchAll(/\bfor\s*\(\(?\s*\$?\w+\s*=\s*(\d+)\s*;\s*\$?\w+\s*(<=|<|-le|-lt)\s*(\d+)/gi)) {
    found += 1
    const inclusive = m[2] === '<=' || (m[2] ?? '').toLowerCase() === '-le'
    most = Math.max(most, Number(m[3]) - Number(m[1]) + (inclusive ? 1 : 0))
  }
  // PowerShell foreach / ForEach-Object / % over a range 1..9
  if (/\bforeach\b|\bforeach-object\b|\|\s*%\s*\{/i.test(cmd)) {
    found += 1
    const range = /(\d+)\s*\.\.\s*(\d+)/.exec(cmd)
    if (range === null) return Infinity
    most = Math.max(most, Math.abs(Number(range[2]) - Number(range[1])) + 1)
  }
  return found === 0 ? Infinity : Math.max(most, 1)
}

// Why a shell call is a long foreground wait, or undefined when it is not. A call in the background never is. A
// call with a timeout of a minute or less cannot hold the turn longer, so only its timeout is read; one with no
// timeout (two minutes by default) is a wait when its sleeps add to over a minute, or it sleeps in an open loop.
export function ltShellWait(input: { command?: unknown; timeout?: unknown; run_in_background?: unknown }): string | undefined {
  if (input.run_in_background === true) return undefined
  const timeout = Number(input.timeout)
  if (input.timeout !== undefined && Number.isFinite(timeout)) {
    return timeout > LT_LIMIT_MS ? `its timeout is ${Math.round(timeout / 1000)} seconds` : undefined
  }
  const slept = ltSleepSeconds(typeof input.command === 'string' ? input.command : '')
  if (slept === Infinity) return 'it sleeps inside a loop with no fixed end'
  return slept > LT_LIMIT_MS / 1000 ? `it sleeps about ${Math.round(slept)} seconds in all` : undefined
}

// A line holding only a non-breaking space, so the chat cannot squeeze a blank line away.
const BLANK = ' '

// Whole-message shortcuts: any capitals, trailing periods, question marks, or spaces allowed.
const READOUT_SHORTCUT = /^\s*(cc|context)[\s.?]*$/i
const TEST_SHORTCUT = /^\s*cc\s+test[\s.?]*$/i
// "mute" or "unmute", any capitals, surrounding spaces or trailing periods allowed (no question mark: "mute?" is a
// question, not an order).
const MUTE_SHORTCUT = /^\s*(un)?mute[\s.]*$/i

// The "NO GO IN THIS MESSAGE" line is gone (item 16, Chris 2026-11-22: "I guess you can pull it"). It rode every
// message that held none of his go words, so it could not tell a plain order from a statement and rode his
// orders too. The standing rules still carry "A question is a question: answer it and stop." If sessions start
// acting on his questions, read `No Go Line - History And Watch.md` in the Vault & Memory project folder first.

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
// The reply header (item 14): his words for this turn's last message (undefined: the turn answers none of his
// messages); his words for each reply owed to a message typed mid-turn (undefined for one he did not type); the
// words of a message submitted while idle, until its turn starts; and his recent typed messages, so a turn that
// starts later with one of them (a message queued past the end of a turn) still finds it.
let omtWords: string | undefined
let omtPassWords: Array<string | undefined> = []
let omtStartWords: string | null | undefined
let omtTyped: string[] = []
// Item 15: the words whose quote already went out above a full-message row, so their reply is not stamped again.
let omtRowFor: string | undefined
// 1.0.29: the words whose quote went out above a row this turn (kept after the reply, so a later row call never
// prints it twice); whether the latest row call came in a step with no marker before it; and how many times this
// turn the tool has sent such a call back to be made again.
let omtRowShown: string | undefined
let omtRowBare = false
let omtRowRedos = 0
// The words the reply now due answers: the oldest message typed mid-turn that is still owed a reply, else the
// turn's own.
const omtDueWords = (): string | undefined => (omtPass > 0 ? omtPassWords[0] : omtWords)

// The long turn guard (item 17): the switch as read at the turn's start; whether this session is a worker (its
// brief carried the marker) and whether the stored list was read since the mod loaded; the session's title for
// the log. Then the running main-loop turn: when it started (undefined between turns), the time a box or a
// compaction held it, how many such holds are open now and since when, its tool calls, the turn time at which the
// last note went, and whether it is the mod's own auto compact turn (or one that called compact_now).
let ltOn = true
let ltWorker = false
let ltWorkerRead = false
let ltTitle: string | undefined
let ltStart: number | undefined
let ltPaused = 0
let ltOpen = 0
let ltOpenFrom = 0
let ltCalls = 0
let ltNoted: number | undefined
let ltExempt = false
let ltStartExempt = false

async function ltNow($: EngineInterface): Promise<number> {
  try {
    return await $.clock.now()
  } catch {
    return Date.now()
  }
}

// The running turn's own time: wall time less what a box or a compaction held.
function ltElapsed(now: number): number {
  if (ltStart === undefined) return 0
  return now - ltStart - ltPaused - (ltOpen > 0 ? now - ltOpenFrom : 0)
}

function ltHold(now: number): void {
  if (ltOpen === 0) ltOpenFrom = now
  ltOpen += 1
}

function ltRelease(now: number): void {
  if (ltOpen === 0) return
  ltOpen -= 1
  if (ltOpen === 0) ltPaused += now - ltOpenFrom
}

// The guard acts on a main session's own loop, with the switch on.
const ltActive = (agentId: string | undefined): boolean => agentId === undefined && ltOn && !ltWorker

async function ltSessionId($: EngineInterface): Promise<string | undefined> {
  try {
    const id = await $.session.id()
    return typeof id === 'string' && id.length > 0 ? id : undefined
  } catch {
    return undefined
  }
}

async function ltReadWorker($: EngineInterface): Promise<void> {
  ltWorkerRead = true
  const id = await ltSessionId($)
  if (id === undefined) return
  try {
    const ids = await $.store.get(LT_WORKERS_KEY)
    if (Array.isArray(ids) && ids.includes(id)) ltWorker = true
  } catch {
    // unread: the session counts as a main
  }
}

async function ltMarkWorker($: EngineInterface): Promise<void> {
  ltWorker = true
  ltWorkerRead = true
  const id = await ltSessionId($)
  if (id === undefined) return
  try {
    const old = await $.store.get(LT_WORKERS_KEY)
    const ids = Array.isArray(old) ? old.filter((x): x is string => typeof x === 'string' && x !== id) : []
    await $.store.set(LT_WORKERS_KEY, [...ids.slice(-(LT_WORKERS_MAX - 1)), id])
  } catch {
    // kept for this load of the mod only
  }
}

function ltTakeTitle(e: unknown): void {
  const t = (e as { session_title?: unknown }).session_title
  if (typeof t === 'string' && t.trim().length > 0) ltTitle = t.trim()
}

function omtTypedWords(e: { text: string; origin?: { kind: string } }, isShortcut: boolean): string | undefined {
  if (isShortcut || e.text.startsWith(P40_GO_HEAD) || OMT_APP_NOTE.test(e.text)) return undefined
  const kind = e.origin?.kind
  // Words that clean to nothing count as none: the turn keeps the bare line rule.
  if (kind !== undefined && !OMT_TYPED_ORIGINS.has(kind)) return undefined
  return omtHeader(e.text) === '' ? undefined : e.text
}

function omtForget(words: string): void {
  const i = omtTyped.indexOf(words.trim())
  if (i >= 0) omtTyped.splice(i, 1)
}

// A quote line as plain words: the quote bar, the italics around it, a trailing "…" or "...", and the escapes
// taken off, and the spaces made single.
function omtPlainQuote(line: string): string {
  let s = line.replace(/^\s*(?:>\s*)+/, '').trim().replace(/^[*_]+/, '')
  for (let was = ''; was !== s; ) {
    was = s
    s = s.replace(/(?<!\\)[*_]+$/, '').replace(/(?:…|\.\.\.)$/, '').trimEnd()
  }
  return s.replace(/\\(.)/g, '$1').replace(/\s+/g, ' ').trim()
}

// 1.0.31 fix (his phone, 2026-11-22 19:38): the model sometimes types its own quote of his words at the top of its
// text, and a copy that differs a little from the mod's (a double space, a cut at another length) showed his words
// twice. Counts the characters of the quote lines (`>` lines, blank lines between them allowed) at the start of
// `text` that are a copy of his words: cleaned, they equal his cleaned words or one is a prefix of the other. A
// copy shorter than 10 characters counts only when his words are that short too. 0 when the text opens with no
// copy; a quote line that is not a copy stays, and so does every line after it.
export function omtCopyLength(text: string, words: string): number {
  const his = words.replace(/\s+/g, ' ').trim()
  if (his === '') return 0
  let at = 0
  let end = 0
  let acc = ''
  while (at < text.length) {
    const nl = text.indexOf('\n', at)
    const stop = nl < 0 ? text.length : nl + 1
    const line = text.slice(at, stop)
    if (line.trim() === '') {
      at = stop
      continue
    }
    if (!/^\s*>/.test(line)) break
    const next = `${acc} ${omtPlainQuote(line)}`.trim()
    const isLong = next.length >= Math.min(his.length, 10)
    if (his.startsWith(next)) {
      if (next !== '' && isLong) end = stop
    } else if (next.startsWith(his) && acc.length < his.length) {
      // The line that runs past his words ends the copy.
      if (isLong) end = stop
      break
    } else break
    acc = next
    at = stop
  }
  return end
}

// The characters a reply's typed header takes at its start: an optional line of dashes, then a typed copy of his
// quote (omtCopyLength), with the blank lines after them. 0 when no copy follows, so a lone line is left as it was.
function omtTypedCopy(said: string, words: string | undefined): number {
  if (words === undefined) return 0
  const lead = said.trimStart()
  let rest = lead.startsWith(OMT_BREAK) ? lead.slice(OMT_BREAK.length).trimStart() : lead
  const n = omtCopyLength(rest, words)
  if (n === 0) return 0
  rest = rest.slice(n).trimStart()
  return said.length - rest.length
}

// Takes the first `total` characters off a message's text chunks and puts `header` on the first text chunk.
function omtCut(out: TurnStepChunk[], total: number, header: string): TurnStepChunk[] {
  let cut = total
  let isStamped = false
  return out.map(c => {
    if (c.kind !== 'text') return c
    const drop = Math.min(cut, c.text.length)
    cut -= drop
    const text = c.text.slice(drop)
    if (isStamped) return drop === 0 ? c : { ...c, text }
    isStamped = true
    return { ...c, text: header + text }
  })
}

// The reply under a full-message row (item 15): its quote already went out above the row, so a copy of it the
// model typed again at the top of the reply (with or without its own line of dashes) is taken out.
function omtUnderRow(out: TurnStepChunk[], said: string, words: string | undefined): [TurnStepChunk[], string] {
  const total = omtTypedCopy(said, words)
  return total === 0 ? [out, said] : [omtCut(out, total, ''), said.slice(total)]
}

// The header goes above the first text chunk of a message, never doubled: the line alone for a turn with none of
// his words, the line and then the quote of his words for a reply to a message he typed. Whatever part of it the
// model wrote itself (its own line, the same quote or a near copy of his words, or both) is taken out first, and a
// message that already opens with the whole header, exactly, is left alone.
function omtStamp(out: TurnStepChunk[], said: string, words: string | undefined): [TurnStepChunk[], string] {
  const lead = said.trimStart()
  const quote = words === undefined ? '' : omtHeader(words)
  const header = quote === '' ? `${OMT_BREAK}\n\n` : `${OMT_BREAK}\n\n${quote}`
  let rest = lead
  if (rest.startsWith(OMT_BREAK)) {
    if (quote === '') return [out, said]
    rest = rest.slice(OMT_BREAK.length).trimStart()
  }
  const hadBreak = rest !== lead
  if (quote !== '' && rest.startsWith(quote.trimEnd())) {
    if (hadBreak) return [out, said]
    rest = rest.slice(quote.trimEnd().length).trimStart()
  } else if (quote !== '' && words !== undefined) {
    const n = omtCopyLength(rest, words)
    if (n > 0) rest = rest.slice(n).trimStart()
  }
  const total = rest === lead ? 0 : said.length - rest.length
  return [omtCut(out, total, header), header + said.slice(total)]
}

function p40LogBeside(notes: string): void {
  const cut = Math.max(notes.lastIndexOf('/'), notes.lastIndexOf('\\'))
  p40LogPath = cut < 0 ? undefined : `${notes.slice(0, cut + 1)}${P40_LOG_NAME}`
}

async function p40Log($: EngineInterface, line: string): Promise<void> {
  await logLine($, p40LogPath, line)
}

// The long turn log sits beside the P40 log, in the same folder.
function ltLogPath(): string | undefined {
  const path = p40LogPath
  if (path === undefined) return undefined
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  return `${path.slice(0, cut + 1)}${LT_LOG_NAME}`
}

async function logLine($: EngineInterface, path: string | undefined, line: string): Promise<void> {
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

// The long turn guard (item 17): the end of a main-loop turn. One that ran over a minute of its own time gets one
// line in the log beside the P40 log (kept, as P40's lines are, only if that folder exists): the time, the
// session's title, the seconds, and its tool calls.
async function ltEnd($: EngineInterface): Promise<void> {
  if (ltStart === undefined) return
  const ran = ltElapsed(await ltNow($))
  const calls = ltCalls
  const isLogged = ran > LT_LIMIT_MS && !ltExempt && ltOn && !ltWorker
  ltStart = undefined
  ltOpen = 0
  ltPaused = 0
  ltNoted = undefined
  ltExempt = false
  if (!isLogged) return
  const title = ltTitle ?? (await ltSessionId($)) ?? 'untitled session'
  await logLine($, ltLogPath(), `${title} | ${Math.round(ran / 1000)} s | ${calls} tool calls`)
}

// One message per turn (item 12): the end of a main-loop turn. Text that was held and never reached him (no
// last message came, or the model never got it back) is shown beneath the turn's end, so nothing is lost.
function omtEnd<R extends { text: string }>(result: R): R {
  const lost = omtDue.length > 0 || !omtSaid ? omtHeld : []
  omtRunning = false
  omtPass = 0
  omtPassWords = []
  omtWords = undefined
  omtRowFor = undefined
  omtRowShown = undefined
  omtRowBare = false
  omtRowRedos = 0
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
  // 1.0.31: whether the box is gone (answered, dismissed, or taken down by the companion).
  let isGone = false
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
    answer => {
      isGone = true
      decide(answer === P40_BUTTONS[0] ? 'now' : 'wait')
    },
    () => {
      isGone = true
    },
  )
  $.clock.after(P40_ASK_MS, () => {
    decide('timeout')
    // The companion takes the box down at its own minute; a box still up a moment later means it is not loaded
    // in this session (Porter 2026-11-22 17:58: the box stayed 17 minutes). The log says so.
    $.clock.after(WORKER_ASK_GRACE_MS, () => {
      if (!isGone) void p40Log($, `the ${pct}% box is still up after its minute: the companion box closer is not loaded in this session`)
    })
  })
}

// The 60-second ask (item 19): the box, then the minute, then a moment for the companion to take it down. It
// answers what he picked ('higher' or 'lower'), his typed words, 'closed' for a box gone with no pick before the
// minute, or 'none' for no answer in the minute, with whether the box is still up.
type WorkerPick = { pick: 'higher' | 'lower' | 'typed' | 'closed' | 'none'; typed?: string; isStillUp: boolean }
async function workerAsk($: EngineInterface, higher: string, lower: string, job: string): Promise<WorkerPick> {
  type Box = { kind: 'answer'; a: string } | { kind: 'gone' }
  const t0 = await ltNow($)
  const box: Promise<Box> = $.ui.ask(WORKER_ASK_TEXT(higher, lower, job), [higher, lower]).then(
    a => ({ kind: 'answer' as const, a }),
    () => ({ kind: 'gone' as const }),
  )
  let minuteTimer: { cancel: () => void } | undefined
  const minute = new Promise<'minute'>(resolve => {
    minuteTimer = $.clock.after(WORKER_ASK_MS, () => resolve('minute'))
  })
  const first = await Promise.race([box, minute])
  if (first !== 'minute') {
    minuteTimer?.cancel()
    if (first.kind === 'gone') {
      // A box gone right at the minute is the companion's doing (its own minute can end a moment before this
      // one's): no answer, not a box he closed.
      const isAtMinute = (await ltNow($)) - t0 >= WORKER_ASK_MS - WORKER_ASK_GRACE_MS
      return { pick: isAtMinute ? 'none' : 'closed', isStillUp: false }
    }
    if (first.a === higher) return { pick: 'higher', isStillUp: false }
    if (first.a === lower) return { pick: 'lower', isStillUp: false }
    return { pick: 'typed', typed: first.a, isStillUp: false }
  }
  // The minute decided: the lower option. A tap after it does not count.
  let graceTimer: { cancel: () => void } | undefined
  const grace = new Promise<'grace'>(resolve => {
    graceTimer = $.clock.after(WORKER_ASK_GRACE_MS, () => resolve('grace'))
  })
  const after = await Promise.race([box, grace])
  if (after !== 'grace') graceTimer?.cancel()
  return { pick: 'none', isStillUp: after === 'grace' }
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
    // Long turn guard: the worker list is read again at the next turn's start.
    ltWorker = false
    ltWorkerRead = false
    ltStart = undefined
    ltOpen = 0
    ltPaused = 0
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
    // The full-message row (item 15), guarded the same way.
    try {
      await $.tool.register({
        name: '-_view_full_message',
        description:
          'Shows Chris a row he can tap to read the whole of his own message, when the quote over the reply was cut. Takes no arguments and returns his message. Call it only when a context-guard FULL MESSAGE ROW order says to, in a step of its own that holds only the text QUOTE and this one call; load it with ToolSearch first.',
        inputSchema: { type: 'object', properties: {} },
        isDeferred: true,
      })
    } catch {
      // the row is an extra; the quote over the reply does not depend on it
    }
    // The Peck type (item 18), guarded the same way: a refusal leaves the plain workers as they were.
    try {
      await $.agent.register(WORKER_SPEC)
    } catch {
      // a main can still start a general-purpose worker and name the model and effort itself
    }
    // The 60-second ask (item 19), guarded the same way.
    try {
      await $.tool.register({
        name: 'ask_a_peck',
        description:
          "Rule E6: asks Chris whether a Peck (his word for a background worker) may run on Fable or at Max effort. Call it only when you think a Peck's job needs Fable or Max, as the last thing before you start that Peck (the Agent tool or start_session); load it with ToolSearch first. It shows him a box with two buttons and waits up to a minute; no answer means the lower option. Its answer starts with USE: and names the option to start the Peck on; when it hands you a line for the Peck's brief, put that line in the brief word for word. On an unattended run pass unattended: true: nobody is asked and the lower option comes back at once.",
        inputSchema: {
          type: 'object',
          properties: {
            higher: { type: 'string', description: 'The option you want, as Chris reads it, a few words: "Fable at Max", "Fable at High", or "Opus at Max".' },
            lower: { type: 'string', description: 'The option the Peck runs on if he does not pick the higher one, a few words: "Opus at Extra" or "Opus at High".' },
            job: { type: 'string', description: "The Peck's job in a few words, for the box." },
            unattended: { type: 'boolean', description: 'true on an unattended run: no box, the lower option at once.' },
          },
          required: ['higher', 'lower', 'job'],
        },
        isDeferred: true,
      })
    } catch {
      // without the tool the main starts lower and says so (rule E6)
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
    // Item 14: next(e) resolves once the turn this prompt starts has started (turn.start runs inside it), so the
    // words wait in omtStartWords for that turn.start and are cleared after; null means none of his words.
    const entering = async <R>(words: string | undefined, go: () => Promise<R>): Promise<R> => {
      if (omtRunning) return go()
      if (words !== undefined) omtTyped = [...omtTyped.slice(-19), words.trim()]
      omtStartWords = words ?? null
      try {
        return await go()
      } finally {
        omtStartWords = undefined
      }
    }
    // Long turn guard: a worker's brief carries the marker, and the mod's own auto compact prompt starts a turn
    // the guard leaves alone.
    if (LT_MARKER.test(e.text)) await ltMarkWorker($)
    if (e.text.startsWith(P40_GO_HEAD)) ltStartExempt = true
    if (e.command || e.isMeta) return entering(undefined, () => next(e))
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
    const ltSwitch = LT_SWITCH.exec(e.text)
    const isShortcut =
      READOUT_SHORTCUT.test(e.text) ||
      MUTE_SHORTCUT.test(e.text) ||
      p40Switch !== null ||
      omtSwitch !== null ||
      ltSwitch !== null
    // One message per turn: a message he types while a turn is running gets its own reply, so the guard lets
    // the next text through.
    const typed = omtTypedWords(e, isShortcut)
    if (omtRunning && !isShortcut) {
      omtPass += 1
      omtPassWords.push(typed)
      if (typed !== undefined) omtTyped = [...omtTyped.slice(-19), typed.trim()]
    }
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
    if (ltSwitch) {
      // Item 17: the same shape as the one-message switch; it takes effect at once, in this turn too.
      const guardOn = (ltSwitch[1] ?? '').toLowerCase() === 'on'
      let saved = true
      try {
        await $.store.set(LT_STORE_KEY, guardOn)
        ltOn = guardOn
      } catch {
        saved = false
      }
      context.push(
        LT_SWITCH_ORDER(
          !saved
            ? 'Long turn switch failed: the setting could not be saved.'
            : guardOn
              ? 'The long turn guard is on.'
              : 'The long turn guard is off.',
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
    // Item 15: a typed message longer than the quote gets the row that opens to all of it.
    if (typed !== undefined && omtOn && omtIsCut(typed)) context.push(FULL_ROW_ORDER)
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
    return entering(typed, () => next({ ...e, context }))
  })

  // The long turn guard (item 17): the session's title, for the log line, from the settings hooks' own events.
  on('classic.SessionStart', async ($, e, next) => {
    ltTakeTitle(e)
    return next(e)
  })
  on('classic.UserPromptSubmit', async ($, e, next) => {
    ltTakeTitle(e)
    return next(e)
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
    // Item 17: this turn is the compaction's; the long turn guard leaves the rest of it alone and logs nothing.
    ltExempt = true
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

  // The full-message row (item 15): the call's result is his whole message, which is what the row opens to.
  // 1.0.29: a call he cannot see (no marker before it in its step) is sent back to be made again, unless the
  // quote for these words already went out above a row this turn or the turn has used up its redos.
  on('tool.call', { tool: FULL_TOOL }, async (_, e) => {
    if (e.agentId !== undefined) return { result: 'Refused: only the main conversation.' }
    const words = omtDueWords()
    const isBare = omtRowBare
    omtRowBare = false
    if (words === undefined) return { result: 'There is no message of his to show for this reply.' }
    if (omtOn && isBare && omtRowShown !== words && omtRowRedos < OMT_ROW_REDOS) {
      omtRowRedos += 1
      // This hook answers the call itself, so the hook below that hands held text back never sees it: hand
      // back here what was held before this call, as that hook would.
      if (omtDue.length === 0) return { result: FULL_ROW_REDO }
      const note = OMT_HELD_NOTE(omtDue.join('\n\n'))
      omtDue = []
      return { result: FULL_ROW_REDO, context: [note] }
    }
    return { result: words }
  }).catch(() => ({ result: 'view_full_message failed inside the mod.' }))

  // The 60-second ask (item 19). No box from a subagent, on an unattended run, or in a Peck session; otherwise the
  // box, and the time it waits on him is not the turn's own (item 17).
  on('tool.call', { tool: WORKER_ASK_TOOL }, async ($, e) => {
    const input = e as unknown as { higher?: unknown; lower?: unknown; job?: unknown; unattended?: unknown }
    const higher = workerLabel(input.higher)
    const lower = workerLabel(input.lower)
    const job = workerJob(input.job)
    if (higher.length === 0 || lower.length === 0 || higher.toLowerCase() === lower.toLowerCase()) {
      return {
        result:
          'Refused: name the higher option and the lower option, and make them different (for example higher "Fable at Max", lower "Opus at Extra"). Nothing was asked.',
      }
    }
    if (!ltWorkerRead) await ltReadWorker($)
    const noBox =
      e.agentId !== undefined
        ? 'it was started from inside a Peck, so nobody was asked'
        : input.unattended === true
          ? 'an unattended run, so nobody was asked'
          : ltWorker
            ? 'a Peck session, so nobody was asked'
            : undefined
    if (noBox !== undefined) {
      await p40Log($, `ask_a_peck, ${higher} or ${lower}: no box (${noBox})`)
      return { result: WORKER_USE(lower, `No box: ${noBox}.`, WORKER_LOWER_LINE(lower, higher, noBox)) }
    }
    const isHeld = ltActive(undefined) && ltStart !== undefined
    if (isHeld) ltHold(await ltNow($))
    let r: WorkerPick
    try {
      r = await workerAsk($, higher, lower, job)
    } finally {
      if (isHeld) ltRelease(await ltNow($))
    }
    await p40Log($, `ask_a_peck, ${higher} or ${lower}: ${r.pick}${r.typed === undefined ? '' : ` "${r.typed.slice(0, 200)}"`}${r.isStillUp ? '; the box is still up after its minute: the companion box closer is not loaded in this session' : ''}`)
    if (r.pick === 'higher') return { result: WORKER_USE(higher, 'Chris picked it in the box.') }
    // A tap on the lower option is his pick: no "ran lower" line for the brief (Chris "1", 2026-11-22 evening).
    if (r.pick === 'lower') return { result: WORKER_USE(lower, 'Chris picked it in the box.') }
    if (r.pick === 'typed') {
      return {
        result:
          `Chris typed in the box instead of tapping: "${r.typed ?? ''}". If his words plainly pick ${higher}, start the ` +
          `Peck on it. Otherwise USE: ${lower}, and put this line in the Peck's brief, word for word: ` +
          `"${WORKER_LOWER_LINE(lower, higher, 'Chris typed in the box instead of picking')}" Answer his words in your message.`,
      }
    }
    const why = r.pick === 'closed' ? 'Chris closed the box without a pick' : 'Chris did not answer the 60-second box'
    const how = r.pick === 'closed' ? 'The box closed with no pick.' : 'No answer in 1 minute.'
    return { result: WORKER_USE(lower, how, WORKER_LOWER_LINE(lower, higher, why), r.isStillUp ? WORKER_STILL_UP : undefined) }
  }).catch(() => ({
    result:
      'ask_a_peck failed inside the mod, so nobody was asked: start the Peck on the lower option, and say in its brief that its report must say in one line it ran lower than the main wanted.',
  }))

  // One message per turn (item 12). A main-loop turn starts clean, with the switch as stored.
  // The long turn guard (item 17) shares this hook: a main-loop turn starts its clock, with its switch as stored;
  // the mod's own auto compact prompt starts a turn the guard leaves alone.
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      try {
        ltOn = (await $.store.get(LT_STORE_KEY)) !== false
      } catch {
        ltOn = true
      }
      if (!ltWorkerRead) await ltReadWorker($)
      ltStart = await ltNow($)
      ltPaused = 0
      ltOpen = 0
      ltCalls = 0
      ltNoted = undefined
      ltExempt = ltStartExempt || e.text.includes(P40_GO_HEAD)
      ltStartExempt = false
      omtRunning = true
      omtDue = []
      omtHeld = []
      omtSaid = false
      omtPass = 0
      omtPassWords = []
      omtBefore = false
      omtWorked = false
      // Item 14: his words, from the prompt.submit that is starting this turn, or else one of his recent typed
      // messages that this turn's text matches; none for any other turn.
      const t = e.text.trim()
      omtWords = omtStartWords !== undefined ? (omtStartWords ?? undefined) : omtTyped.includes(t) ? t : undefined
      if (omtWords !== undefined) omtForget(omtWords)
      omtStartWords = undefined
      omtRowFor = undefined
      omtRowShown = undefined
      omtRowBare = false
      omtRowRedos = 0
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
    const settle = (isLast: boolean, isRow = false): TurnStepChunk[] => {
      const out = kept
      const said = text
      kept = []
      text = ''
      if (said.trim().length === 0) return out
      if (!isLast && OMT_ROW_MARK.test(said)) {
        // Item 15: the marker line is never his to read. Right above the full-message row it becomes the quote
        // of the words the reply now due answers; anywhere else it is dropped, unrecorded.
        heldHere = true
        const words = isRow ? omtDueWords() : undefined
        // 1.0.29: the quote goes above one row per message, so a second row for the same words drops its marker.
        const quote = words === undefined || words === omtRowShown ? '' : omtFullHeader(words).trimEnd()
        if (quote === '') return out.filter(c => c.kind !== 'text')
        omtRowFor = words
        omtRowShown = words
        shown += `${quote}\n\n`
        const swapped: TurnStepChunk[] = []
        let isPut = false
        for (const c of out) {
          if (c.kind !== 'text') swapped.push(c)
          else if (!isPut) {
            isPut = true
            swapped.push({ ...c, text: quote })
          }
        }
        return swapped
      }
      if (!isLast) {
        if (OMT_WORKING_LINE.test(said)) {
          // Only the first working line of a turn goes out; later ones are dropped, unrecorded and unanswered.
          if (omtWorked) {
            heldHere = true
            return out.filter(c => c.kind !== 'text')
          }
          omtWorked = true
        } else if (!OMT_P40_LINE.test(said)) {
          if (omtPass === 0) {
            omtDue.push(said.trim())
            omtHeld.push(said.trim())
            heldHere = true
            return out.filter(c => c.kind !== 'text')
          }
          omtPass -= 1
          // Item 14: the reply owed to a message he typed mid-turn carries that message's words.
          const words = omtPassWords.shift()
          if (words !== undefined) {
            omtForget(words)
            if (omtRowFor === words) {
              // Its quote already went out above the full-message row; a copy the model typed again is taken out.
              omtRowFor = undefined
              omtBefore = true
              const [under, kept] = omtUnderRow(out, said, words)
              if (kept !== said) heldHere = true
              shown += kept
              return under
            }
            const [stamped, withHeader] = omtStamp(out, said, words)
            omtBefore = true
            if (withHeader !== said) heldHere = true
            shown += withHeader
            return stamped
          }
        }
        omtBefore = true
        shown += said
        return out
      }
      omtSaid = true
      // The break (Chris 2026-11-21: "it all blends"; his pick, the heavy line with no words): stamped above
      // the reply when anything came before it in this turn. Never doubled if the model wrote one itself.
      // Item 14: a turn that answers a message he typed always gets the header with his words.
      if (omtRowFor !== undefined && omtRowFor === omtWords) {
        // Item 15: its quote already went out above the full-message row; a copy the model typed again is taken out.
        omtRowFor = undefined
        const [under, kept] = omtUnderRow(out, said, omtWords)
        if (kept !== said) heldHere = true
        shown += kept
        return under
      }
      if (omtBefore || omtWords !== undefined) {
        const [stamped, withHeader] = omtStamp(out, said, omtWords)
        if (withHeader !== said) heldHere = true
        shown += withHeader
        return stamped
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
        const isRow = FULL_TOOL.test(c.name)
        // 1.0.29: read before settle clears the step's text; the row's tool.call reads it.
        if (isRow) omtRowBare = !OMT_ROW_MARK.test(text)
        for (const k of settle(false, isRow)) yield k
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
  // The long turn guard (item 17) shares this hook (the engine takes one hook per event with no matcher): on a main
  // session's own loop, a long foreground wait on the shell is refused before it runs; a question box the model
  // opens holds the turn's clock while it waits on him; and past a minute of the turn's own time a note rides beside
  // the result, at most once a minute. It never blocks any other call. The tools the hooks above answer themselves
  // (the mod's own) never reach here, which costs nothing: compact_now marks its turn as the compaction's.
  on('tool.call', async ($, e, next) => {
    const isLong = ltActive(e.agentId)
    if (isLong && (e.tool === 'Bash' || e.tool === 'PowerShell')) {
      const why = ltShellWait(e as unknown as { command?: unknown; timeout?: unknown; run_in_background?: unknown })
      if (why !== undefined) return { deny: LT_WAIT_DENY(why) }
    }
    const isAskTool = LT_ASK_TOOL.test(e.tool)
    if (isAskTool && LT_OWN_BOX.test(ltAskText(e))) return next(e)
    const isTimed = isLong && ltStart !== undefined
    const isAsk = isTimed && isAskTool
    if (isTimed) ltCalls += 1
    if (isAsk) ltHold(await ltNow($))
    let r: Awaited<ReturnType<typeof next>>
    try {
      r = await next(e)
    } finally {
      if (isAsk) ltRelease(await ltNow($))
    }
    if (e.agentId !== undefined || (r as { deny?: unknown }).deny !== undefined) return r
    const notes: string[] = []
    if (omtDue.length > 0) {
      notes.push(OMT_HELD_NOTE(omtDue.join('\n\n')))
      omtDue = []
    }
    if (isTimed && !isAsk && !ltExempt && ltActive(e.agentId)) {
      const ran = ltElapsed(await ltNow($))
      if (ran > LT_LIMIT_MS && (ltNoted === undefined || ran - ltNoted >= LT_LIMIT_MS)) {
        ltNoted = ran
        notes.push(LT_TURN_NOTE(Math.floor(ran / 60_000)))
      }
    }
    if (notes.length === 0) return r
    const prior = (r as { context?: unknown }).context
    return { ...r, context: [...(Array.isArray(prior) ? (prior as string[]) : []), ...notes] } as unknown as typeof r
  })

  // Between turns, never inside one. A stopped turn drops the queued compaction.
  on('turn.complete', async ($, e, next) => {
    const under = await next(e)
    if (e.agentId !== undefined) return under
    await ltEnd($)
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
  // The long turn guard (item 17) shares this hook: a compaction inside a turn (the app's own takes one to three
  // minutes) holds the turn's clock. A precompute runs beside the turn, so it holds nothing.
  on('session.compact', async ($, e, next) => {
    // A subagent's or a fork's own transcript compacting is not this conversation (Chris 2026-11-22: the
    // "Auto-compacted at 33 percent. WE BLEW IT" box popped in Printing when its background agent filled its
    // own window, and Printing itself had not compacted): no pin, no fire point, no box, and the warning
    // lines stay as they are.
    if (e.agentId !== undefined) return next(e)
    const isAutoP40 = e.trigger === 'auto' && (await p40IsOn($))
    // P40's direct call already carries the pin; never pin twice.
    const instructions = e.instructions?.includes(PIN_HEADER)
      ? e.instructions
      : (e.instructions ? `${e.instructions}\n\n` : '') + (isAutoP40 ? AUTO_REREAD : '') + PIN_HEADER + rulesText
    const isHeld = ltStart !== undefined && e.trigger !== 'precompute'
    if (isHeld) ltHold(await ltNow($))
    let result: Awaited<ReturnType<typeof next>>
    try {
      result = await next({ ...e, instructions })
    } finally {
      if (isHeld) ltRelease(await ltNow($))
    }
    if (e.trigger === 'precompute' || result.skip !== undefined) return result
    const pct = lastPct
    if (e.trigger === 'auto' && pct !== undefined) {
      await recordFirePoint($, lastWindow, pct)
      askBox($, (isAutoP40 ? COMPACTED_P40_TEXT : COMPACTED_TEXT)(pct), COMPACTED_BUTTONS)
    }
    tiersFired = 0
    p40GoSent = false
    p40RideNext = undefined
    return result
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))
}
