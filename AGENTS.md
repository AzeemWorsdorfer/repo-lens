# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read `docs/coding-standards.md` and follow it too - it is binding for everyone.

## Authoritative documents

- `docs/coding-standards.md` - the coding standards: architecture layering, naming conventions, documentation, testing, git discipline. **Follow it on every change.** When in doubt about style, naming, or structure, this document decides.
- `.scratch/repo-lens/SPEC.md` - the product spec (problem, solution, user stories, decisions).
- `.scratch/repo-lens/issues/` - the issue tracker: one markdown file per ticket, numbered in dependency order. Tickets marked `ready-for-agent` with approval are the work queue; respect their "Blocked by" edges.
- `README.md` - user-facing product description.

## Working here

- Do not scaffold or restructure without consulting `docs/coding-standards.md` first - especially the module layout and the resolver registry pattern.
- New languages arrive as resolver modules in the registry. Never add languages by editing core control flow.
- Tests assert external behavior at the seams (CLI subprocess, MCP stdio, HTML artifact) with fixture repos as ground truth; no internal library imports in tests.
- Keep the domain vocabulary from the standards doc: module, edge, cycle, entrypoint, resolver, report contract, deterministic pass, LLM pass, budget, centrality, vault, seam.
- Reports and scans must be deterministic: explicit, stable ordering everywhere.
- Commit messages are conventional (`feat(scope): summary`); never auto-add an agent name as co-author.
- Do not commit generated files (build output, coverage, node_modules).

## Branching and CI

- `main` is protected and always green: no direct pushes, PRs only, CI must pass.
- All work happens on feature branches named after the ticket: `feat/<NN>-<slug>` (e.g. `feat/01-tracer-bullet`). One branch per ticket, short-lived, opened as a draft PR early.
- CI (`.github/workflows/ci.yml`) runs on every PR and on push to `main`: install, lint, typecheck, test (build included). A merge to `main` must be green.
- Pre-commit hooks (Husky + lint-staged) format staged files and run typecheck + tests before every commit - never bypass them with `--no-verify`.
