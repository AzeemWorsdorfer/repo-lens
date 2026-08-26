# 02 — Python resolver + fixture + tests

**What to build:** Scanning a Python fixture produces an accurate module graph through the resolver registry: import/module statements resolved to edges via the package module map, entrypoints detected (entry scripts, `__main__`).

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Python resolver registered in the language registry
- [ ] Python fixture report shows correct modules and edges per fixture ground truth
- [ ] Entrypoint detection flags Python entry scripts
- [ ] Subprocess seam tests prove graph accuracy for the fixture