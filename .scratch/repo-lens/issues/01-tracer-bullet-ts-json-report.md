# 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**What to build:** Running `repo-lens scan --emit json` on a TypeScript/JavaScript fixture produces the complete machine contract: every tracked source file as a module with size, complexity, and PageRank centrality; import/require edges between modules; dependency cycles; and package entrypoints. This is the tracer bullet - it cuts the full vertical spine (discovery, parsing, resolution, graph, metrics, report, CLI, test seam) one language deep, and every other ticket builds on its contract.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `repo-lens scan --emit json <ts-fixture>` exits 0 and prints a report matching the report contract: meta, modules[], edges[], cycles[], entrypoints[]
- [ ] Discovery respects .gitignore; only tracked source files appear; language detected by extension
- [ ] TS/JS resolver turns relative import/require statements into edges; unresolvable references (node_modules, externals) excluded from edges
- [ ] Modules carry size, complexity, and PageRank centrality metrics
- [ ] A fixture containing a deliberate cycle reports that cycle in cycles[]
- [ ] package.json entrypoint detection flags entry modules
- [ ] Same fixture + same flags produces byte-identical output across runs (ordering-stable)
- [ ] Subprocess seam tests cover the above against fixture ground truth