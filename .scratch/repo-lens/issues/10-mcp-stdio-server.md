# 10 — MCP stdio server (deferred)

**Status:** deferred - superseded by the AXI adoption (see SPEC "AXI-native CLI").

**Decision:** repo-lens's v1 agent interface is the AXI-native CLI - token-efficient TOON output, query subcommands (ticket 13), content-first home (ticket 14). A stdio MCP server is not built in v1: AXI benchmarks show MCP tool schemas inflate input tokens (~2.3x vs an AXI CLI) and split action from observation into extra turns, while every agent harness already runs CLIs. Revisit only if a harness demonstrates a need for tool-call integration; any future server is a thin adapter over the same core - ticket 13's query subcommands already expose the capability as CLI verbs.

**What it would have been (kept for future reference):** `repo-lens mcp` exposing scan, summarize, and query-graph as MCP tools over stdio JSON-RPC.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report
