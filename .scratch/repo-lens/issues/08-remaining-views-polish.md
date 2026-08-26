# 08 — Remaining views + visual polish

**What to build:** Completes the five-view vault in the HTML artifact: Overview (stats + architecture narrative when present), Cycles cluster view (module clusters drawn from report data), folder treemap (D3, complexity/coupling coloring, zoomable), complexity scatter (complexity vs coupling), and Flows diagrams - each rendering a graceful "not configured" state when the LLM data is absent, under one polished dark theme.

**Blocked by:** 07 — HTML artifact + Dependencies view

**Status:** ready-for-agent

- [ ] Cycles view clusters modules from the report's cycles data
- [ ] Treemap renders folder structure with complexity/coupling coloring and is zoomable
- [ ] Complexity scatter plots modules by complexity vs coupling
- [ ] Overview shows repo stats and architecture narrative when present; clean "not configured" state otherwise
- [ ] Flows view renders flow diagrams when present; graceful otherwise
- [ ] Consistent dark theme across all views; HTML smoke test finds no broken views or dead links