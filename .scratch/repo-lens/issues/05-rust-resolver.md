# 05 — Rust resolver + fixture + tests

**What to build:** Scanning a Rust fixture produces an accurate module graph through the resolver registry: `mod`/`use`/crate references resolved to edges, crate-root entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Rust resolver registered in the language registry
- [ ] Rust fixture report shows correct modules and edges per fixture ground truth
- [ ] Entrypoint detection flags the crate root
- [ ] Subprocess seam tests prove graph accuracy for the fixture