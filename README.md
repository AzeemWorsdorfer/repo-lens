# repo-lens

> Understand any codebase in minutes. One command. One interactive report.

**Status: in development** - the JSON graph report is implemented (`scan --emit json`); the HTML viewer, remaining language resolvers, LLM layer, and the AXI agent CLI are planned (see roadmap).

`repo-lens` is a CLI that scans a repository and produces a single self-contained, interactive HTML report visualizing how the code works: the module dependency graph, dependency cycles, a folder treemap, a complexity-vs-coupling scatter, and - when an LLM is configured - an architecture overview with flow diagrams for key entry points.

It is built to be **harness-agnostic**: an AXI-native CLI (Agent eXperience Interface - token-efficient output, query subcommands, agent-friendly defaults) with a machine-readable JSON contract, so a human's terminal, a CI pipeline, and any AI coding harness (pi, Claude Code, Cursor, Copilot) all drive the identical capability through the shell.

## How it works

Hybrid understanding, in three layers:

1. **Deterministic pass (free, always).** Tree-sitter parses every tracked source file. This yields the entire graph - modules, imports, dependencies, coupling, complexity, cycles - with zero token cost and total accuracy.
2. **Hierarchical progressive summarization (optional LLM pass).** When a provider is configured, file summaries roll up into module summaries (distillations only, never raw source), then into a repo-level architecture narrative and flow diagrams.
3. **Budget discipline.** A hard token budget is spent on the most central files first (PageRank centrality x complexity x size). No keys, no budget, no problem: `--no-llm` mode still ships every structural view.

## Features

- **Dependencies** - interactive module graph: click any node for path, deps, dependents, and metrics; search and filter by folder and language
- **Cycles** - dependency cycles detected and clustered
- **Treemap** - folder structure colored by complexity and coupling
- **Complexity scatter** - complexity vs coupling, for prioritizing refactors
- **Architecture overview & flows** - LLM-synthesized narrative of what the codebase does and what happens when entry points are called
- **One file, anywhere** - the report is a single offline HTML file, shareable and versionable; `serve` exists for very large reports

## Language support

TypeScript / JavaScript, Python, Go, Java, Rust, and C/C++ - each with a pluggable resolver in a registry, so adding a language is a small PR.

## CLI

The scan subcommand is live for the JSON report; `html`, `serve`, and the query subcommands are planned.

```
repo-lens                        # repo overview dashboard (content first)
repo-lens scan [path]            # scan a repository
  --emit json|toon|html          # json = canonical machine contract; toon = token-efficient
                                 # agent rendering; html = interactive report (planned)
  --output <file>                # write the report to a file instead of stdout
repo-lens top --metric <m>       # highest complexity/coupling/centrality modules
repo-lens module <id>            # one module: deps, dependents, metrics, summary
repo-lens graph --deps-of <id>   # a module's neighborhood (also --dependents-of/--neighborhood)
repo-lens cycles                 # dependency cycles, largest first
repo-lens entrypoints            # entry modules
repo-lens search <query>         # module id/path search
repo-lens summarize [path]       # LLM pass (planned)
repo-lens serve [path]           # local viewer for large reports (planned)
```

Query subcommands accept `--report <file>` to answer against a previously scanned report without re-scanning. Agent-facing output uses TOON by default (lossless, token-efficient); `--emit json` stays the canonical byte-identical contract.

LLM configuration is provider-agnostic via environment variables:
`REPO_LENS_LLM_PROVIDER` (openai-compatible | anthropic | ollama), `REPO_LENS_LLM_BASE_URL`, and the standard `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Nothing is ever sent to a provider unless you configure one.

## Roadmap

- [x] Spec (`.scratch/repo-lens/SPEC.md`)
- [x] Ticket breakdown (`.scratch/repo-lens/issues/`)
- [x] Tracer bullet: scan a TypeScript repo into a deterministic JSON report
- [ ] Python, Go, Java, Rust, C/C++ resolvers
- [ ] Interactive HTML report
- [ ] LLM understanding layer
- [ ] AXI output layer (TOON rendering, ticket 12)
- [ ] Query subcommands + `--report` (ticket 13)
- [ ] Content-first home + contextual disclosure (ticket 14)
- [ ] CLI polish, docs, packaging, agent skill

## Development

Requires Node.js and npm. Hooks (Husky + lint-staged + Prettier + typecheck + tests) run on every commit; CI runs the same gates on every PR against `main`. Branch rules: `main` is protected - no direct pushes, PRs only; work on `feat/<NN>-<slug>` branches matching the tickets in `.scratch/repo-lens/issues/`.

## License

MIT © 2026 AzeemWorsdorfer
