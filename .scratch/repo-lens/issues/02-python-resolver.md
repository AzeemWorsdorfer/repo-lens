# 02 — Python resolver + fixture + tests

**What to build:** Scanning a Python fixture produces an accurate module graph through the resolver registry: import/module statements resolved to edges via the package module map, entrypoints detected (entry scripts, `__main__`).

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** done — shipped in PR #4 (`feat/02-python-resolver`, merge `2326a32`), merged to `main` 2026-08-27

- [x] Python resolver registered in the language registry
- [x] Python fixture report shows correct modules and edges per fixture ground truth
- [x] Entrypoint detection flags Python entry scripts
- [x] Subprocess seam tests prove graph accuracy for the fixture
