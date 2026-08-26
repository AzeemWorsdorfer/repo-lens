# 06 — C/C++ resolver + fixture + tests

**What to build:** Scanning a C and C++ fixture produces an accurate module graph through the resolver registry: `#include` directives resolved to local headers, `main()` entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] C and C++ resolvers registered in the language registry
- [ ] C/C++ fixture report shows correct modules and edges per fixture ground truth
- [ ] Entrypoint detection flags main definitions
- [ ] Subprocess seam tests prove graph accuracy for the fixture