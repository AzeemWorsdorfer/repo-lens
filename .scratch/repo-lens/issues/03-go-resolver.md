# 03 — Go resolver + fixture + tests

**What to build:** Scanning a Go fixture produces an accurate module graph through the resolver registry: import paths mapped to local modules, `main()` entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Go resolver registered in the language registry
- [ ] Go fixture report shows correct modules and edges per fixture ground truth
- [ ] Entrypoint detection flags Go main packages
- [ ] Subprocess seam tests prove graph accuracy for the fixture