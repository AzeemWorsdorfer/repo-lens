# 11 — CLI polish, serve, docs, packaging

**What to build:** Production-ready developer experience around the core: `repo-lens serve` for viewing large reports, config-file loading merged with flags and environment, `--open`, clear progress and error output, README with usage/LLM setup/MCP install snippets, a register-a-new-language guide, and verified npm distribution from a clean checkout plus a real-world end-to-end scan.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] `repo-lens serve` serves a report locally at a local URL
- [ ] Config loaded from repo-lens.config.json (repo root and/or user config dir), merged with flags and env
- [ ] `--open` launches the default browser; progress output during scan; runtime failures exit non-zero with a clear message
- [ ] README covers usage, config, LLM setup, and MCP install snippets for harnesses
- [ ] Register-a-new-language guide documents the resolver registry
- [ ] npm pack + clean-checkout `npx repo-lens` works
- [ ] Full E2E: scan a real mid-size repo → HTML opens, graphs render, no console errors