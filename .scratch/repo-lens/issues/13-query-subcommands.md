# 13 — Query subcommands + --report

**What to build:** The agent-facing query surface that replaces the planned MCP query-graph tool: `top`, `module`, `graph`, `cycles`, `entrypoints`, `search` - pure, deterministic queries over the report contract - plus `--report <file>` so agents scan once and query a persisted report without re-scanning.

**Blocked by:** 12 — AXI output layer (TOON)

**Status:** ready-for-agent

- [ ] New pure module `src/core/report-queries.ts` with deterministic query functions over `ReportContract`: top by metric, module detail, dependency/dependent/neighborhood sets, cycle clusters, entrypoints, id/path search - all with stable ordering
- [ ] Subcommands render through the TOON layer (ticket 12): `repo-lens top --metric complexity|coupling|centrality [--limit N] [--folder <dir>]`, `repo-lens module <id> [--full]`, `repo-lens graph --deps-of <id> | --dependents-of <id> | --neighborhood <id>`, `repo-lens cycles [--limit N]`, `repo-lens entrypoints`, `repo-lens search <query>`
- [ ] Every query subcommand accepts `--report <file>`: load a persisted JSON report (from `scan --emit json --output`) and answer without re-scanning; without it, scan the path in-memory then answer
- [ ] Outputs are bounded (limit + truncation) and ordered deterministically; results include aggregate counts
- [ ] CLI stays a thin adapter: dispatch + argument parsing only; business logic lives in report-queries
- [ ] Seam tests: subprocess queries over a fixture report file assert exact output; `--report` on a stale/missing file errors clearly (exit 1)
