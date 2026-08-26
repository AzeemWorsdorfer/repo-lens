# repo-lens - Codebase Visualization CLI

Status: Spec (approved for planning; implementation pending)

## Problem Statement

Engineers facing an unfamiliar codebase - a new job, a new team, an old service nobody remembers - spend hours reading files, chasing imports, and mentally assembling structure before they can do any real work. Existing tools don't solve this: file trees and grep give lists, not understanding; AST dumps give raw data that demands engineering effort to interpret; diagrams built by hand are stale the moment they're drawn. Meanwhile, AI coding agents need the same structural understanding and have no standard, harness-agnostic way to get it. Engineers and agents need a tool that turns a repository into a navigable, shared, accurate picture of how it works - fast, cheap, and portable.

## Solution

`repo-lens` is a TypeScript CLI that scans any codebase and produces a single self-contained, interactive HTML report visualizing how it works: a module dependency graph (centerpiece), dependency cycle clusters, a folder treemap, a complexity-vs-coupling scatter, and - when an LLM is configured - an architecture overview with flow diagrams for entry points. It is hybrid by design: a deterministic tree-sitter pass computes every graph accurately and free, and an optional, provider-agnostic LLM layer adds narrative understanding through context-efficient hierarchical summarization (leaf file summaries rolled up to modules, then to a repo-level architecture narrative) constrained by a hard token budget and centrality-ranked file selection. The same core exposes a machine-readable JSON report and a minimal stdio MCP server, so a human's terminal, a CI pipeline, and any AI harness (pi, Claude Code, Cursor, Copilot) all drive the identical capability. Harness-agnostic by construction: a pure CLI first, MCP second, sharing one core library.

## User Stories

1. As an engineer joining a new codebase, I want to run one command and immediately see the module dependency graph, so that I can understand the overall structure without reading every file first.
2. As an engineer studying an unfamiliar module, I want to click any node in the graph and see its path, language, dependencies, dependents, size, complexity, and (if available) an LLM summary in a side panel, so that I can drill into context without leaving the report.
3. As an engineer in a large repo, I want to search and filter modules by name, folder, and language, so that I can isolate the parts I care about.
4. As an engineer, I want to highlight a module's neighborhood (its direct dependencies and dependents), so that I can trace what a change would affect.
5. As an engineer, I want dependency cycles detected, clustered, and shown as a dedicated view, so that I can identify architectural debt immediately.
6. As an engineer, I want a folder treemap colored by complexity and coupling, so that I can see where pain concentrates at a glance.
7. As an engineer, I want a complexity-vs-coupling scatter plot, so that I can prioritize which files to refactor first.
8. As an engineer, I want the report to be one self-contained offline HTML file, so that I can open it anywhere, share it with teammates, and version it without infrastructure.
9. As an engineer without an LLM API key, I want all structural views to work fully, so that I get complete value without cost, external calls, or setup.
10. As a security-conscious engineer, I want the LLM pass to only run when I configure a provider/key, so that no code ever leaves my machine without my explicit setup.
11. As an engineer, I want an architecture overview (layers + narrative) when an LLM is configured, so that I get the "story" of the codebase, not just its skeleton.
12. As an engineer, I want flow diagrams generated for key entry points, so that I can understand end-to-end behavior such as "what happens when X is called".
13. As an engineer on a TypeScript, Python, Go, Java, Rust, or C/C++ codebase, I want accurate dependency resolution, so that the graph reflects reality rather than guesses.
14. As an engineer on a monorepo or large repo, I want the scan to complete in predictable time, so that the tool remains usable as repos grow.
15. As an engineer, I want to control the LLM token budget, so that costs and latency stay predictable.
16. As an engineer, I want to run the scan without an LLM and have the report note where summaries are absent, so that partial understanding is honest rather than fabricated.
17. As an agent harness, I want `repo-lens` exposed as MCP tools (scan, summarize, query-graph), so that I can build structural awareness of a codebase I'm working on.
18. As an agent or script, I want `--emit json` to output the full graph contract, so that I never have to parse HTML.
19. As a CI engineer, I want to run the scan in CI and publish the HTML artifact, so that architecture documentation stays current automatically.
20. As a maintainer, I want to diff report JSON between versions, so that I can track architectural drift and coupling regressions.
21. As a user of very large reports, I want `repo-lens serve` to view the report locally, so that the browser doesn't choke on a giant single file.
22. As a contributor, I want a documented language-resolver registry, so that I can add a new language without restructuring the tool.
23. As an engineer, I want clear progress and error output while scanning, so that I know what is happening and why a scan might fail.
24. As a user, I want the report in a polished dark theme by default, so that I can present it to teammates without embarrassment.

## Implementation Decisions

- **Stack**: TypeScript/Node, single npm package (`repo-lens`), `bin` entry. MCP server is a subcommand of the same binary sharing the core library - no separate package or daemon.
- **Hybrid architecture**: a deterministic analysis core (tree-sitter) computes all graph data with zero tokens and no hallucinations; an optional LLM layer adds narrative. Structural views must never depend on the LLM pass.
- **Primary artifact**: one self-contained HTML file per scan (embedded data + bundled Cytoscape.js and D3 + viewer app; zero network, offline, shareable). `--emit json` emits the same underlying report as machine-readable JSON. `repo-lens serve` is a thin convenience for large reports, not the primary contract.
- **V1 visualization vault** (all views in one report, switchable): Overview (stats + LLM architecture narrative), Dependencies (interactive graph), Cycles (grouped clusters), Treemap (folder heatmap), Complexity scatter, Flows (LLM flow diagrams). Rendering: Cytoscape.js for the graph (canvas, handles thousands of nodes, built-in layouts/search/neighborhood), D3 for treemap and scatter.
- **Scan strategy (context-efficient)**:
  1. Deterministic pass: .gitignore-aware discovery; language detection by extension; tree-sitter parse of all tracked source files; imports/require/includes resolved to graph edges; entrypoint detection per ecosystem (package.json main, `__main__`, Go/Java `main`, crate root, etc.).
  2. Hierarchical progressive summarization: batched leaf file summaries (structure + intent) → module roll-ups fed only prior distillations (never raw source) → one repo-level architecture narrative + flow extraction from entrypoints.
  3. Budget discipline: hard `--budget` token cap (default ~120k); files ranked by centrality (PageRank on the module graph × complexity × size); budget spends on most informative files first; `--no-llm` or absent keys degrades gracefully with summaries marked absent.
- **Report JSON contract** (shared by `--emit json` and the HTML embed): `meta` (repo, languages, counts, budget used), `modules[]` (id, path, language, size, complexity, coupling, centrality, deps, dependents, summary?), `edges[]` (source/target/kind), `cycles[]`, `entrypoints[]`, `architecture` (layers + narrative), `flows[]` (id, name, description, entrypoint, steps). Metric definitions (cyclomatic complexity, afferent+efferent coupling, PageRank-based centrality) and the `flows[].steps` schema are pinned in `docs/adr/`.
- **Languages**: TypeScript/JavaScript, Python, Go, Java, Rust, C/C++. Each language contributes a resolver (import → edge mapping) and entrypoint detection via a registry interface; adding a language is a new resolver module, not a rewrite.
- **LLM layer is provider-agnostic**: OpenAI-compatible endpoints (custom base URL), Anthropic, and local Ollama, via env keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `REPO_LENS_LLM_PROVIDER`, `REPO_LENS_LLM_BASE_URL`). No vendor lock; nothing is sent unless configured.
- **CLI contract**: `repo-lens scan [path]` with `--output`, `--emit html|json`, `--open`, `--no-llm`, `--budget`, `--config`; `repo-lens serve [path]`; `repo-lens mcp` (stdio MCP server exposing scan/summarize/query-graph); config via `repo-lens.config.json` (repo root or user config dir); deterministic mode needs zero config.
- **In-repo issue tracking**: spec and future tickets live under `.scratch/<feature>/` as local markdown.

## Testing Decisions

- **Primary seam - CLI subprocess → JSON report**: tests spawn the built binary (`repo-lens scan --emit json <fixture>`) and assert on the structured report: expected modules, edges, metrics, cycle detection, and summaries (LLM layer tested against a stub provider pointed at a local mock via `REPO_LENS_LLM_BASE_URL`). Behavior is asserted through the public contract only - no internal module imports in tests.
- **Secondary seam - MCP stdio JSON-RPC**: tests speak raw `initialize` / `tools/list` / `tools/call` messages to `repo-lens mcp` and assert protocol-valid responses.
- **Tertiary seam - HTML artifact smoke check**: file exists, is self-contained (no external URLs), and its embedded data JSON parses and matches the report contract. Visual/pixel assertions are a manual sniff test, not CI.
- **What makes a good test here**: deterministic fixture repos as ground truth (one deliberately containing a dependency cycle); same fixture + same flags → byte-identical report (ordering-stable); asserts external behavior, never implementation details.
- **Module test coverage**: report correctness over fixtures (per language), cycle detection, entrypoint detection, budget-selection logic, LLM hierarchical summarization against the stub, CLI flag/error handling, MCP protocol responses, HTML validity.
- **Prior art**: none - greenfield repo. First tests establish the convention: vitest + node child_process over fixtures under `test/fixtures/`.

## Out of Scope

- Git history/churn analytics (git log mining is a separate effort, deferred).
- Full function-level call graphs (module-level graphs first).
- MCP transports beyond stdio; persistent graph-query workspaces.
- Plugin SDK / third-party language resolvers at runtime (the registry exists and docs cover adding languages, but no plugin loading yet).
- Export formats beyond HTML and JSON.
- Hosted/shared report infrastructure.

## Further Notes

- **Harness-agnostic philosophy**: the tool is first and foremost a well-behaved CLI with structured output - the same way agents and scripts use `git` or `jq`. MCP is a thin adapter over the same core, deliberately minimal in v1 (stdio, three tools).
- **Shareability posture**: the single-file artifact makes the report a first-class document - commit it, attach it to a PR, email it. This is a deliberate product decision.
- **Distribution**: npm (`npx repo-lens`), aiming for near-universal install for engineers and one-command adoption in agent harnesses.
- **Honesty contract**: when the LLM pass is skipped, reports clearly mark summaries as absent rather than implying false completeness.
