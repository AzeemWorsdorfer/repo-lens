# repo-lens Coding Standards

The single source of truth for how we write code in this repository. Read this before contributing. Agents working in this repo should follow it too.

Principles, in priority order:

1. **Human-readable first** - someone who has never seen the code should be able to follow it line by line.
2. **Well-documented** - document *why*, never just *what*.
3. **Maintainable** - small, single-purpose pieces; change is cheap; no cleverness.
4. **Scalable** - the architecture must absorb new languages, new views, and bigger repos without restructuring.

## Language and Tooling

- TypeScript, strict mode, ESM. No `any`, no silent `@ts-ignore`.
- Formatting and linting are automated (Prettier + ESLint); hand-formatting is not a review topic, lint is.
- Type casts are only allowed at trust boundaries (CLI input, report contract parsing) and must carry a comment explaining why the boundary is safe.
- Tests use vitest and run in CI. A PR that changes behavior without tests is not complete.

## Module Layout and Architecture

The codebase is deliberately layered, and each layer owns its vocabulary:

- **Core** - pure, deterministic analysis: discovery, resolvers, graph, metrics, report assembly. No I/O beyond reading files, no side effects, no LLM.
- **LLM layer** - optional, provider-agnostic; consumes core output, never raw source.
- **HTML viewer** - presentation only; reads the report contract.
- **CLI / MCP** - thin adapters over core. No business logic in adapters.
- **Tests** - black-box at the seams (CLI subprocess, MCP stdio, HTML artifact). No internal imports in tests.

Rules:

- Dependencies point inward: adapters may depend on core, core never depends on adapters.
- Each module is a **deep module**: a small, clear interface and a complex implementation hidden behind it. Resist leaking internals to callers.
- A module file exists to do one thing. If a file needs "and also", split it.
- New functionality arrives through the registry pattern (see `resolvers`), not by editing core control flow. Adding a language is a new resolver module, nothing else.

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `report-contract.ts`, `python-resolver.ts` |
| Classes / types | PascalCase | `ModuleGraph`, `CycleFinder` |
| Functions | camelCase, verb-first | `buildModuleGraph`, `detectEntryPoints` |
| Variables | camelCase | `moduleCount` |
| Module-level constants | SCREAMING_SNAKE | `DEFAULT_BUDGET_TOKENS`, `SUPPORTED_LANGUAGES` |
| Booleans | `is`/`has`/`can`/`should` prefix | `isExternal`, `hasCycle`, `shouldSkip` |
| Types | descriptive nouns from the domain | `Module`, `Edge`, `ReportContract` |

Additional rules:

- No type prefixes (`iModule`, `ModuleType`), no Hungarian notation, no `x`/`tmp`-style names.
- No abbreviations in names. `numModules` beats `nModules`; `resolver` beats `res`.
- Functions read as sentences: `scoreCentrality(module)` not `centralityScore(module)`.
- Acronyms keep normal capitalization rules: `parseAST` not `parseAst` not `ParseAST`.
- Wait - `parseAST` here means the acronym starts the word; the convention is camelCase with acronyms uppercase: `parseAST`, `buildHTTPClient`.
- Name things for what they are in the domain (report contract, module, edge, entrypoint), not for where they live.

## Domain Vocabulary

Use this glossary consistently in code, comments, tests, and docs. If you need a new concept, extend this list - do not invent synonyms.

- **report contract** - the JSON shape shared by `--emit json` and the HTML embed
- **module** - one source file in the report
- **edge** - a dependency between two modules
- **cycle** - a group of modules that depend on each other circularly
- **entrypoint** - a module that starts a program (main, crate root, entry script)
- **resolver** - a per-language translator from imports to edges, behind the registry
- **deterministic pass** - the free, always-run static analysis (discovery + parse + graph + metrics)
- **LLM pass / summarization** - the optional narrative layer (leaf, roll-up, top levels)
- **budget** - the hard token cap for the LLM pass
- **centrality** - ranking score (PageRank x complexity x size) that drives budget spend
- **vault** - the set of views in the HTML report
- **seam** - a testing boundary (subprocess, MCP stdio, HTML smoke)

## Documentation Standards

- Every exported function gets a JSDoc block: one line on what it does, one on why it exists or when to use it. Skip the "how" - the code is the how.
- Comments explain *why* decisions were made, or call out non-obvious behavior. Never restate the code.
- Every module (file) starts with a one-line header comment stating its responsibility, unless the file name already makes it obvious.
- Documentation for user-facing behavior lives in the README; architecture rationale lives in ADRs; code-level rationale lives next to the code. Keep each in its place.

## Maintainability Rules

- Small functions. If a function does more than one thing, it names at most one thing.
- Pure functions preferred: same input, same output, no hidden state. Determinism is a product feature (byte-identical reports) - keep ordering explicit and stable.
- No magic numbers or inline strings that mean something: named constants.
- Fail loudly with actionable messages: the error should tell the user what happened and what to do. No swallow-all catch blocks.
- Avoid early cleverness: prefer the obvious solution that meets the contract. Optimize with evidence, and only after the obvious one is proven insufficient.
- Scale-aware: walking and parsing must never be accidental O(n^2); big-repo scans stream, they do not load the world into memory.

## Testing Standards

- Assert **external behavior** at the seams - never implementation details. A test that names an internal function is a design smell.
- Fixtures are ground truth: small repos with known graphs, one deliberate cycle fixture, byte-deterministic expectations.
- Test names describe behavior in plain language (given/when/then), e.g. "reports a cycle when two modules import each other".
- Cover the seams listed in the spec; manual browser sniff tests are labeled as such, not CI assertions.

## Git and Commit Standards

- One logical change per commit; commits are small and land green.
- Commit messages are conventional and descriptive: `type(scope): summary` - e.g. `feat(graph): detect dependency cycles`, `fix(resolvers): map python package dirs to modules`.
- No auto-generated files in commits (build output, coverage, changelogs).
- Never add an agent name as co-author to any commit.

## Review Checklist

Before asking for a review, self-check:

- [ ] Every public function has JSDoc; comments explain why, not what
- [ ] Names follow the conventions table; no abbreviations or type prefixes
- [ ] No `any`; casts only at boundaries with a comment
- [ ] Module is a deep module; nothing leaks; no duplicated control flow
- [ ] New language work used the registry, not an edit to core flow
- [ ] Behavior tested at a seam with fixture ground truth
- [ ] Lint and typecheck pass; tests green