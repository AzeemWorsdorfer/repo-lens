# 03 — Go resolver + fixture + tests

**What to build:** Scanning a Go fixture produces an accurate module graph through the resolver registry: import paths mapped to local modules, `main()` entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** done — shipped in PR #5 (`feat/03-go-resolver`, merge `c4f0a83`), merged to `main` 2026-08-27

- [x] Go resolver registered in the language registry
- [x] Go fixture report shows correct modules and edges per fixture ground truth
- [x] Entrypoint detection flags Go main packages
- [x] Subprocess seam tests prove graph accuracy for the fixture
