import { expect, mock, test } from 'claude-code/testing'
import {
  FULL_ROW_REDO,
  OMT_QUOTE_MAX,
  WORKER_BOX,
  WORKER_COMPACT_AT,
  WORKER_STILL_UP,
  WORKER_TYPE,
  ltShellWait,
  omtCopyLength,
  omtFullHeader,
  omtHeader,
  omtRowMarks,
} from '../hooks/register'

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

function harness(on: Parameters<Parameters<typeof test>[1]>[1], opts: { stored?: Record<string, number>; fetchOk?: boolean; usagePct?: number; onCompact?: (instructions: string | undefined) => void; registerThrows?: boolean; mute?: 'ok' | 'fail' | 'refused'; noUsage?: boolean; onDisk?: string[]; p40On?: boolean; answer?: string; askWait?: () => Promise<void>; compactWait?: () => Promise<void>; agentThrows?: boolean } = {}) {
  const asked: string[] = []
  const buttons: string[][] = []
  const registered: Array<Record<string, unknown>> = []
  // Item 18: the agent types the mod registers.
  const agents: Array<Record<string, unknown>> = []
  on('agent.register', (_, e) => {
    agents.push(e as Record<string, unknown>)
    if (opts.agentThrows) throw new Error('agent register refused')
    return { value: { agent: `context-guard:${String((e as { name?: unknown }).name)}` } }
  })
  const entered: Array<{ text: string; context?: readonly string[] }> = []
  const store: Record<string, unknown> = opts.stored ? { firePoints: opts.stored } : {}
  // P40 auto compact is on unless the stored flag is false. The older tests check the old warning boxes, so
  // the harness stores the flag off unless a test asks for P40 (p40On leaves the store empty: the real default).
  if (!opts.p40On) store.p40Auto = false
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
  on('session.usage', () => usage(opts.noUsage ? undefined : (opts.usagePct ?? 10)))
  const ran: string[][] = []
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    if (opts.mute === 'refused') throw new Error('process refused')
    const state = e.argv[e.argv.length - 1]?.trim().endsWith(' on') ? 'on' : 'off'
    const stdout = opts.mute === 'fail' ? 'FAILED: no default playback device' : state === 'on' ? 'Muted.' : 'Unmuted.'
    return { value: { exitCode: opts.mute === 'fail' ? 1 : 0, stdout: stdout + '\r\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  // $.ui.ask is a tool.call of AskUserQuestion under the hood; answer it as the engine would.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e) => {
    // Item 17's tests: the box waits on him this long before he answers.
    if (opts.askWait) await opts.askWait()
    const first = (e as { questions?: Array<{ question: string; options?: Array<{ label: string }> }> }).questions?.[0]
    const q = first?.question ?? ''
    asked.push(q)
    buttons.push((first?.options ?? []).map(o => o.label))
    if (opts.answer === 'DISMISS') throw new Error('dismissed')
    return { result: { questions: [], answers: { [q]: opts.answer ?? 'Got it' } } }
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => e)
  // P40: the mod's own direct call carries no messages; it is refused, as a session the desktop app hosts refuses
  // it, and the mod then queues a real /compact. (The harness cannot hand the mod the engine's own "a turn is
  // running" refusal, so the waiting-message path is proven in a live session, not here: P40 Docs, 2026-11-21.)
  on('session.compact', async (_, e) => {
    if (e.trigger === 'plugin' || !Array.isArray(e.messages)) {
      throw new Error('$.session.compact: not available in a headless (-p / SDK) session yet')
    }
    // Item 17's tests: the compaction takes this long.
    if (opts.compactWait) await opts.compactWait()
    opts.onCompact?.(e.instructions)
    return { messages: e.messages }
  })
  // P40: files in memory, the queued /compact, and the end of a turn.
  const files: Record<string, string> = {}
  for (const p of opts.onDisk ?? []) files[p] = 'notes'
  const commands: Array<{ command: string; args?: string }> = []
  // The engine hands paths over with backslashes on Windows; the tests name them with forward slashes.
  const key = (p: string) => p.split('\\').join('/')
  on('fs.exists', (_, e) => ({ value: key(e.path) in files }))
  on('fs.read', (_, e) => ({ value: files[key(e.path)] ?? '' }))
  on('fs.write', (_, e) => {
    files[key(e.path)] = e.text
    return { value: undefined }
  })
  on('command.run', (_, e) => {
    const c = e as unknown as { command: string; args?: string }
    commands.push({ command: c.command, args: c.args })
    return {}
  })
  on('turn.complete', (_, e) => ({ text: e.answer }))
  on('prompt.submit', (_, e) => {
    entered.push({ text: e.text, context: e.context })
    return { text: e.text, context: e.context }
  })
  return { asked, buttons, store, registered, entered, ran, files, commands, agents }
}

// P40 (item 10): what the tests hand compact_now, and the end of a main-loop turn.
const NOTES = 'C:/Project/_Claude/P40 Compact Notes/Test Session.md'
const P40_LOG_FILE = 'C:/Project/_Claude/P40 Compact Notes/P40 Compact Log.txt'
const compactNow = (notes: string) =>
  ({ tool: 'mcp__context-guard__compact_now', notes, in_progress: 'Task T, stopped on step 3.', next: 'Do step 4.' }) as never
const turnEnd = (isAborted = false) =>
  ({ answer: 'ok', durationMs: 5, isAborted, turnId: 't1', reason: isAborted ? 'aborted' : 'answer' }) as never

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

test('with P40 on, an auto-compaction says to stay (no handoff), keeps the two buttons, and orders the re-read of Global Memory', async ($, on) => {
  let seen: string | undefined
  const h = harness(on, { fetchOk: true, p40On: true, usagePct: 81, onCompact: i => { seen = i } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(81))
  const before = h.asked.length
  await $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect(h.asked.length).toBe(before + 1)
  expect(h.asked[before]).toBe('Auto-compacted at 81 percent before P40 could. Stay in this session. Nothing to do.')
  expect(h.buttons[before]).toEqual(['Sure fucked that up', 'Fuck fuck fuck fuck'])
  expect(seen).toContain('FIRST: Before the first reply after this compaction, read ALL of Global Memory')
  expect(seen).toContain('STANDING RULES (kept through compaction)')
  expect((h.store.firePoints as Record<string, number>)['200000']).toBe(81)
  // A compaction that is not the app's own (a typed /compact) gets neither the box nor the re-read order.
  let typed: string | undefined
  h.asked.length = 0
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }], instructions: 'x' } as never).catch(() => undefined)
  typed = seen
  expect(h.asked.some(q => q.startsWith('Auto-compacted'))).toBe(false)
  void typed
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
  // P40 is off in this harness: the old words, and no re-read order.
  expect(String(seen).includes('FIRST: Before the first reply')).toBe(false)
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

test('a subagent compacting by itself pops no box, stores no fire point, adds no pin, and leaves the lines alone', async ($, on) => {
  let told: string | undefined = 'unset'
  const h = harness(on, { fetchOk: true, onCompact: i => { told = i } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(62))
  expect(h.asked.length).toBe(1)
  await $.session.compact({ trigger: 'auto', agentId: 'agent-1', messages: [{ role: 'user', text: 'hi', toolUses: [] }] } as never)
  expect(h.asked.length).toBe(1)
  expect(h.store.firePoints).toBe(undefined)
  expect(told).toBe(undefined)
  // The 60 percent line did not arm again.
  await $.session.measure(measure(63))
  expect(h.asked.length).toBe(1)
})

test('the rules ride beside a typed prompt, from the repo when the fetch works', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
  expect(r.context?.length).toBe(2)
  expect(r.context?.[1]).toContain('CONTEXT LINE (context-guard)')
  expect(h.asked.length).toBe(0)
})

test('no message carries a no-go line: an order, a question, a statement, and a yes all get the rules and the context line only', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // Chris 2026-11-22: "I guess you can pull it". The line rode his plain orders ("make sure you put that back in").
  for (const text of ['Thoughts?', 'I want the e2 ultra', 'can you check the log', 'make sure you put that back in', 'Send plate 2', 'go', '1', 'Yeah, put them up', 'No', 'that looks fine to me']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(2)
    expect(r.context?.[1]).toContain('CONTEXT LINE (context-guard)')
    expect((r.context ?? []).some(c => c.includes('NO GO'))).toBe(false)
  }
})

test('when the fetch fails: baked rules ride, and a RULES BROKEN box with Got it / Thanks pops at session start', async ($, on) => {
  const h = harness(on, { fetchOk: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.asked).toEqual(['RULES BROKEN\nStart a new session or tell Claude to fix it.'])
  expect(h.buttons[0]).toEqual(['Got it', 'Thanks'])
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('The TLDR line first')
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
    expect((r.context ?? []).some(c => c.includes('CONTEXT-GUARD SHORTCUT'))).toBe(false)
  }
})

test('"CC TEST" pops the 60 percent box once with the current percent, and nothing reaches Claude', async ($, on) => {
  const h = harness(on, { usagePct: 8, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'cc test.' })
  expect(r.drop).toBe('​')
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
  expect(h.registered.length).toBe(5)
  // The 60-second ask (item 19, 1.0.31): the fifth tool, deferred the same way.
  expect(h.registered[4].name).toBe('ask_a_peck')
  expect(h.registered[4].isDeferred).toBe(true)
  // The full-message row (item 15): the fourth tool, deferred the same way.
  expect(h.registered[3].name).toBe('-_view_full_message')
  expect(h.registered[3].isDeferred).toBe(true)
  expect(h.registered[0].name).toBe('context_fill')
  expect(h.registered[0].isDeferred).toBe(true)
  // P40 (item 10): the second tool, deferred the same way.
  expect(h.registered[1].name).toBe('compact_now')
  expect(h.registered[1].isDeferred).toBe(true)
  // P40 auto compact (item 11): the test tool.
  expect(h.registered[2].name).toBe('p40_test')
  expect(h.registered[2].isDeferred).toBe(true)
})

test('a refused tool registration does not stop session start: the rules still ride and the warnings still fire', async ($, on) => {
  const h = harness(on, { registerThrows: true, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
  await $.session.measure(measure(60))
  expect(h.asked.length).toBe(1)
})

test('"mute" and "unmute" as the whole message set the state and hand Claude the one-word reply', async ($, on) => {
  const h = harness(on, { fetchOk: true, mute: 'ok' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const [text, word, state] of [['mute', 'Muted.', 'on'], ['  MUTE. ', 'Muted.', 'on'], ['Unmute', 'Unmuted.', 'off'], ['unmute.', 'Unmuted.', 'off']] as const) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(2)
    expect(r.context?.[0]).toContain('STANDING RULES FROM THE REPO')
    expect(r.context?.[1]).toContain('CONTEXT-GUARD SHORTCUT')
    expect(r.context?.[1]).toContain(`no tool calls: ${word}`)
    const argv = h.ran[h.ran.length - 1] ?? []
    expect(argv[0]).toBe('powershell')
    expect(argv[argv.length - 1]).toContain(`'tools\\Set Mute.ps1') ${state}`)
  }
  expect(h.ran.length).toBe(4)
})

test('"mute" inside a longer message, or as a question, means nothing special and runs nothing', async ($, on) => {
  const h = harness(on, { fetchOk: true, mute: 'ok' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['mute the PC', 'mute?', 'unmute it', 'why is it on mute']) {
    const r = await $.prompt.submit({ text })
    expect((r.context ?? []).some(c => c.includes('CONTEXT-GUARD SHORTCUT'))).toBe(false)
  }
  expect(h.ran.length).toBe(0)
})

test('a failed set makes the reply one line saying so', async ($, on) => {
  harness(on, { fetchOk: true, mute: 'fail' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'mute' })
  expect(r.context?.[1]).toContain('no tool calls: Mute failed: FAILED: no default playback device')
})

test('when the engine refuses to run the setter, Claude is handed the exact command to run instead', async ($, on) => {
  harness(on, { fetchOk: true, mute: 'refused' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.prompt.submit({ text: 'unmute' })
  expect(r.context?.[1]).toContain('could not run it itself')
  expect(r.context?.[1]).toContain("powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $p 'tools\\Set Mute.ps1') off")
})

for (const [pct, line] of [
  [10, 'Context 10% ▓░░░░░░░░░'],
  [47, 'Context 47% ▓▓▓▓░░░░░░'],
  [59, 'Context 59% ▓▓▓▓▓░░░░░'],
  [61, '⚠️ **Context 61% ▓▓▓▓▓▓░░░░ Wrap up soon.** ⚠️'],
  [66, '⚠️ **Context 66% ▓▓▓▓▓▓░░░░ I said wrap up!** ⚠️'],
  [71, '⚠️ **Context 71% ▓▓▓▓▓▓▓░░░ Fucking wrap up!** ⚠️'],
  [100, '⚠️ **Context 100% ▓▓▓▓▓▓▓▓▓▓ Fucking wrap up!** ⚠️'],
] as const) {
  test(`a typed message at ${pct} percent carries the context line order: ${line}`, async ($, on) => {
    harness(on, { usagePct: pct, fetchOk: true })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const r = await $.prompt.submit({ text: 'go' })
    const order = (r.context ?? []).find(c => c.startsWith('CONTEXT LINE (context-guard)')) ?? ''
    expect(order.endsWith(': ' + line)).toBe(true)
  })
}

test('a first message with no reading yet carries the ## context line, and the next one the real number', async ($, on) => {
  harness(on, { noUsage: true, fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const first = await $.prompt.submit({ text: 'context test' })
  const order1 = (first.context ?? []).find(c => c.startsWith('CONTEXT LINE (context-guard)')) ?? ''
  expect(order1.endsWith(': Context ##% ░░░░░░░░░░')).toBe(true)
  await $.session.measure(measure(10))
  const second = await $.prompt.submit({ text: 'second' })
  const order2 = (second.context ?? []).find(c => c.startsWith('CONTEXT LINE (context-guard)')) ?? ''
  expect(order2.endsWith(': Context 10% ▓░░░░░░░░░')).toBe(true)
})

test('the CC and mute shortcuts carry no context line order', async ($, on) => {
  harness(on, { usagePct: 61, fetchOk: true, mute: 'ok' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['CC', 'mute', 'unmute']) {
    const r = await $.prompt.submit({ text })
    expect((r.context ?? []).some(c => c.startsWith('CONTEXT LINE'))).toBe(false)
  }
})

test('with P40 on a typed message carries no context line order; "P40 off" brings it back and "P40 on" takes it away again', async ($, on) => {
  const h = harness(on, { usagePct: 47, fetchOk: true, p40On: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const hasLine = (r: { context?: readonly string[] }) => (r.context ?? []).some(c => c.startsWith('CONTEXT LINE'))
  const quiet = await $.prompt.submit({ text: 'hello there' })
  expect(hasLine(quiet)).toBe(false)
  // The rules still ride, alone.
  expect(quiet.context?.[0]).toContain('STANDING RULES FROM THE REPO')
  expect(quiet.context?.length).toBe(1)

  await $.prompt.submit({ text: 'P40 off' })
  expect(h.store.p40Auto).toBe(false)
  const loud = await $.prompt.submit({ text: 'go' })
  const order = (loud.context ?? []).find(c => c.startsWith('CONTEXT LINE (context-guard)')) ?? ''
  expect(order.endsWith(': Context 47% ▓▓▓▓░░░░░░')).toBe(true)

  await $.prompt.submit({ text: 'P40 on' })
  expect(h.store.p40Auto).toBe(true)
  expect(hasLine(await $.prompt.submit({ text: 'go' }))).toBe(false)
  // The readout shortcut still answers with the number.
  const cc = await $.prompt.submit({ text: 'CC' })
  expect((cc.context ?? []).some(c => c.includes('CONTEXT: 47%'))).toBe(true)
})

// ---------- P40 compact in place (item 10, 1.0.16) ----------

test('compact_now refuses when no notes file is on disk, and nothing is queued', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call(compactNow(NOTES))
  expect(String(r.result)).toContain('Refused: there is no notes file')
  await $.turn.complete(turnEnd())
  await clock.advance(2_000)
  expect(h.commands.length).toBe(0)
})

test('compact_now with notes on disk: when the turn ends, a real /compact is queued with the P40 text', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, onDisk: [NOTES] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const r = await $.tool.call(compactNow(NOTES))
  expect(String(r.result)).toContain('Compaction queued')
  expect(h.commands.length).toBe(0)

  await $.turn.complete(turnEnd())
  await clock.advance(2_000)
  expect(h.commands.length).toBe(1)
  expect(h.commands[0].command).toBe('compact')
  const args = h.commands[0].args ?? ''
  expect(args).toContain('P40 RESUME')
  expect(args).toContain('FIRST: Before the first reply after this compaction, read ALL of Global Memory')
  expect(args).toContain('IN PROGRESS: Task T, stopped on step 3.')
  expect(args).toContain(`NOTES: ${NOTES}`)
  expect(args).toContain('NEXT: Do step 4.')
  // The queued /compact passes the mod's own session.compact hook, which pins the rules, so the text carries no pin.
  expect(args.includes('STANDING RULES (kept through compaction)')).toBe(false)
  expect(h.files[P40_LOG_FILE]).toContain('compact_now: queued')
  expect(h.files[P40_LOG_FILE]).toContain('compact done (queued /compact)')

  // One call, one compaction: the next turn end queues nothing.
  await $.turn.complete(turnEnd())
  await clock.advance(2_000)
  expect(h.commands.length).toBe(1)
})

test('a stopped turn drops the queued compaction', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, onDisk: [NOTES] })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call(compactNow(NOTES))
  await $.turn.complete(turnEnd(true))
  await clock.advance(2_000)
  expect(h.commands.length).toBe(0)
  await $.turn.complete(turnEnd())
  await clock.advance(2_000)
  expect(h.commands.length).toBe(0)
})

test('a compaction whose instructions already carry the pin is not pinned twice', async ($, on) => {
  let seen: string | undefined
  harness(on, { fetchOk: true, onCompact: i => { seen = i } })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  const once = seen ?? ''
  expect(once.split('STANDING RULES (kept through compaction)').length - 1).toBe(1)
  await $.session.compact({ trigger: 'manual', instructions: once, messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  expect((seen ?? '').split('STANDING RULES (kept through compaction)').length - 1).toBe(1)
})

// ---------- P40 auto compact (item 11, 1.0.17) ----------

const GO = 'P40 AUTO COMPACT (context-guard)'
const sentGo = (h: { entered: Array<{ text: string }> }) => h.entered.filter(m => m.text.includes(GO))

test('P40: at 60 the box asks in his words with his two buttons; Wait holds it; 65 asks again; 70 starts with no box', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, answer: 'Wait' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(61))
  expect(h.asked).toEqual(['Context 61%. Auto compact will begin in 1 minute.'])
  expect(h.buttons[0]).toEqual(['Compact now', 'Wait'])
  await clock.advance(61_000)
  expect(sentGo(h).length).toBe(0)

  await $.session.measure(measure(66))
  expect(h.asked.length).toBe(2)
  expect(h.asked[1]).toBe('Context 66%. Auto compact will begin in 1 minute.')
  await clock.advance(61_000)
  expect(sentGo(h).length).toBe(0)

  await $.session.measure(measure(71))
  await clock.advance(1_100)
  expect(h.asked.length).toBe(2)
  expect(sentGo(h).length).toBe(1)
  expect(sentGo(h)[0].text).toContain('Context 71%. Auto compact is starting now.')
})

test('P40: "Compact now" starts it at once, and only once', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, answer: 'Compact now' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(60))
  await clock.advance(1_100)
  expect(sentGo(h).length).toBe(1)
  expect(sentGo(h)[0].text).toContain('Context 60%. Auto compact is starting now.')
  expect(sentGo(h)[0].text).toContain('compact_now')
  await clock.advance(61_000)
  await $.session.measure(measure(66))
  await $.session.measure(measure(71))
  await clock.advance(61_000)
  expect(sentGo(h).length).toBe(1)
})

test('P40: a minute with no answer starts it', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, answer: 'DISMISS' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(62))
  await clock.advance(59_000)
  expect(sentGo(h).length).toBe(0)
  await clock.advance(2_500)
  expect(sentGo(h).length).toBe(1)
  expect(sentGo(h)[0].text).toContain('Context 62%. Auto compact is starting now.')
})

test('P40: a jump past all three lines starts it once with no box', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(74))
  await clock.advance(1_100)
  expect(h.asked.length).toBe(0)
  expect(sentGo(h).length).toBe(1)
})

test('P40: a session that starts or reloads already past a line asks nothing; the next line it crosses acts', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, usagePct: 66, answer: 'Wait' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(67))
  await clock.advance(61_000)
  expect(h.asked.length).toBe(0)
  expect(sentGo(h).length).toBe(0)
  await $.session.measure(measure(70))
  await clock.advance(1_100)
  expect(sentGo(h).length).toBe(1)
})

test('P40: after a compaction the lines are armed again', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, answer: 'Compact now' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(60))
  await clock.advance(1_100)
  expect(sentGo(h).length).toBe(1)
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  await $.session.measure(measure(12))
  await $.session.measure(measure(60))
  await clock.advance(1_100)
  expect(sentGo(h).length).toBe(2)
})

test('"P40 off" stores the switch, hands Claude the one-line reply, and the old warning boxes are back; "P40 on" returns', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const off = await $.prompt.submit({ text: ' p40 OFF. ' })
  expect(h.store.p40Auto).toBe(false)
  expect((off.context ?? []).some(c => c.endsWith('P40 auto compact is off. The old warning boxes and the context line are back.'))).toBe(true)
  expect((off.context ?? []).some(c => c.includes('NO GO IN THIS MESSAGE'))).toBe(false)
  expect((off.context ?? []).some(c => c.startsWith('CONTEXT LINE'))).toBe(false)
  await $.session.measure(measure(60))
  expect(h.asked).toEqual(['CONTEXT: 60% - Wrap up soon.'])
  expect(sentGo(h).length).toBe(0)

  const back = await $.prompt.submit({ text: 'P40 on' })
  expect(h.store.p40Auto).toBe(true)
  expect((back.context ?? []).some(c => c.endsWith('P40 auto compact is on.'))).toBe(true)
  await $.session.measure(measure(65))
  await clock.settle()
  expect(h.asked[1]).toBe('Context 65%. Auto compact will begin in 1 minute.')
})

test('"P40 off" inside a longer message means nothing special', async ($, on) => {
  const h = harness(on, { fetchOk: true, p40On: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'should I type P40 off now?' })
  expect(h.store.p40Auto).toBe(undefined)
})

test('the p40_test tool runs one line step at the current fill, when the turn ends', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, usagePct: 12, answer: 'Wait' })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const one = await $.tool.call({ tool: 'mcp__context-guard__p40_test', line: 1 } as never)
  expect(String(one.result)).toContain('Line 1 step queued')
  expect(h.asked.length).toBe(0)
  await $.turn.complete(turnEnd())
  await clock.settle()
  expect(h.asked).toEqual(['Context 12%. Auto compact will begin in 1 minute.'])

  const three = await $.tool.call({ tool: 'mcp__context-guard__p40_test', line: 3 } as never)
  expect(String(three.result)).toContain('Line 3 step queued')
  await $.turn.complete(turnEnd())
  await clock.advance(1_100)
  expect(sentGo(h).length).toBe(1)
  expect(sentGo(h)[0].text).toContain('Context 12%. Auto compact is starting now.')

  const bad = await $.tool.call({ tool: 'mcp__context-guard__p40_test', line: 7 } as never)
  expect(String(bad.result)).toContain('Refused')
})

// ---------- One message per turn (item 12) ----------

type Piece = { kind: string; index?: number; text?: string; id?: string; name?: string; stopReason?: string | null; usage?: null }
const T = (text: string): Piece => ({ kind: 'text', index: 0, text })
const TOOL: Piece = { kind: 'tool', index: 1, id: 'tu1', name: 'mcp__x__y' }
const STOP = (stopReason: string): Piece => ({ kind: 'stop', stopReason, usage: null })
const HELD_NOTE = '(context-guard) ONE MESSAGE PER TURN'
const BREAK = '━━━━━━━━━━━━━━━━'

// The bottom of the chain for a turn: each call of turn.step plays the next scripted step.
function omt(on: Parameters<Parameters<typeof test>[1]>[1], steps: Piece[][]) {
  let n = 0
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.step', async function* (_, e) {
    const pieces = steps[n++] ?? []
    let answer = ''
    for (const p of pieces) {
      if (p.kind === 'text') answer += p.text
      yield p as never
    }
    const stop = pieces.find(p => p.kind === 'stop')
    return { turnId: e.turnId, index: e.index, answer, toolUses: [], stopReason: stop?.stopReason ?? null, usage: null } as never
  })
  on('tool.call', { tool: 'mcp__x__y' }, () => ({ result: 'tool ran' }) as never)
}

async function runStep($: { turn: { step: (i: never) => AsyncGenerator<unknown, unknown> & { result: Promise<unknown> } } }, index = 0, agentId?: string) {
  const out: Piece[] = []
  const s = $.turn.step({ turnId: 't1', index, model: 'm', messageCount: 1, ...(agentId ? { agentId } : {}) } as never)
  let r = await s.next()
  while (!r.done) {
    out.push(r.value as Piece)
    r = await s.next()
  }
  const result = r.value as { answer: string }
  return { out, result, text: out.filter(c => c.kind === 'text').map(c => c.text).join('') }
}

test('one message: text before a tool call is held, and handed back to the model beside the tool result', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('**TLDR:** the answer. '), T('More.'), TOOL, STOP('tool_use')], [T('Final message.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)

  const first = await runStep($ as never, 0)
  expect(first.text).toBe('')
  expect(first.out.some(c => c.kind === 'tool')).toBe(true)
  expect(first.out.some(c => c.kind === 'stop')).toBe(true)
  expect(first.result.answer).toBe('')

  const r = (await $.tool.call({ tool: 'mcp__x__y' } as never)) as { result?: unknown; context?: string }
  expect(r.result).toBe('tool ran')
  expect(String(r.context)).toContain(HELD_NOTE)
  expect(String(r.context)).toContain('HELD TEXT BEGIN\n**TLDR:** the answer. More.\nHELD TEXT END')
  const again = (await $.tool.call({ tool: 'mcp__x__y' } as never)) as { context?: string }
  expect(again.context).toBe(undefined)

  // The reply comes after a tool call, so the break is stamped above it.
  const last = await runStep($ as never, 1)
  expect(last.text).toBe(`${BREAK}\n\nFinal message.`)
  expect(last.result.answer).toBe(`${BREAK}\n\nFinal message.`)
  const end = await $.turn.complete(turnEnd())
  expect(end.text).toBe('ok')
})

test('one message: the break is stamped above the reply only when something came before it, and never twice', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('A plain reply, no tools.'), STOP('end_turn')],
    [T('Working on it, about 2 min.'), TOOL, STOP('tool_use')],
    [T('Context 12% ▓░░░░░░░░░\n\n'), T('**TLDR:** done.'), STOP('end_turn')],
    [TOOL, STOP('tool_use')],
    [T(`${BREAK}\n\nThe model wrote the break itself.`), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('A plain reply, no tools.')
  await $.turn.complete(turnEnd())

  await $.turn.start({ text: 'build', turnId: 't2' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Working on it, about 2 min.')
  expect((await runStep($ as never, 1)).text).toBe(`${BREAK}\n\nContext 12% ▓░░░░░░░░░\n\n**TLDR:** done.`)
  await $.turn.complete(turnEnd())

  await $.turn.start({ text: 'again', turnId: 't3' } as never)
  await runStep($ as never, 0)
  expect((await runStep($ as never, 1)).text).toBe(`${BREAK}\n\nThe model wrote the break itself.`)
})

test('one message: the working line and the auto compact start line go out before the tools', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('Working on the build, about 5 min.'), TOOL, STOP('tool_use')],
    [T('Context 22% ▓▓░░░░░░░░\n\nWorking on the tests, about 2 min left.'), TOOL, STOP('tool_use')],
    [T('Context 71%. Auto compact is starting now.'), TOOL, STOP('tool_use')],
    [T('Working on it.\n\n**TLDR:** and here is the answer too.'), TOOL, STOP('tool_use')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Working on the build, about 5 min.')
  // Only the first working line of a turn goes out; the second is dropped, with no note to the model.
  expect((await runStep($ as never, 1)).text).toBe('')
  expect((await runStep($ as never, 2)).text).toBe('Context 71%. Auto compact is starting now.')
  const none = (await $.tool.call({ tool: 'mcp__x__y' } as never)) as { context?: string }
  expect(none.context).toBe(undefined)
  // A working line that carries an answer with it is not the working line.
  expect((await runStep($ as never, 3)).text).toBe('')
})

test('one message: a message he types while the turn runs lets one reply through, and only one', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('About five minutes.'), TOOL, STOP('tool_use')], [T('A note to myself.'), TOOL, STOP('tool_use')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  await $.prompt.submit({ text: 'how long will that take?' })
  // Item 14: the reply it lets through carries that message's words.
  expect((await runStep($ as never, 0)).text).toBe(`${BREAK}\n\n> *how long will that take?*\n\nAbout five minutes.`)
  expect((await runStep($ as never, 1)).text).toBe('')
})

// ---------- The reply header (item 14) ----------

test('reply header: a typed-message turn gets the line and then the quote; words that clean to nothing keep the bare line rule', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[TOOL, STOP('tool_use')], [T('After a tool.'), STOP('end_turn')], [T('No tools.'), STOP('end_turn')], [TOOL, STOP('tool_use')], [T('Blank words.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'check it', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'check it', turnId: 't1' } as never)
  await runStep($ as never, 0)
  const r = await runStep($ as never, 1)
  expect(r.text).toBe(`${BREAK}\n\n> *check it*\n\nAfter a tool.`)
  // The line is there once, never doubled.
  expect(r.text.split(BREAK).length).toBe(2)
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: ' \n ', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: '', turnId: 't2' } as never)
  expect((await runStep($ as never, 2)).text).toBe('No tools.')
  await $.turn.complete(turnEnd())
  await $.prompt.submit({ text: ' \n ', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: '', turnId: 't3' } as never)
  await runStep($ as never, 3)
  expect((await runStep($ as never, 4)).text).toBe(`${BREAK}\n\nBlank words.`)
})

const HEAD = (words: string) => `> *${words}*\n\n`
// The whole header a reply carries: the line, a blank line, then the quote.
const FULL = (words: string) => `${BREAK}\n\n${HEAD(words)}`

test('reply header: omtHeader cleans, escapes, and cuts his words', async () => {
  expect(OMT_QUOTE_MAX).toBe(100)
  expect(omtHeader('Yeah, I would. Can I have a "…" at the end?')).toBe(HEAD('Yeah, I would. Can I have a "…" at the end?'))
  // Newlines and tabs become one space; markdown characters show literally.
  expect(omtHeader('  first line\n\n\tsecond *bold* _it_ `code`  ')).toBe(HEAD('first line second \\*bold\\* \\_it\\_ \\`code\\`'))
  expect(omtHeader('# heading [a](b) <x> ~y~ a|b \\')).toBe(HEAD('\\# heading \\[a\\](b) \\<x\\> \\~y\\~ a\\|b \\\\'))
  expect(omtHeader('- a list item')).toBe(HEAD('\\- a list item'))
  expect(omtHeader('> a quote')).toBe(HEAD('\\> a quote'))
  // Empty after cleaning: no header (the turn keeps the bare line rule).
  expect(omtHeader(' \n\t ')).toBe('')
  // One line, so the single quote prefix holds it all.
  expect(omtHeader('a\n> b\n\nc').split('\n').length).toBe(3)
  // Cut at 100 characters, at a word boundary in the last 20, with "…".
  const long = `${'word '.repeat(19)}abcdefghijklmnopqrstuvwxyz and more`
  expect(omtHeader(long)).toBe(HEAD(`${'word '.repeat(19).trimEnd()}…`))
  // A space right after character 100 is a boundary too.
  expect(omtHeader(`${'d'.repeat(100)} more`)).toBe(HEAD(`${'d'.repeat(100)}…`))
  // No boundary in the last 20: a hard cut at 100.
  const solid = `${'a'.repeat(70)} ${'b'.repeat(60)}`
  expect(omtHeader(solid)).toBe(HEAD(`${'a'.repeat(70)} ${'b'.repeat(29)}…`))
  // Exactly 100: nothing cut.
  expect(omtHeader('c'.repeat(100))).toBe(HEAD('c'.repeat(100)))
})

test('reply header: a quote the model wrote itself is not doubled, and the line still goes above it', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T(`${HEAD('again')}The model wrote the quote.`), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'again', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'again', turnId: 't1' } as never)
  const r = await runStep($ as never, 0)
  expect(r.text).toBe(`${FULL('again')}The model wrote the quote.`)
  expect(r.text.split('> *again*').length).toBe(2)
})

test('reply header: a plain typed turn with no tools gets the header with his words', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('A plain reply, no tools.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'is it done?', origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: 'is it done?', turnId: 't1' } as never)
  const r = await runStep($ as never, 0)
  expect(r.text).toBe(`${FULL('is it done?')}A plain reply, no tools.`)
  expect(r.result.answer).toBe(`${FULL('is it done?')}A plain reply, no tools.`)
})

test('reply header: a turn with tools before the reply gets it once, and a break the model wrote is replaced, never doubled', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('Working on it, about 2 min.'), TOOL, STOP('tool_use')],
    [T('**TLDR:** '), T('done.'), STOP('end_turn')],
    [TOOL, STOP('tool_use')],
    [T(BREAK), T('\n\nThe model wrote the break itself.'), STOP('end_turn')],
    [T(`${FULL('fix it')}The model wrote the whole header.`), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'build it', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Working on it, about 2 min.')
  const last = await runStep($ as never, 1)
  expect(last.text).toBe(`${FULL('build it')}**TLDR:** done.`)
  expect(last.out.filter(c => c.kind === 'text').length).toBe(2)
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'again', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'again', turnId: 't2' } as never)
  await runStep($ as never, 2)
  expect((await runStep($ as never, 3)).text).toBe(`${FULL('again')}The model wrote the break itself.`)
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'fix it', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'fix it', turnId: 't3' } as never)
  expect((await runStep($ as never, 4)).text).toBe(`${FULL('fix it')}The model wrote the whole header.`)
})

// His two real messages from 2026-11-22 19:38, where the model's own quote stayed and his words showed twice.
const TWO_FINE = '2 fine \n\nGive better example of 3 actual wording and below it response same for 4'
const TRANSLATES =
  'walk me through what the row does on a phone and what each piece of it really translates to. is that the same on the PC or not'

test('reply header: omtCopyLength finds a typed copy of his words, exact or near, and nothing else', async () => {
  // Real case 1: the model's copy has two spaces where his blank line was.
  const typed1 = '> *2 fine  Give better example of 3 actual wording and below it response same for 4*\n\n'
  expect(omtCopyLength(`${typed1}The reply.`, TWO_FINE)).toBe(typed1.trimEnd().length + 1)
  // Real case 2: the mod cut his words after "is that", the model's copy after "is".
  expect(omtHeader(TRANSLATES).endsWith('translates to. is that…*\n\n')).toBe(true)
  const typed2 = `> *${TRANSLATES.slice(0, TRANSLATES.indexOf(' that'))}…*\n`
  expect(typed2.endsWith('translates to. is…*\n')).toBe(true)
  expect(omtCopyLength(`${typed2}\nThe reply.`, TRANSLATES)).toBe(typed2.length)
  // An exact copy of the mod's own quote, and his words split over several quote lines.
  expect(omtCopyLength(`${omtHeader(TWO_FINE)}The reply.`, TWO_FINE)).toBe(omtHeader(TWO_FINE).trimEnd().length + 1)
  const split = '> *2 fine*\n>\n> *Give better example of 3 actual wording and below it response same for 4*\n'
  expect(omtCopyLength(`${split}The reply.`, TWO_FINE)).toBe(split.length)
  // Escapes and a plain "..." come off before the compare.
  expect(omtCopyLength('> *a \\*star\\* here...*\nok', 'a *star* here and more')).toBe('> *a \\*star\\* here...*\n'.length)
  // A quote line that is not a copy of his words stays, and so does a copy that comes after it.
  expect(omtCopyLength('> *Measure twice, cut once.*\nThe reply.', TWO_FINE)).toBe(0)
  expect(omtCopyLength(`> *something else*\n${typed1}`, TWO_FINE)).toBe(0)
  // A copy followed by a different quote line: only the copy goes.
  expect(omtCopyLength(`${typed1}> *Measure twice.*\n`, TWO_FINE)).toBe(typed1.trimEnd().length + 1)
  // A line that only starts like his words is not a copy, and a few characters are too short to count.
  expect(omtCopyLength('> *2 fine but no*\n', TWO_FINE)).toBe(0)
  expect(omtCopyLength('> *2*\n', TWO_FINE)).toBe(0)
  expect(omtCopyLength('> *ok*\n', 'ok')).toBe('> *ok*\n'.length)
  // Not a quote line at all.
  expect(omtCopyLength('2 fine Give better example\n', TWO_FINE)).toBe(0)
})

test('reply header: a near copy of his words the model typed itself is taken out; a quote of something else stays', async ($, on) => {
  harness(on, { fetchOk: true })
  const typed1 = '> *2 fine  Give better example of 3 actual wording and below it response same for 4*\n\n'
  omt(on, [
    [T(typed1), T('**TLDR:** here it is.'), STOP('end_turn')],
    [T(`${BREAK}\n\n${typed1}`), T('**TLDR:** again.'), STOP('end_turn')],
    [T('> *Measure twice, cut once.*\n\nThat is the line you asked about.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // Real case 1, with and without the model's own line of dashes.
  await $.prompt.submit({ text: TWO_FINE, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: TWO_FINE, turnId: 't1' } as never)
  const one = await runStep($ as never, 0)
  expect(one.text).toBe(`${omtFullHeader(TWO_FINE)}**TLDR:** here it is.`)
  expect(one.result.answer).toBe(`${omtFullHeader(TWO_FINE)}**TLDR:** here it is.`)
  expect(one.text.split('Give better').length).toBe(2)
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: TWO_FINE, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: TWO_FINE, turnId: 't2' } as never)
  const two = await runStep($ as never, 1)
  expect(two.text).toBe(`${omtFullHeader(TWO_FINE)}**TLDR:** again.`)
  expect(two.text.split(BREAK).length).toBe(2)
  await $.turn.complete(turnEnd())

  // A quote that is not a copy of his words stays, under the header.
  await $.prompt.submit({ text: 'what was that line?', origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: 'what was that line?', turnId: 't3' } as never)
  expect((await runStep($ as never, 2)).text).toBe(
    `${FULL('what was that line?')}> *Measure twice, cut once.*\n\nThat is the line you asked about.`,
  )
})

test('reply header: a message typed mid-turn puts its words on the reply it lets through; the closing message carries the first', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('About five minutes.'), TOOL, STOP('tool_use')], [T('All built.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'build it', origin: { kind: 'sdk' } } as never)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  await $.prompt.submit({ text: 'how long\nwill that take?', origin: { kind: 'bridge' } } as never)
  expect((await runStep($ as never, 0)).text).toBe(`${FULL('how long will that take?')}About five minutes.`)
  expect((await runStep($ as never, 1)).text).toBe(`${FULL('build it')}All built.`)
})

// ---------- The full-message row (item 15) ----------

const LONG =
  'So here is a long message that I dictated on my phone and it rattles on well past the one hundred characters the quote line shows over a reply.'
const ROW: Piece = { kind: 'tool', index: 1, id: 'tu9', name: 'mcp__context-guard__-_view_full_message' }
const hasRowOrder = (r: { context?: readonly string[] }) => (r.context ?? []).some(c => c.startsWith('FULL MESSAGE ROW (context-guard)'))

test('full message row: only a message he typed that is longer than the quote gets the order', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(hasRowOrder(await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never))).toBe(true)
  expect(hasRowOrder(await $.prompt.submit({ text: 'is it done?', origin: { kind: 'bridge' } } as never))).toBe(false)
  // A message another session sent is not his words: no quote, so no row.
  expect(hasRowOrder(await $.prompt.submit({ text: LONG, origin: { kind: 'peer' } } as never))).toBe(false)
  // Exactly at the cut: nothing is cut, so no row.
  expect(hasRowOrder(await $.prompt.submit({ text: 'x'.repeat(OMT_QUOTE_MAX), origin: { kind: 'bridge' } } as never))).toBe(false)
  expect(hasRowOrder(await $.prompt.submit({ text: 'x'.repeat(OMT_QUOTE_MAX + 1), origin: { kind: 'bridge' } } as never))).toBe(true)
})

test('full message row: the marker above the row becomes the quote, the tool returns his whole message, and the reply is not stamped again', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[TOOL, STOP('tool_use')], [T('QUOTE'), ROW, STOP('tool_use')], [T('**TLDR:** done.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  await runStep($ as never, 0)
  const row = await runStep($ as never, 1)
  expect(row.text).toBe(omtFullHeader(LONG).trimEnd())
  expect(row.out.map(c => c.kind).join(',')).toBe('text,tool,stop')
  const r = (await $.tool.call({ tool: 'mcp__context-guard__-_view_full_message' } as never)) as { result?: unknown; context?: unknown }
  expect(r.result).toBe(LONG)
  // The marker is never held text.
  expect(r.context).toBe(undefined)
  const last = await runStep($ as never, 2)
  expect(last.text).toBe('**TLDR:** done.')
  expect((await $.turn.complete(turnEnd())).text).toBe('ok')
})

test('full message row: a copy of his words the model typed again under the row is taken out; other text is not', async ($, on) => {
  harness(on, { fetchOk: true })
  // Real case 2: the model's copy is cut after "is", the mod's quote after "is that".
  const typed2 = `> *${TRANSLATES.slice(0, TRANSLATES.indexOf(' that'))}…*\n\n`
  omt(on, [
    [TOOL, STOP('tool_use')],
    [T('QUOTE'), ROW, STOP('tool_use')],
    [T(`${BREAK}\n\n${typed2}`), T('**TLDR:** done.'), STOP('end_turn')],
    [TOOL, STOP('tool_use')],
    [T('QUOTE'), ROW, STOP('tool_use')],
    [T('> *Measure twice, cut once.*\n\n**TLDR:** kept.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: TRANSLATES, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: TRANSLATES, turnId: 't1' } as never)
  await runStep($ as never, 0)
  expect((await runStep($ as never, 1)).text).toBe(omtFullHeader(TRANSLATES).trimEnd())
  const last = await runStep($ as never, 2)
  expect(last.text).toBe('**TLDR:** done.')
  expect(last.result.answer).toBe('**TLDR:** done.')
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't2' } as never)
  await runStep($ as never, 3)
  await runStep($ as never, 4)
  expect((await runStep($ as never, 5)).text).toBe('> *Measure twice, cut once.*\n\n**TLDR:** kept.')
})

test('full message row: a long message typed mid-turn gets its own quote and row; the closing reply keeps the first message', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('QUOTE'), ROW, STOP('tool_use')], [T('About five minutes.'), TOOL, STOP('tool_use')], [T('All built.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'build it', origin: { kind: 'sdk' } } as never)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  expect(hasRowOrder(await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never))).toBe(true)
  expect((await runStep($ as never, 0)).text).toBe(omtFullHeader(LONG).trimEnd())
  const r = (await $.tool.call({ tool: 'mcp__context-guard__-_view_full_message' } as never)) as { result?: unknown }
  expect(r.result).toBe(LONG)
  expect((await runStep($ as never, 1)).text).toBe('About five minutes.')
  expect((await runStep($ as never, 2)).text).toBe(`${omtFullHeader('build it')}All built.`)
})

const callRow = async ($: unknown) =>
  ((await ($ as { tool: { call: (i: never) => Promise<unknown> } }).tool.call({ tool: 'mcp__context-guard__-_view_full_message' } as never)) as {
    result?: unknown
    context?: unknown
  })

test('full message row: a marker with no row is dropped, never held; a row with no marker is sent back and made again with the quote', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('QUOTE'), TOOL, STOP('tool_use')],
    [ROW, STOP('tool_use')],
    [T('QUOTE'), ROW, STOP('tool_use')],
    [T('Done.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('')
  const none = (await $.tool.call({ tool: 'mcp__x__y' } as never)) as { context?: unknown }
  expect(none.context).toBe(undefined)
  // A step that holds only the row call: his phone would fold it away, so the tool sends it back.
  const bare = await runStep($ as never, 1)
  expect(bare.text).toBe('')
  expect(bare.out.map(c => c.kind).join(',')).toBe('tool,stop')
  expect((await callRow($)).result).toBe(FULL_ROW_REDO)
  // Made again with the marker: the quote goes above it and the reply is not stamped again.
  expect((await runStep($ as never, 2)).text).toBe(omtFullHeader(LONG).trimEnd())
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 3)).text).toBe('Done.')
})

test('full message row: other text before a row with no marker is held, and the row is sent back to be made again', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('Here is the row.'), ROW, STOP('tool_use')], [T('QUOTE'), ROW, STOP('tool_use')], [T('Done.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('')
  const back = await callRow($)
  expect(back.result).toBe(FULL_ROW_REDO)
  expect(String(back.context)).toContain('HELD TEXT BEGIN\nHere is the row.\nHELD TEXT END')
  expect((await runStep($ as never, 1)).text).toBe(omtFullHeader(LONG).trimEnd())
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 2)).text).toBe('Done.')
})

// 2026-11-23 fix: the model typed the finished header in place of QUOTE 13 times, and each one was held and sent back.
test('full message row: a typed header of his words in place of the marker becomes the quote, and the row is not sent back', async ($, on) => {
  harness(on, { fetchOk: true })
  // Real shapes: the copy cut at exactly the quote length mid-word, the copy cut with a space before the "…", and
  // the quote alone with no line of dashes.
  const typed = [
    `${BREAK}\n\n> *${LONG.slice(0, OMT_QUOTE_MAX)}…*`,
    `${BREAK}\n\n> *${LONG.slice(0, 90)}…*\n\n`,
    omtHeader(LONG).trimEnd(),
  ]
  omt(on, typed.flatMap(t => [[T(t), ROW, STOP('tool_use')], [T('**TLDR:** done.'), STOP('end_turn')]]))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (let i = 0; i < typed.length; i++) {
    await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
    await $.turn.start({ text: LONG, turnId: `t${i}` } as never)
    const row = await runStep($ as never, 2 * i)
    expect(row.text).toBe(omtFullHeader(LONG).trimEnd())
    expect(row.out.map(c => c.kind).join(',')).toBe('text,tool,stop')
    const r = await callRow($)
    expect(r.result).toBe(LONG)
    // Nothing was held, so no note rides beside the result.
    expect(r.context).toBe(undefined)
    expect((await runStep($ as never, 2 * i + 1)).text).toBe('**TLDR:** done.')
    await $.turn.complete(turnEnd())
  }
})

test('full message row: a typed header counts only when it is his words and nothing else', async ($, on) => {
  harness(on, { fetchOk: true })
  expect(omtRowMarks('QUOTE', LONG)).toBe(true)
  expect(omtRowMarks(omtFullHeader(LONG), LONG)).toBe(true)
  expect(omtRowMarks(`${omtFullHeader(LONG)}**TLDR:** done.`, LONG)).toBe(false)
  expect(omtRowMarks(omtFullHeader(LONG), undefined)).toBe(false)
  expect(omtRowMarks(BREAK, LONG)).toBe(false)
  // Somebody else's words in the quote: held, and the row is sent back.
  omt(on, [[T(`${BREAK}\n\n> *Measure twice, cut once.*`), ROW, STOP('tool_use')], [T('QUOTE'), ROW, STOP('tool_use')], [T('Done.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('')
  const back = await callRow($)
  expect(back.result).toBe(FULL_ROW_REDO)
  expect(String(back.context)).toContain('> *Measure twice, cut once.*\nHELD TEXT END')
  expect((await runStep($ as never, 1)).text).toBe(omtFullHeader(LONG).trimEnd())
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 2)).text).toBe('Done.')
})

test('full message row: a typed header for a long message typed mid-turn shows its row, not the sent-back order', async ($, on) => {
  harness(on, { fetchOk: true })
  // Real case 2026-11-23 10:11: the typed header went out and the row opened to the NOT SHOWN order.
  omt(on, [
    [T(`${BREAK}\n\n`), T(`> *${LONG.slice(0, OMT_QUOTE_MAX)}…*`), ROW, STOP('tool_use')],
    [T('About five minutes.'), TOOL, STOP('tool_use')],
    [T('All built.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'build it', origin: { kind: 'sdk' } } as never)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  expect(hasRowOrder(await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never))).toBe(true)
  const row = await runStep($ as never, 0)
  expect(row.text).toBe(omtFullHeader(LONG).trimEnd())
  expect(row.out.map(c => c.kind).join(',')).toBe('text,tool,stop')
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 1)).text).toBe('About five minutes.')
  expect((await runStep($ as never, 2)).text).toBe(`${omtFullHeader('build it')}All built.`)
})

test('full message row: the order and the sent-back order say the marker step is the one exception and must not be bare', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const order = ((await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)) as { context?: readonly string[] }).context ?? []
  const text = order.find(c => c.startsWith('FULL MESSAGE ROW (context-guard)')) ?? ''
  expect(text).toContain('the one exception to the rule that nothing is written before a tool call')
  expect(text).toContain('never make it bare')
  expect(FULL_ROW_REDO).toContain('the one exception to the one-message rule and to any held-text note')
})

test('full message row: a row with no marker is sent back at most twice a turn, then the quote stays on the reply', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[ROW, STOP('tool_use')], [ROW, STOP('tool_use')], [ROW, STOP('tool_use')], [T('Done.'), STOP('end_turn')], [ROW, STOP('tool_use')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  await runStep($ as never, 0)
  expect((await callRow($)).result).toBe(FULL_ROW_REDO)
  await runStep($ as never, 1)
  expect((await callRow($)).result).toBe(FULL_ROW_REDO)
  await runStep($ as never, 2)
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 3)).text).toBe(`${omtFullHeader(LONG)}Done.`)
  // The next turn starts with its redos back.
  await $.turn.complete(turnEnd())
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't2' } as never)
  await runStep($ as never, 4)
  expect((await callRow($)).result).toBe(FULL_ROW_REDO)
})

test('full message row: a second row for the same words never prints the quote twice and is not sent back', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('QUOTE'), ROW, STOP('tool_use')],
    [ROW, STOP('tool_use')],
    [T('QUOTE'), ROW, STOP('tool_use')],
    [T('Done.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe(omtFullHeader(LONG).trimEnd())
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 1)).text).toBe('')
  expect((await callRow($)).result).toBe(LONG)
  const again = await runStep($ as never, 2)
  expect(again.text).toBe('')
  expect(again.out.map(c => c.kind).join(',')).toBe('tool,stop')
  expect((await callRow($)).result).toBe(LONG)
  expect((await runStep($ as never, 3)).text).toBe('Done.')
})

test('full message row: a row with no marker is not sent back with the guard off or with none of his words', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[ROW, STOP('tool_use')], [ROW, STOP('tool_use')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'a turn nobody typed', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('')
  expect((await callRow($)).result).toBe('There is no message of his to show for this reply.')
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'One message off' })
  await $.prompt.submit({ text: LONG, origin: { kind: 'bridge' } } as never)
  await $.turn.start({ text: LONG, turnId: 't2' } as never)
  await runStep($ as never, 1)
  expect((await callRow($)).result).toBe(LONG)
})

test('full message row: called with none of his words, or by a subagent, it says so', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'a turn nobody typed', turnId: 't1' } as never)
  const r = (await $.tool.call({ tool: 'mcp__context-guard__-_view_full_message' } as never)) as { result?: unknown }
  expect(r.result).toBe('There is no message of his to show for this reply.')
  const sub = (await $.tool.call({ tool: 'mcp__context-guard__-_view_full_message', agentId: 'a1' } as never)) as { result?: unknown }
  expect(sub.result).toBe('Refused: only the main conversation.')
})

test('reply header: a turn started without a typed message gets the bare line only when something came before', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [
    [T('Nothing before me.'), STOP('end_turn')],
    [TOOL, STOP('tool_use')],
    [T('After a tool.'), STOP('end_turn')],
    [T('A notification answer.'), STOP('end_turn')],
    [T('A plugin answer.'), STOP('end_turn')],
  ])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  // The mod's own auto compact prompt (a plugin origin, and its own opening words) is never his.
  await $.prompt.submit({ text: 'P40 AUTO COMPACT (context-guard). This session has reached a context line.' })
  await $.turn.start({ text: 'P40 AUTO COMPACT (context-guard). This session has reached a context line.', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Nothing before me.')
  await $.turn.complete(turnEnd())

  await $.turn.start({ text: '', turnId: 't2' } as never)
  await runStep($ as never, 1)
  expect((await runStep($ as never, 2)).text).toBe(`${BREAK}\n\nAfter a tool.`)
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'Task done.', origin: { kind: 'task-notification' } } as never)
  await $.turn.start({ text: 'Task done.', turnId: 't3' } as never)
  expect((await runStep($ as never, 3)).text).toBe('A notification answer.')
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'hello from a mod', origin: { kind: 'plugin', name: 'other' } } as never)
  await $.turn.start({ text: 'hello from a mod', turnId: 't4' } as never)
  expect((await runStep($ as never, 4)).text).toBe('A plugin answer.')
})

test("reply header: the app's own notes are not his words, whatever origin they arrive with", async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('One line.'), STOP('end_turn')], [TOOL, STOP('tool_use')], [T('After a tool.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const NOTE =
    '<system-reminder>\nThe session "P40 Spare" you started (local_1) finished a turn. It reported: "ok"\n</system-reminder>\n\n' +
    `<side-sessions-event>None of the sessions you started is working now; their notes are above. ${'x'.repeat(200)}</side-sessions-event>`
  const others = [
    `Another Claude session sent a message:\n<cross-session-message from="local_2" from-name="PETER">${'y'.repeat(200)}</cross-session-message>`,
    `<task-notification><task-id>b1</task-id>${'z'.repeat(200)}</task-notification>`,
    `[SYSTEM NOTIFICATION - NOT USER INPUT]\n${'w'.repeat(200)}`,
    `<ci-monitor-event pr="1">${'v'.repeat(200)}</ci-monitor-event>`,
  ]
  // Long, and from the desktop app's own origin, yet none of them gets the row order.
  for (const text of [NOTE, ...others]) {
    expect(hasRowOrder(await $.prompt.submit({ text, origin: { kind: 'sdk' } } as never))).toBe(false)
  }
  // A turn such a note starts is a turn with none of his words: no quote, and the bare line only after a tool.
  await $.turn.start({ text: NOTE, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('One line.')
  await $.turn.complete(turnEnd())
  await $.prompt.submit({ text: NOTE, origin: { kind: 'sdk' } } as never)
  await $.turn.start({ text: NOTE, turnId: 't2' } as never)
  await runStep($ as never, 1)
  expect((await runStep($ as never, 2)).text).toBe(`${BREAK}\n\nAfter a tool.`)
  // His own long message still gets the order.
  expect(hasRowOrder(await $.prompt.submit({ text: LONG, origin: { kind: 'sdk' } } as never))).toBe(true)
})

test('reply header: the auto compact prompt the mod submits itself carries no words', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, usagePct: 10 })
  omt(on, [[T('Context 71%. Auto compact is starting now.'), TOOL, STOP('tool_use')], [T('Queued.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.session.measure(measure(71))
  await clock.advance(1_100)
  const go = sentGo(h)
  expect(go.length).toBe(1)
  // A mod's own $.prompt.submit skips its own prompt.submit hook (no rules rode beside it), so the hook never sees
  // it; the turn it starts matches none of his typed messages.
  expect((go[0].context ?? []).some(c => c.includes('STANDING RULES FROM THE REPO'))).toBe(false)
  await $.turn.start({ text: go[0].text, turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Context 71%. Auto compact is starting now.')
  expect((await runStep($ as never, 1)).text).toBe(`${BREAK}\n\nQueued.`)
})

test('reply header: a shortcut reply gets none', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('Muted.'), STOP('end_turn')], [T('The one-message guard is on.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'mute', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'mute', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Muted.')
  await $.turn.complete(turnEnd())
  await $.prompt.submit({ text: 'One message on', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'One message on', turnId: 't2' } as never)
  expect((await runStep($ as never, 1)).text).toBe('The one-message guard is on.')
})

test('reply header: guard off gets none, and a subagent step is untouched', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('Guard off reply.'), STOP('end_turn')], [T('Subagent reply.'), STOP('end_turn')], [T('Main reply.'), STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.prompt.submit({ text: 'One message off' })
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'hello', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Guard off reply.')
  await $.turn.complete(turnEnd())

  await $.prompt.submit({ text: 'One message on' })
  await $.prompt.submit({ text: 'hello again', origin: { kind: 'composer' } } as never)
  await $.turn.start({ text: 'hello again', turnId: 't2' } as never)
  expect((await runStep($ as never, 1, 'agent-1')).text).toBe('Subagent reply.')
  expect((await runStep($ as never, 2)).text).toBe(`${FULL('hello again')}Main reply.`)
})

test('one message: held text with no last message after it is shown beneath the end of the turn', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('The answer.'), TOOL, STOP('tool_use')], [STOP('end_turn')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('')
  await $.tool.call({ tool: 'mcp__x__y' } as never)
  expect((await runStep($ as never, 1)).text).toBe('')
  const end = await $.turn.complete(turnEnd())
  expect(end.text).toBe('The answer.')
  // The next turn starts clean.
  await $.turn.start({ text: 'next', turnId: 't2' } as never)
  const end2 = await $.turn.complete(turnEnd())
  expect(end2.text).toBe('ok')
})

test('one message: "One message off" lets everything through in every session; "One message on" returns the guard', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  omt(on, [[T('Text before a tool.'), TOOL, STOP('tool_use')], [T('Text before a tool.'), TOOL, STOP('tool_use')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const off = await $.prompt.submit({ text: 'One message off' })
  expect(h.store.oneMessage).toBe(false)
  expect((off.context ?? []).some(c => c.includes('The one-message guard is off.'))).toBe(true)
  expect((off.context ?? []).some(c => c.startsWith('CONTEXT LINE'))).toBe(false)
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect((await runStep($ as never, 0)).text).toBe('Text before a tool.')
  await $.turn.complete(turnEnd())

  const back = await $.prompt.submit({ text: 'one message on.' })
  expect(h.store.oneMessage).toBe(true)
  expect((back.context ?? []).some(c => c.includes('The one-message guard is on.'))).toBe(true)
  await $.turn.start({ text: 'hi', turnId: 't2' } as never)
  expect((await runStep($ as never, 1)).text).toBe('')
})

test('one message: a subagent step is left alone', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [[T('Subagent text before a tool.'), TOOL, STOP('tool_use')]])
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  expect((await runStep($ as never, 0, 'agent-1')).text).toBe('Subagent text before a tool.')
})

// ---------- The long turn guard (item 17) ----------

const LT_LOG = 'C:/Project/_Claude/P40 Compact Notes/Long Turn Log.txt'
const LONG_NOTE = '(context-guard) LONG TURN'
const REFUSED = '(context-guard) LONG WAIT REFUSED'
const START = { cwd: 'C:/Project', surface: 'desktop', isInteractive: true } as never
type Called = { result?: unknown; context?: unknown; deny?: unknown }
const bash = (command: string, more: Record<string, unknown> = {}) => ({ tool: 'Bash', command, ...more }) as never
const pwsh = (command: string, more: Record<string, unknown> = {}) => ({ tool: 'PowerShell', command, ...more }) as never
const X = { tool: 'mcp__x__y' } as never
// The shell tools answer as a session's would.
function shell(on: Parameters<Parameters<typeof test>[1]>[1]) {
  on('tool.call', { tool: /^(Bash|PowerShell)$/ }, () => ({ result: 'ran' }) as never)
}

test('long turn: ltShellWait reads a plain wait and lets ordinary quick work through', async () => {
  // Waits.
  expect(ltShellWait({ command: 'npm test', timeout: 120_000 })).toContain('timeout is 120 seconds')
  expect(ltShellWait({ command: 'sleep 90' })).toContain('about 90 seconds')
  expect(ltShellWait({ command: 'sleep 2m' })).toContain('about 120 seconds')
  expect(ltShellWait({ command: 'Start-Sleep -Seconds 75' })).toContain('about 75 seconds')
  expect(ltShellWait({ command: 'Start-Sleep -Milliseconds 90000' })).toContain('about 90 seconds')
  expect(ltShellWait({ command: 'sleep 40 && sleep 30' })).toContain('about 70 seconds')
  expect(ltShellWait({ command: 'for i in 1 2 3 4 5 6 7; do sleep 10; done' })).toContain('about 70 seconds')
  expect(ltShellWait({ command: 'for i in {1..30}; do sleep 5; done' })).toContain('about 150 seconds')
  expect(ltShellWait({ command: 'foreach ($i in 1..20) { Start-Sleep 5 }' })).toContain('about 100 seconds')
  expect(ltShellWait({ command: 'until test -f done.txt; do sleep 5; done' })).toContain('no fixed end')
  expect(ltShellWait({ command: 'while ($true) { if (Test-Path x) { break }; Start-Sleep 2 }' })).toContain('no fixed end')
  expect(ltShellWait({ command: 'timeout /t 90' })).toContain('about 90 seconds')
  expect(ltShellWait({ command: 'python -c "import time; time.sleep(120)"' })).toContain('about 120 seconds')
  // Not waits.
  expect(ltShellWait({ command: 'ls -la' })).toBe(undefined)
  expect(ltShellWait({ command: 'npm test', timeout: 60_000 })).toBe(undefined)
  expect(ltShellWait({ command: 'sleep 300', run_in_background: true })).toBe(undefined)
  expect(ltShellWait({ command: 'npm test', timeout: 600_000, run_in_background: true })).toBe(undefined)
  expect(ltShellWait({ command: 'sleep 5' })).toBe(undefined)
  expect(ltShellWait({ command: 'for i in 1 2 3; do curl -s x && break; sleep 10; done' })).toBe(undefined)
  // A timeout of a minute or less caps the call, whatever it sleeps.
  expect(ltShellWait({ command: 'until test -f x; do sleep 1; done', timeout: 30_000 })).toBe(undefined)
  expect(ltShellWait({ command: 'while read line; do echo "$line"; done < list.txt' })).toBe(undefined)
  // A script being written, a sentence, and a search are not waits.
  expect(ltShellWait({ command: "cat > run.sh <<'EOF'\nsleep 300\nEOF\nchmod +x run.sh" })).toBe(undefined)
  expect(ltShellWait({ command: "git commit -m 'fix the poll so it does not sleep 90 seconds'" })).toBe(undefined)
  expect(ltShellWait({ command: 'grep -rn "sleep" src' })).toBe(undefined)
})

test('long turn: in a main session a long foreground wait on the shell is refused, and quick or background work runs', async ($, on) => {
  harness(on, { fetchOk: true })
  omt(on, [])
  shell(on)
  await $.session.start(START)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  const slow = (await $.tool.call(bash('npm test', { timeout: 300_000 }))) as Called
  expect(String(slow.deny)).toContain(REFUSED)
  expect(String(slow.deny)).toContain('run_in_background: true')
  expect(String(((await $.tool.call(pwsh('Start-Sleep -Seconds 120'))) as Called).deny)).toContain(REFUSED)
  expect(((await $.tool.call(bash('npm test', { timeout: 300_000, run_in_background: true }))) as Called).result).toBe('ran')
  expect(((await $.tool.call(bash('ls'))) as Called).result).toBe('ran')
  expect(((await $.tool.call(pwsh('Get-ChildItem', { timeout: 30_000 }))) as Called).result).toBe('ran')
})

test('long turn: past a minute of the turn a note rides beside the next tool result, at most once a minute, and never blocks it', async ($, on) => {
  const clock = mock.clock(on)
  harness(on, { fetchOk: true })
  omt(on, [])
  await $.session.start(START)
  await $.turn.start({ text: 'build it', turnId: 't1' } as never)
  await clock.advance(30_000)
  const early = (await $.tool.call(X)) as Called
  expect(early.result).toBe('tool ran')
  expect(early.context).toBe(undefined)
  await clock.advance(35_000)
  const late = (await $.tool.call(X)) as Called
  expect(late.result).toBe('tool ran')
  expect(String(late.context)).toContain(LONG_NOTE)
  expect(String(late.context)).toContain('over 1 min')
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await clock.advance(30_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await clock.advance(31_000)
  expect(String(((await $.tool.call(X)) as Called).context)).toContain('over 2 min')
  // A new turn starts the clock over.
  await $.turn.complete(turnEnd())
  await $.turn.start({ text: 'next', turnId: 't2' } as never)
  await clock.advance(10_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
})

test("long turn: time a question box waits on him, and a compaction inside the turn, are not the turn's", async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, askWait: () => clock.sleep(120_000), compactWait: () => clock.sleep(150_000) })
  omt(on, [])
  await $.session.start(START)
  await $.turn.start({ text: 'ask me', turnId: 't1' } as never)
  await clock.advance(20_000)
  const asking = $.tool.call({ tool: 'AskUserQuestion', questions: [{ question: 'Which?', header: 'Pick', multiSelect: false, options: [{ label: 'A', description: 'a' }, { label: 'B', description: 'b' }] }] } as never)
  await clock.advance(120_000)
  await asking
  // 140 seconds on the wall, 20 of its own.
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  const compacting = $.session.compact({ trigger: 'auto', messages: [{ role: 'user', text: 'hi', toolUses: [] }] })
  await clock.advance(150_000)
  await compacting
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await clock.advance(41_000)
  expect(String(((await $.tool.call(X)) as Called).context)).toContain(LONG_NOTE)
  await $.turn.complete(turnEnd())
  expect(h.files[LT_LOG]).toContain('| 61 s |')
})

test('long turn: a main turn over a minute gets one line in Long Turn Log.txt beside the P40 log; a short one gets none', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true })
  omt(on, [])
  on('classic.UserPromptSubmit', () => ({}) as never)
  await $.session.start(START)
  await $.classic.UserPromptSubmit({ prompt: 'go', session_title: 'PORTER - VAULT & MEMORY' } as never)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  await clock.advance(20_000)
  await $.tool.call(X)
  await $.tool.call(X)
  await clock.advance(55_000)
  await $.turn.complete(turnEnd())
  expect(h.files[LT_LOG]).toMatch(/^\S+ PORTER - VAULT & MEMORY \| 75 s \| 2 tool calls\n$/)
  await $.turn.start({ text: 'quick', turnId: 't2' } as never)
  await clock.advance(10_000)
  await $.turn.complete(turnEnd())
  expect((h.files[LT_LOG] ?? '').split('\n').filter(l => l.length > 0).length).toBe(1)
})

test('long turn: "Long turn off" switches the refusal, the note, and the log off in every session; "Long turn on" returns them', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true })
  omt(on, [])
  shell(on)
  await $.session.start(START)
  const off = await $.prompt.submit({ text: 'Long turn off.' })
  expect(h.store.longTurn).toBe(false)
  expect((off.context ?? []).some(c => c.includes('Reply with exactly this line and nothing else, no tool calls: The long turn guard is off.'))).toBe(true)
  await $.turn.start({ text: 'Long turn off.', turnId: 't1' } as never)
  expect(((await $.tool.call(bash('sleep 120'))) as Called).result).toBe('ran')
  await clock.advance(90_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await $.turn.complete(turnEnd())
  expect(h.files[LT_LOG]).toBe(undefined)

  const back = await $.prompt.submit({ text: 'long turn ON' })
  expect(h.store.longTurn).toBe(true)
  expect((back.context ?? []).some(c => c.includes('The long turn guard is on.'))).toBe(true)
  await $.turn.start({ text: 'x', turnId: 't2' } as never)
  expect(String(((await $.tool.call(bash('sleep 120'))) as Called).deny)).toContain(REFUSED)
  // Inside a longer message the words mean nothing special.
  const said = await $.prompt.submit({ text: 'should I say long turn off?' })
  expect((said.context ?? []).some(c => c.includes('long turn guard'))).toBe(false)
  expect(h.store.longTurn).toBe(true)
})

test('long turn: a subagent, and a session whose brief carries the line LONG TURNS OK, are left alone; a mention in a sentence is not the marker', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true })
  omt(on, [])
  shell(on)
  on('session.id', () => ({ value: 'worker-1' }))
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  expect(((await $.tool.call({ tool: 'Bash', command: 'sleep 120', agentId: 'agent-1' } as never)) as Called).result).toBe('ran')
  await $.turn.complete(turnEnd())
  await $.prompt.submit({ text: 'Put the line `LONG TURNS OK` in the brief.' })
  await $.turn.start({ text: 'x', turnId: 't2' } as never)
  expect(String(((await $.tool.call(bash('sleep 120'))) as Called).deny)).toContain(REFUSED)
  await $.turn.complete(turnEnd())
  expect(h.store.longTurnWorkers).toBe(undefined)

  await $.prompt.submit({ text: 'You are a background worker for Porter.\nLONG TURNS OK\nDo the build.' })
  await $.turn.start({ text: 'brief', turnId: 't3' } as never)
  expect(((await $.tool.call(bash('sleep 120'))) as Called).result).toBe('ran')
  await clock.advance(120_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await $.turn.complete(turnEnd())
  expect(h.files[LT_LOG]).toBe(undefined)
  expect(h.store.longTurnWorkers).toEqual(['worker-1'])
})

test('long turn: after a mod reload a worker is still known by its session id, and any other session is a main', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  omt(on, [])
  shell(on)
  let id = 'worker-1'
  on('session.id', () => ({ value: id }))
  h.store.longTurnWorkers = ['worker-1']
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't1' } as never)
  expect(((await $.tool.call(bash('sleep 120'))) as Called).result).toBe('ran')
  await $.turn.complete(turnEnd())
  id = 'main-1'
  await $.session.start(START)
  await $.turn.start({ text: 'go', turnId: 't2' } as never)
  expect(String(((await $.tool.call(bash('sleep 120'))) as Called).deny)).toContain(REFUSED)
})

test('long turn: the auto compact turn, and a turn that called compact_now, get no note and no log line', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, onDisk: [NOTES], p40On: true })
  omt(on, [])
  await $.session.start(START)
  await $.turn.start({ text: 'P40 AUTO COMPACT (context-guard). This session has reached a context line.', turnId: 't1' } as never)
  await clock.advance(90_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await $.turn.complete(turnEnd())

  await $.turn.start({ text: 'answer him', turnId: 't2' } as never)
  await clock.advance(30_000)
  await $.tool.call(compactNow(NOTES))
  await clock.advance(60_000)
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await $.turn.complete(turnEnd())
  await clock.advance(2_000)
  expect(h.files[LT_LOG]).toBe(undefined)
})

test('long turn: beside the one-message guard, the held text and the long turn note ride the same tool result', async ($, on) => {
  const clock = mock.clock(on)
  harness(on, { fetchOk: true })
  omt(on, [[T('Some text first. '), TOOL, STOP('tool_use')], [T('Final.'), STOP('end_turn')]])
  await $.session.start(START)
  await $.turn.start({ text: 'hi', turnId: 't1' } as never)
  await clock.advance(70_000)
  expect((await runStep($ as never, 0)).text).toBe('')
  const r = (await $.tool.call(X)) as Called
  expect(r.result).toBe('tool ran')
  expect(String(r.context)).toContain(HELD_NOTE)
  expect(String(r.context)).toContain(LONG_NOTE)
  expect((await runStep($ as never, 1)).text).toBe(`${BREAK}\n\nFinal.`)
})

// ---------- The Peck type (item 18) and the 60-second ask (item 19), 1.0.31 ----------

const ASK_TOOL = 'mcp__context-guard__ask_a_peck'
const ask = (more: Record<string, unknown> = {}) =>
  ({ tool: ASK_TOOL, higher: 'Fable at Max', lower: 'Opus at Extra', job: 'Audit the rules copies.', ...more }) as never
// Chris's three lines, approved 2026-11-22 ("3 approved"); the trailing period of the job is dropped.
const BOX_TEXT = 'Job: Audit the rules copies\nRun this Peck on Fable at Max?\nNo answer in 60 seconds: Opus at Extra.'
const LOWER_LINE = (why: string) =>
  `"In your report, say in one line that you ran on Opus at Extra, lower than the main wanted (Fable at Max): ${why}."`
const P40_START = { cwd: 'C:/Project', surface: 'desktop', isInteractive: true } as never

test('Peck type: registered at session start as context-guard:peck, Opus at High, every tool, compacts at 300,000', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(WORKER_TYPE).toBe('context-guard:peck')
  expect(h.agents.length).toBe(1)
  const spec = h.agents[0] as Record<string, unknown>
  expect(spec.name).toBe('peck')
  expect(spec.model).toBe('opus')
  expect(spec.effort).toBe('high')
  expect(spec.autoCompactWindow).toBe(300_000)
  expect(WORKER_COMPACT_AT).toBe(300_000)
  expect('tools' in spec).toBe(false)
  expect(String(spec.description)).toContain('in place of general-purpose')
  expect(String(spec.prompt).length > 200).toBe(true)
  // A reload registers it again (the engine replaces a type of the same name).
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.agents.length).toBe(2)
})

test('Peck type: a refused registration does not stop session start; the tools still register and the rules still ride', async ($, on) => {
  const h = harness(on, { fetchOk: true, agentThrows: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.registered.some(r => r.name === 'ask_a_peck' && r.isDeferred === true)).toBe(true)
  const r = await $.prompt.submit({ text: 'hello' })
  expect((r.context ?? []).some(c => c.startsWith('STANDING RULES FROM THE REPO'))).toBe(true)
})

test('ask a Peck: the tool is deferred; a tap on the higher option starts the Peck on it, with no brief line', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, answer: 'Fable at Max' })
  await $.session.start(P40_START)
  expect(h.registered.some(r => r.name === 'ask_a_peck' && r.isDeferred === true)).toBe(true)
  const r = (await $.tool.call(ask())) as { result?: string }
  expect(h.asked).toEqual([BOX_TEXT])
  expect(WORKER_BOX.test(h.asked[0] ?? '')).toBe(true)
  expect(h.buttons[0]).toEqual(['Fable at Max', 'Opus at Extra'])
  expect(r.result).toBe('USE: Fable at Max. Chris picked it in the box. Start the Peck on it now.')
  // Nothing is left waiting: the minute passing afterwards changes nothing.
  await clock.advance(70_000)
})

test('ask a Peck: a tap on the lower option starts lower, with no brief line (his pick, Chris "1" 2026-11-22)', async ($, on) => {
  mock.clock(on)
  harness(on, { fetchOk: true, answer: 'Opus at Extra' })
  await $.session.start(P40_START)
  const r = (await $.tool.call(ask())) as { result?: string }
  expect(r.result).toBe('USE: Opus at Extra. Chris picked it in the box. Start the Peck on it now.')
  expect(String(r.result)).not.toContain('In your report')
})

test('ask a Peck: no answer in a minute means the lower option; the companion takes the box down at its minute', async ($, on) => {
  const clock = mock.clock(on)
  // The box under the mod: nobody taps; the companion closes it at its own minute (a deny, so the ask rejects).
  const h = harness(on, { fetchOk: true, answer: 'DISMISS', askWait: () => clock.sleep(60_000) })
  await $.session.start(P40_START)
  let settled: { result?: string } | undefined
  const call = ($.tool.call(ask()) as Promise<{ result?: string }>).then(r => {
    settled = r
  })
  await clock.advance(59_000)
  expect(settled).toBe(undefined)
  await clock.advance(2_000)
  await call
  expect(h.asked.length).toBe(1)
  expect(settled?.result).toBe(
    `USE: Opus at Extra. No answer in 1 minute. Start the Peck on it now, and put this line in its brief, word for word: ${LOWER_LINE('Chris did not answer the 60-second box')}`,
  )
  expect(String(settled?.result)).not.toContain(WORKER_STILL_UP)
  expect(h.files[P40_LOG_FILE]).toContain('ask_a_peck, Fable at Max or Opus at Extra: none')
  expect(h.files[P40_LOG_FILE]).not.toContain('still up')
})

test('ask a Peck: when no companion takes the box down, the answer says it is still on his screen, and the log says why', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, askWait: () => new Promise(() => undefined) })
  await $.session.start(P40_START)
  let settled: { result?: string } | undefined
  const call = ($.tool.call(ask()) as Promise<{ result?: string }>).then(r => {
    settled = r
  })
  await clock.advance(60_500)
  expect(settled).toBe(undefined)
  await clock.advance(3_000)
  await call
  expect(String(settled?.result)).toContain('USE: Opus at Extra. No answer in 1 minute.')
  expect(String(settled?.result)).toContain(LOWER_LINE('Chris did not answer the 60-second box'))
  expect(String(settled?.result).endsWith(WORKER_STILL_UP)).toBe(true)
  expect(h.files[P40_LOG_FILE]).toContain('the companion box closer is not loaded in this session')
})

test('ask a Peck: a box closed with no pick inside the minute, and words typed instead of a tap', async ($, on) => {
  mock.clock(on)
  const h = harness(on, { fetchOk: true, answer: 'DISMISS' })
  await $.session.start(P40_START)
  const closed = (await $.tool.call(ask())) as { result?: string }
  expect(closed.result).toBe(
    `USE: Opus at Extra. The box closed with no pick. Start the Peck on it now, and put this line in its brief, word for word: ${LOWER_LINE('Chris closed the box without a pick')}`,
  )
  expect(h.asked.length).toBe(1)
})

test('ask a Peck: words typed in the box go back to the main with the lower option as the fallback', async ($, on) => {
  mock.clock(on)
  harness(on, { fetchOk: true, answer: 'use fable but only at high' })
  await $.session.start(P40_START)
  const r = (await $.tool.call(ask())) as { result?: string }
  expect(String(r.result)).toContain('Chris typed in the box instead of tapping: "use fable but only at high"')
  expect(String(r.result)).toContain('USE: Opus at Extra')
  expect(String(r.result)).toContain(LOWER_LINE('Chris typed in the box instead of picking'))
})

test('ask a Peck: no box on an unattended run, in a Peck session, or from a subagent: the lower option at once, with the line', async ($, on) => {
  mock.clock(on)
  const h = harness(on, { fetchOk: true, answer: 'Fable at Max' })
  on('session.id', () => ({ value: 'worker-1' }))
  await $.session.start(P40_START)
  const away = (await $.tool.call(ask({ unattended: true }))) as { result?: string }
  expect(away.result).toBe(
    `USE: Opus at Extra. No box: an unattended run, so nobody was asked. Start the Peck on it now, and put this line in its brief, word for word: ${LOWER_LINE('an unattended run, so nobody was asked')}`,
  )
  const sub = (await $.tool.call(ask({ agentId: 'agent-1' }))) as { result?: string }
  expect(String(sub.result)).toContain('No box: it was started from inside a Peck, so nobody was asked.')
  expect(h.asked.length).toBe(0)
  // A session whose brief carried the Peck marker (item 17).
  await $.prompt.submit({ text: 'You are a Peck session for Porter.\nLONG TURNS OK\nDo the build.' })
  const peck = (await $.tool.call(ask())) as { result?: string }
  expect(String(peck.result)).toContain('No box: a Peck session, so nobody was asked.')
  expect(String(peck.result)).toContain(LOWER_LINE('a Peck session, so nobody was asked'))
  expect(h.asked.length).toBe(0)
})

test('ask a Peck: a call that does not name two different options is refused and asks nothing', async ($, on) => {
  const h = harness(on, { fetchOk: true })
  await $.session.start(P40_START)
  expect(String(((await $.tool.call(ask({ higher: '' }))) as { result?: string }).result)).toContain('Refused')
  expect(String(((await $.tool.call(ask({ higher: 'opus at extra' }))) as { result?: string }).result)).toContain('Refused')
  expect(h.asked.length).toBe(0)
})

test("ask a Peck: the minute the box waits on him is not the turn's own time", async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, answer: 'DISMISS', askWait: () => clock.sleep(60_000) })
  omt(on, [])
  await $.session.start(START)
  await $.turn.start({ text: 'start the audit Peck', turnId: 't1' } as never)
  await clock.advance(20_000)
  const asking = $.tool.call(ask())
  await clock.advance(61_000)
  await asking
  // 81 seconds on the wall, 20 of its own.
  expect(((await $.tool.call(X)) as Called).context).toBe(undefined)
  await $.turn.complete(turnEnd())
  expect(h.files[LT_LOG]).toBe(undefined)
})

test('P40: a box still up a moment after its minute is noted in the P40 log; one the companion took down is not', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, askWait: () => new Promise(() => undefined) })
  await $.session.start(P40_START)
  await $.session.measure(measure(61))
  await clock.advance(61_100)
  expect(sentGo(h).length).toBe(1)
  expect(h.files[P40_LOG_FILE] ?? '').not.toContain('still up')
  await clock.advance(3_000)
  expect(h.files[P40_LOG_FILE]).toContain('the 61% box is still up after its minute')
})

test('P40: a box the companion takes down at its minute leaves no still-up line', async ($, on) => {
  const clock = mock.clock(on)
  const h = harness(on, { fetchOk: true, p40On: true, answer: 'DISMISS', askWait: () => clock.sleep(60_000) })
  await $.session.start(P40_START)
  await $.session.measure(measure(61))
  await clock.advance(65_000)
  expect(sentGo(h).length).toBe(1)
  expect(h.files[P40_LOG_FILE] ?? '').not.toContain('still up')
})
