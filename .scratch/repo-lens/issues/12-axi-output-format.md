# 12 — AXI output layer (TOON)

**What to build:** The token-efficient rendering layer behind every agent-facing command: TOON output via the official `toon` npm package, minimal default schemas with `--fields` expansion, content truncation with a size hint and `--full` escape hatch, pre-computed aggregates inline, and definitive empty states - all byte-deterministic.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] TOON renderer emits report slices (module lists, cycles, entrypoints, module detail, search results) via the official `toon` npm package (github.com/toon-format/toon); output is byte-deterministic for identical input
- [ ] Default schemas expose 3-4 fields per item (path, language, primary metric); `--fields <a,b,c>` requests more
- [ ] Long text fields (LLM summaries, narratives) truncate with a size hint like `(truncated, 2847 chars - use --full)`; `--full` returns the complete text
- [ ] Pre-computed aggregates inline: counts for every list (`count: 126 labels[126]{...}`), totals and derived statuses, so agents do not round-trip
- [ ] Definitive empty states: explicit `0 results` output rather than empty stdout
- [ ] `--emit toon` supported by `scan` alongside `--emit json|html`; the JSON contract is unchanged - TOON is a rendering layer, never the source of truth
- [ ] Seam tests assert TOON determinism, truncation hints, empty states, and default-vs-`--fields` schema behavior via subprocess
