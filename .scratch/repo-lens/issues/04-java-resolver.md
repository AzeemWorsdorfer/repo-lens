# 04 — Java resolver + fixture + tests

**What to build:** Scanning a Java fixture produces an accurate module graph through the resolver registry: imports resolved via the package map, `main()` entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** implemented on `feat/04-java-resolver`; pending merge

- [x] Java resolver registered in the language registry
- [x] Java fixture report shows correct modules and edges per fixture ground truth
- [x] Entrypoint detection flags Java main classes
- [x] Subprocess seam tests prove graph accuracy for the fixture
