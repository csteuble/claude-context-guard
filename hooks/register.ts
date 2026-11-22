import type { Register } from 'claude-code'

// context-guard-box: the companion of Chris's context guard mod. Its one job: take down the context guard's
// "Auto compact will begin in 1 minute" box when the minute is up (Chris 2026-11-22: "I stared at it for a couple
// of minutes and it never went away, so I told it wait").
//
// Why a second mod: the box is the context guard's own $.ui.ask, which has no cancel, and an ask runs "through
// every hook but the calling one", so the context guard's own hooks never see its own box. Tested 2026-11-22 in
// a throwaway session: a hook in the asking mod never ran and the box stayed up; a hook in a second mod took the
// box down 20 seconds after it came up, twice, with nobody tapping (the app's log: emitted, then aborted).
//
// This hook lets the box come up and waits for the tap. When the minute passes with no tap it answers the call
// itself, and the app takes the box down. The context guard's own one-minute timer starts the compaction either
// way: there, a box that closes without an answer is no answer, and the minute decides.

// The box's words, as the context guard writes them (P40_ASK_TEXT in its register.ts). Keep the two in step.
export const P40_BOX = /^Context \d+%\. Auto compact will begin in 1 minute\.$/
export const CLOSE_MS = 60_000
export const CLOSED = 'No tap in 1 minute: the box closed by itself.'

const questionOf = (e: unknown): string => {
  const qs = (e as { questions?: Array<{ question?: unknown }> }).questions
  const q = Array.isArray(qs) ? qs[0]?.question : undefined
  return typeof q === 'string' ? q.trim() : ''
}

export const register: Register = on => {
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    // Every other question box is left alone.
    if (!P40_BOX.test(questionOf(e))) return next(e)
    const box = next(e).then(
      r => ({ kind: 'box' as const, r }),
      (err: unknown) => ({ kind: 'boxerr' as const, err }),
    )
    let stop: (() => void) | undefined
    const minute = new Promise<{ kind: 'minute' }>(resolve => {
      const timer = $.clock.after(CLOSE_MS, () => resolve({ kind: 'minute' }))
      stop = () => timer.cancel()
    })
    const won = await Promise.race([box, minute])
    if (won.kind === 'minute') return { deny: CLOSED }
    stop?.()
    if (won.kind === 'boxerr') throw won.err
    return won.r
  })
}
