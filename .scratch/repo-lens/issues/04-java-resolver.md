# 04 — Java resolver + fixture + tests

**What to build:** Scanning a Java fixture produces an accurate module graph through the resolver registry: imports resolved via the package map, `main()` entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Java resolver registered in the language registry
- [ ] Java fixture report shows correct modules and edges per fixture ground truth
- [ ] Entrypoint detection flags Java main classes
- [ ] Subprocess seam tests prove graph accuracy for the fixture