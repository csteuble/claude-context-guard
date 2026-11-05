// context-guard, built for Chris 2026-10-19, rebuilt 2026-11-04 on his rulings of that day.
//
// 1. Meter: the engine pushes the context fill on every change (session.measure). No timer.
// 2. Three warning tiers, each a question box (the one channel both his desktop and phone draw).
//    The first is fixed at 65 percent (Chris, 2026-11-05). The other two sit at the auto-compaction
//    fire point minus 8 / 3 points. The fire point is a placeholder (83) until the first real
//    auto-compaction measures it; the measurement is stored per window size and persists across sessions.
// 3. On an auto-compaction: a scolding box, and the standing rules pinned into the summary.
// 4. A tool, mcp__context-guard__context_fill, the model calls only when Chris asks where context is at.
// 5. The standing rules ride as hidden context beside every message Chris types (prompt.submit); the
//    text is fetched from the GitHub repo at session start, baked copy as fallback.
//    (prompt.compose and prompt.context are blocked for mods by the default security plugin; tested 2026-11-04.)
import type { EngineInterface, Register } from 'claude-code'

import { RULES, RULES_URL } from './rules'

const PLACEHOLDER_FIRE_PCT = 83
// Chris, 2026-11-05 14:43, option 1: fixed, so a measured fire point cannot push the first warning later.
const FIRST_TIER_PCT = 65
const LATER_TIER_OFFSETS = [8, 3] as const
const STORE_KEY = 'firePoints'

// Chris's wording, 2026-11-04 10:21 to 10:32.
const TIER_TEXT = [
  (p: number, fire: number) =>
    `Context ${p} percent. WRAP UP SOON. Compaction lands around ${fire}. Start thinking about wrap up or handoff.`,
  (p: number, fire: number) =>
    `Context ${p} percent. I SAID WRAP UP! Dude, wrap this shit up. About ${Math.max(fire - p, 1)} points left before compaction.`,
  (p: number) =>
    `Context ${p} percent. WRAP UP NOW!! Compaction fires any moment now. Why the fuck haven't you wrapped up? Say handoff or wrap up NOW.`,
] as const

const COMPACTED_TEXT = (p: number) =>
  `Auto-compacted at ${p} percent. WE BLEW IT: the warnings were there and nobody wrapped up. I am dumber now. Say handoff and start a new session immediately.`

const PIN_HEADER =
  'COMPACTION INSTRUCTIONS FROM THE context-guard PLUGIN: the summary MUST end with a section titled ' +
  '"STANDING RULES (kept through compaction)" that reproduces the text below word for word, and a section ' +
  'titled "NEXT" naming the exact next action, the card or table in front of the person, and the last thing ' +
  'they said. Keep every format rule the person stated during the conversation, verbatim.\n\n'

// Module state; a reload starts it over, which is right (fresh flags).
let rulesText = RULES
let rulesSource = 'baked'
let lastPct: number | undefined
let lastWindow: number | undefined
let tiersFired = 0

function tierThresholds(fire: number): number[] {
  return [FIRST_TIER_PCT, ...LATER_TIER_OFFSETS.map(o => fire - o)]
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

async function firePoint($: EngineInterface, window: number | undefined): Promise<number> {
  if (!window) return PLACEHOLDER_FIRE_PCT
  try {
    const stored = (await $.store.get(STORE_KEY)) as Record<string, number> | undefined
    const v = stored?.[String(window)]
    if (typeof v === 'number' && v > 0 && v <= 100) return v
  } catch {
    // no store: placeholder
  }
  return PLACEHOLDER_FIRE_PCT
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

function askBox($: EngineInterface, text: string): void {
  // The box is the one channel both his desktop and phone draw (tested 2026-11-04). It waits for a click;
  // the answer is not used, so a dismissal is fine too.
  void $.ui.ask(text, ['OK, wrapping up']).catch(() => undefined)
}

async function onFill($: EngineInterface, pct: number | undefined, window: number | undefined): Promise<void> {
  if (pct === undefined) return
  lastPct = pct
  lastWindow = window
  const fire = await firePoint($, window)
  const thresholds = tierThresholds(fire)
  // Fire every tier crossed and not yet fired, highest text last.
  while (tiersFired < thresholds.length) {
    const threshold = thresholds[tiersFired]
    const say = TIER_TEXT[tiersFired]
    if (threshold === undefined || say === undefined || pct < threshold) break
    tiersFired += 1
    askBox($, say(pct, fire))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await loadRules($)
    tiersFired = 0
    await $.tool.register({
      name: 'context_fill',
      description:
        'Answers how full the context window is right now (percent, tokens, window, the measured or assumed auto-compaction fire point). Call it only when Chris asks where context is at.',
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    })
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

  // The standing rules ride beside every message Chris types.
  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta) return next(e)
    return next({ ...e, context: [...(e.context ?? []), rulesText] })
  })

  // The model's tool for "what's my context at".
  on('tool.call', { tool: 'mcp__context-guard__context_fill' }, async $ => {
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
    const fire = await firePoint($, window)
    const measured = fire !== PLACEHOLDER_FIRE_PCT
    const text =
      `Context: ${pct ?? '?'}% (${tokens ?? '?'} of ${window ?? '?'} tokens). ` +
      `Auto-compaction fire point: ${fire}% (${measured ? 'measured' : 'assumed, not yet measured'}). ` +
      `Warning tiers: ${tierThresholds(fire).join(' / ')}. Rules source: ${rulesSource}.`
    return { result: text }
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
      askBox($, COMPACTED_TEXT(pct))
    }
    tiersFired = 0
    return result
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))
}
