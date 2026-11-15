import { expect, test } from 'claude-code/testing'

const usage = (percent: number | undefined, window = 200_000) => ({
  value: {
    startedAt: 0,
    context: { window, tokens: percent === undefined ? undefined : Math.round((percent / 100) * window), percent },
    rateLimits: [],
  },
})

const measure = (percent: number, window = 200_000) => ({
  context: { window, tokens: Math.round((percent / 100) * window), percent },
  rateLimits: [],
  changed: ['context' as const],
})

const NBSP = ' '
const READOUT_8 = `${NBSP}\n\n${NBSP}\n\n**CONTEXT: 8%** (16000 of 200000 tokens)\n\n${NBSP}\n\n${NBSP}`
const READOUT_8_BROKEN =
  `${NBSP}\n\n${NBSP}\n\n**CONTEXT: 8%** (16000 of 200000 tokens)\n\n${NBSP}\n\n` +
  `*RULES BROKEN*\\\n*Start a new session or tell Claude to fix it.*\n\n${NBSP}\n\n${NBSP}`

function harness(on: Parameters<Parameters<typeof test>[1]>[1], opts: { stored?: Record<string, number>; fetchOk?: boolean; usagePct?: number; onCompact?: (instructions: string | undefined) => void; registerThrows?: boolean } = {}) {
  const asked: string[] = []
  const buttons: string[][] = []
  const registered: Array<Record<string, unknown>> = []
  const entered: Array<{ text: string; context?: readonly string[] }> = []
  const store: Record<string, unknown> = opts.stored ? { firePoints: opts.stored } : {}
  on('http.fetch', () => ({
    value: opts.fetchOk
      ? { status: 200, ok: true, headers: {}, text: 'STANDING RULES FROM THE REPO\n- a rule long enough to pass the length check, so that the fetched copy is used over the baked one.' }
      : { status: 404, ok: false, headers: {}, text: '' },
  }))
  on('store.get', ($, e) => ({ value: store[e.key] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('tool.register', (_, e) => {
    registered.push(e as Record<string, unknown>)
    if (opts.registerThrows) throw new Error('register refused')
    return { value: { tool: 'mcp__context-guard__context_fill' } }
  })
  on('session.usage', () => usage(opts.usagePct ?? 10))
  // $.ui.ask is a tool.call of AskUserQuestion under the hood; answer it as the engine would.
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const first = (e as { questions?: Array<{ question: string; options?: Array<{ label: string }> }> }).questions?.[0]
    const q = first?.question ?? ''
    asked.push(q)
    buttons.push((first?.options ?? []).map(o => o.label))
    return { result: { questions: [], answers: { [q]: 'Got it' } } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => e)
  on('session.compact', (_, e) => {
    opts.onCompact?.(e.instructions)
    return { messages: e.messages }
  })
  on('prompt.submit', (_, e) => {
    entered.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  return { asked, buttons, store, registered, entered }
}

test('three warnings fire once each at 60 / 65 / 70 with the actual percent, in order', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.asked.length).toBe(0)

  await $.session.measure(measure(59))
  expect(h.asked.length).toBe(0)
  await $.session.measure(measure(61))
  expect(h.asked).toEqual(['CONTEXT: 61% - Wrap up soon.'])
  await $.session.measure(measure(62))
  expect(h.asked.length).toBe(1)
  await $.session.measure(measure(65))
  expect(h.asked[1]).toBe('CONTEXT: 65% - I said wrap up!')
  await $.session.measure(measure(70))
  expect(h.asked[2]).toBe('CONTEXT: 70% - WRAP THE FUCK UP!!')
  await $.session.measure(measure(82))
  expect(h.asked.length).toBe(3)
})

test('the warning box has the Good Day buttons', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(60))
  expect(h.buttons[0]).toEqual(['Good Day to you', 'I said Good Day!'])
})

test('a jump past several warnings fires each of them', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(67))
  expect(h.asked.length).toBe(2)
  await $.session.measure(measure(90))
  expect(h.asked.length).toBe(3)
})

test('a stored fire point does not move the warnings', async ($, on) => {
  const h = harness(on, { stored: { '200000': 96 }, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(60))
  await $.session.measure(measure(65))
  await $.session.measure(measure(70))
  expect(h.asked.length).toBe(3)
})

test('an auto-compaction records the fire point, scolds as before, pins the rules, and re-arms the warnings', async ($, on) => {
  let seen: string | undefined
  const h = harness(on, { fetchOk: true, onCompact: i => { seen = i } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(81))
  expect(h.asked.length).toBe(3)

  await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect(seen).toContain('STANDING RULES (kept through compaction)')
  expect(seen).toContain('STANDING RULES FROM THE REPO')
  expect(h.asked.length).toBe(4)
  expect(h.asked[3]).toBe(
    'Auto-compacted at 81 percent. WE BLEW IT: the warnings were there and nobody wrapped up. I am dumber now. Say handoff and start a new session immediately.',
  )
  expect(h.buttons[3]).toEqual(['Sure fucked that up', 'Fuck fuck fuck fuck'])
  expect((h.store.firePoints as Record<string, number>)['200000']).toBe(81)

  await $.session.measure(measure(20))
  await $.session.measure(measure(60))
  expect(h.asked.length).toBe(5)
  expect(h.asked[4]).toBe('CONTEXT: 60% - Wrap up soon.')
})

test('a manual compaction pins the rules but records nothing and does not scold', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(62))
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect(h.asked.length).toBe(1)
  expect(h.store.firePoints).toBe(undefined)
})

test('the rules ride beside a typed prompt, from the repo when the fetch works', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
  expect(r.context?.length).toBe(1)
  expect(h.asked.length).toBe(0)
})

test('when the fetch fails: baked rules ride, and a RULES BROKEN box with Got it / Thanks pops at session start', async ($, on) => {
  const h = harness(on, { fetchOk: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.asked).toEqual(['RULES BROKEN\nStart a new session or tell Claude to fix it.'])
  expect(h.buttons[0]).toEqual(['Got it', 'Thanks'])
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('TLDR line first')
})

test('the context_fill tool answers with the readout alone', async ($, on) => {
  harness(on, { usagePct: 8, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__context-guard__context_fill' })
  expect(String(r.result)).toBe(READOUT_8)
})

test('the readout carries the RULES BROKEN lines when the rules did not load from GitHub', async ($, on) => {
  harness(on, { usagePct: 8, fetchOk: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__context-guard__context_fill' })
  expect(String(r.result)).toBe(READOUT_8_BROKEN)
})

test('"CC" and "Context" as the whole message carry the readout and the reply-with-only-this order', async ($, on) => {
  harness(on, { usagePct: 8, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['CC', 'cc.', 'Context', 'CONTEXT?', '  context.  ', 'Cc ?']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(2)
    expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
    expect(r.context?.[1]).toContain('CONTEXT-GUARD SHORTCUT')
    expect(r.context?.[1]).toContain(`BEGIN\n${READOUT_8}\nEND`)
  }
})

test('"CC" or "Context" inside a longer message means nothing special', async ($, on) => {
  harness(on, { usagePct: 8, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['CC the team on this', 'what context is this', 'Context: the 2006 engine', 'CC TEST the build']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(1)
  }
})

test('"CC TEST" pops the 60 percent box once with the current percent, and nothing reaches Claude', async ($, on) => {
  const h = harness(on, { usagePct: 8, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'cc test.' })
  expect(r.drop).toBe('CC TEST')
  expect(h.entered.length).toBe(0)
  expect(h.asked).toEqual(['CONTEXT: 8% - Wrap up soon.'])
  expect(h.buttons[0]).toEqual(['Good Day to you', 'I said Good Day!'])
  // The test does not use up the real 60 percent warning.
  await $.session.measure(measure(60))
  expect(h.asked.length).toBe(2)
  expect(h.asked[1]).toBe('CONTEXT: 60% - Wrap up soon.')
})

test('the tool registers as deferred, so it is announced when the mod attaches mid-conversation', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.registered.length).toBe(1)
  expect(h.registered[0].name).toBe('context_fill')
  expect(h.registered[0].isDeferred).toBe(true)
})

test('a refused tool registration does not stop session start: the rules still ride and the warnings still fire', async ($, on) => {
  const h = harness(on, { registerThrows: true, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
  await $.session.measure(measure(60))
  expect(h.asked.length).toBe(1)
})
