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

function harness(on: Parameters<Parameters<typeof test>[1]>[1], opts: { stored?: Record<string, number>; fetchOk?: boolean; usagePct?: number; onCompact?: (instructions: string | undefined) => void } = {}) {
  const asked: string[] = []
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
  on('tool.register', () => ({ value: { tool: 'mcp__context-guard__context_fill' } }))
  on('session.usage', () => usage(opts.usagePct ?? 10))
  // $.ui.ask is a tool.call of AskUserQuestion under the hood; answer it as the engine would.
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = (e as { questions?: Array<{ question: string }> }).questions?.[0]?.question ?? ''
    asked.push(q)
    return { result: { questions: [], answers: { [q]: 'OK, wrapping up' } } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => e)
  on('session.compact', (_, e) => {
    opts.onCompact?.(e.instructions)
    return { messages: e.messages }
  })
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))
  return { asked, store }
}

test('three tiers fire once each at 68 / 75 / 80 on the placeholder fire point, in order', async ($, on) => {
  const h = harness(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.asked.length).toBe(0)

  await $.session.measure(measure(50))
  expect(h.asked.length).toBe(0)
  await $.session.measure(measure(68))
  expect(h.asked.length).toBe(1)
  expect(h.asked[0]).toContain('WRAP UP SOON')
  await $.session.measure(measure(70))
  expect(h.asked.length).toBe(1)
  await $.session.measure(measure(75))
  expect(h.asked.length).toBe(2)
  expect(h.asked[1]).toContain('I SAID WRAP UP!')
  await $.session.measure(measure(81))
  expect(h.asked.length).toBe(3)
  expect(h.asked[2]).toContain('WRAP UP NOW!!')
  await $.session.measure(measure(82))
  expect(h.asked.length).toBe(3)
})

test('a jump past several tiers fires each of them', async ($, on) => {
  const h = harness(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(79))
  expect(h.asked.length).toBe(2)
  await $.session.measure(measure(90))
  expect(h.asked.length).toBe(3)
})

test('an auto-compaction records the fire point, scolds, pins the rules, and re-arms the tiers', async ($, on) => {
  let seen: string | undefined
  const h = harness(on, { onCompact: i => { seen = i } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(81))
  expect(h.asked.length).toBe(3)

  await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect(seen).toContain('STANDING RULES (kept through compaction)')
  expect(seen).toContain('TLDR line first')
  expect(h.asked.length).toBe(4)
  expect(h.asked[3]).toContain('Auto-compacted at 81 percent')
  expect((h.store.firePoints as Record<string, number>)['200000']).toBe(81)

  // After the compaction the fill drops and the tiers can fire again, now off the measured 81.
  await $.session.measure(measure(20))
  await $.session.measure(measure(66))
  expect(h.asked.length).toBe(5)
  expect(h.asked[4]).toContain('Context 66 percent')
})

test('a manual compaction pins the rules but records nothing and does not scold', async ($, on) => {
  const h = harness(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(70))
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect(h.asked.length).toBe(1)
  expect(h.store.firePoints).toBe(undefined)
})

test('a stored fire point moves the tiers', async ($, on) => {
  const h = harness(on, { stored: { '200000': 76 } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(60))
  expect(h.asked.length).toBe(0)
  await $.session.measure(measure(61))
  expect(h.asked.length).toBe(1)
})

test('the rules ride beside a typed prompt, from the repo when the fetch works, else baked', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
})

test('the baked rules ride when the fetch fails', async ($, on) => {
  harness(on, { fetchOk: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('TLDR line first')
})

test('the context_fill tool answers with percent, fire point and tiers', async ($, on) => {
  harness(on, { usagePct: 42 })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call({ tool: 'mcp__context-guard__context_fill' })
  expect(String(r.result)).toContain('Context: 42%')
  expect(String(r.result)).toContain('fire point: 83% (assumed')
  expect(String(r.result)).toContain('68 / 75 / 80')
})
