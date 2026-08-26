# 07 — HTML artifact + Dependencies view

**What to build:** `repo-lens scan` produces a single self-contained interactive HTML report: bundled Cytoscape.js and D3, embedded report data, and the Dependencies view - one node per module with edges from the report, click-to-inspect side panel (path, language, dependencies, dependents, metrics), and search/folder/language filtering.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Output HTML is fully self-contained - zero network requests; works offline and via file://
- [ ] Embedded data JSON parses and matches the report contract (HTML smoke seam test)
- [ ] Dependencies view renders one node per module; edges match the report
- [ ] Clicking a node opens a side panel with path, language, deps, dependents, metrics
- [ ] Search and folder/language filters narrow the visible graph