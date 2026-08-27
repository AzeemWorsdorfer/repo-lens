# 11 — CLI polish, serve, docs, packaging

**What to build:** Production-ready developer experience around the core: `repo-lens serve` for viewing large reports, config-file loading merged with flags and environment, `--open`, clear progress and error output, the AXI error/exit contract, README with usage/LLM setup/agent-usage snippets, a register-a-new-language guide, an installable agent skill, and verified npm distribution from a clean checkout plus a real-world end-to-end scan.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] `repo-lens serve` serves a report locally at a local URL
- [ ] Config loaded from repo-lens.config.json (repo root and/or user config dir), merged with flags and env
- [ ] `--open` launches the default browser; progress output during scan goes to **stderr only** - stdout carries nothing but the report/structured data
- [ ] AXI error contract: exit 0 success / 1 error / 2 unknown flag; structured errors written to stdout, stderr reserved for diagnostics; no interactive prompts anywhere; unknown flags fail loud
- [ ] README covers usage, config, LLM setup, and an agent-usage section with AXI output examples
- [ ] Installable agent skill (AXI principle 7) that teaches agents the subcommands, TOON output shape, and `help[]` conventions
- [ ] Register-a-new-language guide documents the resolver registry
- [ ] npm pack + clean-checkout `npx repo-lens` works
- [ ] Full E2E: scan a real mid-size repo → HTML opens, graphs render, no console errors
