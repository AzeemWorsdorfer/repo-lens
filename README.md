# repo-lens

> Understand any codebase in minutes. One command. One interactive report.

**Status: in development** - the spec and tickets below define the planned product; no code has landed yet.

`repo-lens` is a CLI that scans a repository and produces a single self-contained, interactive HTML report visualizing how the code works: the module dependency graph, dependency cycles, a folder treemap, a complexity-vs-coupling scatter, and - when an LLM is configured - an architecture overview with flow diagrams for key entry points.

It is built to be **harness-agnostic**: a pure CLI with a machine-readable JSON contract, plus a stdio MCP server, so a human's terminal, a CI pipeline, and any AI coding harness (pi, Claude Code, Cursor, Copilot) all drive the identical capability.

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

## CLI (planned)

```
repo-lens scan [path]      # report to repo-lens-report.html
  --output <file>          # report file path
  --emit html|json         # json = machine-readable graph report
  --open                   # open in browser
  --no-llm                 # skip LLM pass
  --budget <tokens>        # LLM token budget
  --config <path>          # config file
repo-lens serve [path]     # local viewer for large reports
repo-lens mcp              # stdio MCP server (scan/summarize/query-graph)
```

LLM configuration is provider-agnostic via environment variables:
`REPO_LENS_LLM_PROVIDER` (openai-compatible | anthropic | ollama), `REPO_LENS_LLM_BASE_URL`, and the standard `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`. Nothing is ever sent to a provider unless you configure one.

## Roadmap

- [x] Spec (`.scratch/repo-lens/SPEC.md`)
- [x] Ticket breakdown (`.scratch/repo-lens/issues/`)
- [ ] Tracer bullet: scan a TypeScript repo into a deterministic JSON report
- [ ] Python, Go, Java, Rust, C/C++ resolvers
- [ ] Interactive HTML report
- [ ] LLM understanding layer
- [ ] MCP stdio server
- [ ] CLI polish, docs, packaging

## Development

Requires Node.js and npm. Build and test commands will be documented here as the tool lands.

## License

MIT © 2026 AzeemWorsdorfer