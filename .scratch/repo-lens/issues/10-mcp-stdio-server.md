# 10 — MCP stdio server

**What to build:** `repo-lens mcp` exposes the core capability as Model Context Protocol tools over stdio - scan, summarize, and query-graph - so any agent harness can install and drive the same understanding a human gets from the CLI.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] `initialize` and `tools/list` respond with protocol-valid JSON-RPC naming the three tools
- [ ] `tools/call scan` returns the report shape for a given path
- [ ] `tools/call query-graph` answers module/dependency/cycle queries over a scanned report
- [ ] `tools/call summarize` returns per-module summaries or the absent state
- [ ] MCP stdio seam tests prove the above with raw JSON-RPC