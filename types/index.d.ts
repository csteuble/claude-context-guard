// The mod's own tool, so `on('tool.call', { tool: 'mcp__context-guard__context_fill' })` type-checks
// before the engine has listed it among the session's MCP tools.
export type ContextFillInput = Record<string, never>

declare module 'claude-code' {
  interface McpToolInputs {
    "mcp__context-guard__context_fill": ContextFillInput
  }
}
