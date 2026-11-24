// The mod's own tool, so `on('tool.call', { tool: 'mcp__context-guard__context_fill' })` type-checks
// before the engine has listed it among the session's MCP tools.
export type ContextFillInput = Record<string, never>

// P40 (2026-11-23, PETER's stuck 65% box): the box that is up and waiting on its minute, kept in $.state so a mod
// reload or a lost hooks worker inside the minute does not drop it. `pct` is the percent the box shows; `deadline`
// is when its minute runs out, in milliseconds since the epoch ($.clock.now()). null once the box has settled.
export type P40Pending = { pct: number; deadline: number }

declare module 'claude-code' {
  interface McpToolInputs {
    "mcp__context-guard__context_fill": ContextFillInput
  }
  interface PluginState {
    'context-guard': { p40Pending: P40Pending | null }
  }
}
