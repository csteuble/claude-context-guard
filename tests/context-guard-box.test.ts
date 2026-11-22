import { expect, mock, test } from 'claude-code/testing'
import { CLOSED, CLOSE_MS, P40_BOX } from '../hooks/register'

const ask = (question: string) => ({ tool: 'AskUserQuestion', questions: [{ question, options: [{ label: 'Compact now' }, { label: 'Wait' }] }] })
const BOX = 'Context 60%. Auto compact will begin in 1 minute.'

test('the box pattern matches the context guard box and nothing else', async () => {
  expect(P40_BOX.test(BOX)).toBe(true)
  expect(P40_BOX.test('Context 65%. Auto compact will begin in 1 minute.')).toBe(true)
  expect(P40_BOX.test('RULES BROKEN\nStart a new session or tell Claude to fix it.')).toBe(false)
  expect(P40_BOX.test('Which option do you want?')).toBe(false)
})

test('no tap for a minute: the call is answered by the mod, so the app takes the box down', async ($, on) => {
  const clock = mock.clock(on)
  let shown = 0
  // The box under the mod: it never answers (nobody taps).
  on('tool.call', { tool: 'AskUserQuestion' }, () => {
    shown += 1
    return new Promise(() => undefined) as never
  })
  let settled: unknown
  const call = ($.tool.call(ask(BOX) as never) as Promise<unknown>).then(
    r => {
      settled = r
    },
    err => {
      settled = { threw: String(err) }
    },
  )
  await clock.advance(CLOSE_MS - 1_000)
  expect(shown).toBe(1)
  expect(settled).toBe(undefined)
  await clock.advance(2_000)
  await call
  expect((settled as { deny?: string }).deny).toBe(CLOSED)
})

test('a tap inside the minute passes through as the app answered it', async ($, on) => {
  const clock = mock.clock(on)
  on('tool.call', { tool: 'AskUserQuestion' }, () => ({ result: { questions: [], answers: { [BOX]: 'Wait' } } }) as never)
  const r = (await $.tool.call(ask(BOX) as never)) as { result?: { answers?: Record<string, string> } }
  expect(r.result?.answers?.[BOX]).toBe('Wait')
  // The minute passing afterwards changes nothing.
  await clock.advance(CLOSE_MS + 1_000)
})

test('any other question box is left alone, however long it waits', async ($, on) => {
  const clock = mock.clock(on)
  let answer: ((r: unknown) => void) | undefined
  on('tool.call', { tool: 'AskUserQuestion' }, () => new Promise(resolve => (answer = resolve)) as never)
  let settled: unknown
  const call = ($.tool.call(ask('Which option do you want?') as never) as Promise<unknown>).then(r => {
    settled = r
  })
  await clock.advance(CLOSE_MS * 3)
  expect(settled).toBe(undefined)
  answer?.({ result: { questions: [], answers: { q: 'A' } } })
  await call
  expect((settled as { result?: unknown }).result !== undefined).toBe(true)
})
