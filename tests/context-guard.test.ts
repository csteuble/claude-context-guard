import { expect, mock, test } from 'claude-code/testing'

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

function harness(on: Parameters<Parameters<typeof test>[1]>[1], opts: { stored?: Record<string, number>; fetchOk?: boolean; usagePct?: number; onCompact?: (instructions: string | undefined) => void; registerThrows?: boolean; mute?: 'ok' | 'fail' | 'refused'; noUsage?: boolean; onDisk?: string[]; p40On?: boolean; answer?: string } = {}) {
  const asked: string[] = []
  const buttons: string[][] = []
  const registered: Array<Record<string, unknown>> = []
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
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
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
  on('session.compact', (_, e) => {
    if (e.trigger === 'plugin' || !Array.isArray(e.messages)) {
      throw new Error('$.session.compact: not available in a headless (-p / SDK) session yet')
    }
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
  return { asked, buttons, store, registered, entered, ran, files, commands }
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
  expect(r.context?.length).toBe(3)
  expect(r.context?.[1]).toBe('NO GO IN THIS MESSAGE: answer, record, or show only.')
  expect(r.context?.[2]).toContain('CONTEXT LINE (context-guard)')
  expect(h.asked.length).toBe(0)
})

test('the no-go line rides only when the message holds no go word and is not a bare option number', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['Thoughts?', 'I want the e2 ultra', 'can you check the log', 'going to lunch']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(3)
    expect(r.context?.[1]).toBe('NO GO IN THIS MESSAGE: answer, record, or show only.')
  }
  for (const text of ['go', 'Execute', 'do it', 'fix it please', 'change it', 'build it out', 'write it', '1', ' 2. ', 'Okay, go ahead']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(2)
    expect(r.context?.[1]).toContain('CONTEXT LINE (context-guard)')
  }
})

test('a message that opens with a yes (his answer to an offer line) carries no no-go line', async ($, on) => {
  harness(on, { fetchOk: true })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  for (const text of ['yes', 'Yes.', 'Yeah, put them up', 'yep', 'Yup!', 'Do that', 'please do', ' sure ', 'OK', 'Okay.']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(2)
    expect(r.context?.[1]).toContain('CONTEXT LINE (context-guard)')
  }
  for (const text of ['yesterday it broke', 'No', 'ok so what happened', 'sure it is safe?', 'that looks fine to me']) {
    const r = await $.prompt.submit({ text })
    expect(r.context?.length).toBe(3)
    expect(r.context?.[1]).toBe('NO GO IN THIS MESSAGE: answer, record, or show only.')
  }
})

test('when the fetch fails: baked rules ride, and a RULES BROKEN box with Got it / Thanks pops at session start', async ($, on) => {
  const h = harness(on, { fetchOk: false })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  expect(h.asked).toEqual(['RULES BROKEN\nStart a new session or tell Claude to fix it.'])
  expect(h.buttons[0]).toEqual(['Got it', 'Thanks'])
  const r = await $.prompt.submit({ text: 'hello' })
  expect(r.context?.[0]).toContain('then the TLDR line')
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
  expect(h.registered.length).toBe(3)
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
  expect((off.context ?? []).some(c => c.endsWith('P40 auto compact is off. The old warning boxes are back.'))).toBe(true)
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
