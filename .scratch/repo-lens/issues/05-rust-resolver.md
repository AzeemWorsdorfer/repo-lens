# 05 — Rust resolver + fixture + tests

**What to build:** Scanning a Rust fixture produces an accurate module graph through the resolver registry: `mod`/`use`/crate references resolved to edges, crate-root entrypoint detection.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** implemented on `fm/repo-lens-05-rust-resolver`; pending review

- [x] Rust resolver registered in the language registry
- [x] Rust fixture report shows correct modules and edges per fixture ground truth
- [x] Entrypoint detection flags the crate root
- [x] Subprocess seam tests prove graph accuracy for the fixture
