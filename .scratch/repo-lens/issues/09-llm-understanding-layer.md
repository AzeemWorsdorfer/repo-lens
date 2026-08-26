# 09 — LLM understanding layer

**What to build:** When a provider is configured, scanning adds narrative understanding via context-efficient hierarchical summarization: batched leaf file summaries rolled up into module summaries (distillations only, never raw source), then a repo-level architecture narrative and flow diagrams for entry points - all within a hard token budget spent on centrality-ranked files first, through a provider-agnostic client (OpenAI-compatible endpoints, Anthropic, local Ollama). Without configuration, summaries are honestly absent and all structural views remain fully intact.

**Blocked by:** 01 — Tracer bullet: scan a TS/JS repo into a deterministic JSON report

**Status:** ready-for-agent

- [ ] Provider-agnostic client: OpenAI-compatible (configurable base URL), Anthropic, local Ollama via env config - no vendor lock
- [ ] With a stub provider pointed at a mock base URL (subprocess seam), leaf file summaries appear in the report
- [ ] Module summaries are built from prior distillations, never raw source
- [ ] Architecture narrative and flows[] present in report; the budget flag actually caps requested tokens (asserted against stub call logs)
- [ ] `--no-llm` or absent keys: summaries deterministically absent and marked as such; all structural data intact (honesty contract)