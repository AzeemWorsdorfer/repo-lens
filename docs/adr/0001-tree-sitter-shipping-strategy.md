# ADR 0001 - Tree-sitter shipping strategy

Status: Accepted

## Context

The deterministic pass must parse source in six language families
(TypeScript/JavaScript, Python, Go, Java, Rust, C/C++) to extract imports,
metrics, and entry points. The spec promises "near-universal install" via
`npx repo-lens` and a single npm package with no daemon. Tree-sitter grammars
can ship two ways: native N-API bindings (compiled per platform) or
WebAssembly (portable, no native code).

## Decision

Use **WASM grammars** via the `web-tree-sitter` runtime. The eight grammar
`.wasm` files are vendored into the repo at pinned versions (sourced from the
official grammar repositories, committed under `grammars/`) and shipped in
the published package. `web-tree-sitter` is the only tree-sitter npm
dependency.

## Why not native grammars

Native `tree-sitter-<language>` packages declare mutually incompatible
`peerDependencies` on `tree-sitter`. Observed during setup:
`tree-sitter-cpp@0.23.4` requires `tree-sitter@^0.21.1` while
`tree-sitter-c@0.24.1` requires `tree-sitter@^0.22.4`, so `npm install` fails
with ERESOLVE. This is not fixable with npm `overrides` because overrides in a
dependency's `package.json` are ignored by consumers - end users running
`npx repo-lens` would hit the same conflict on every install. WASM `.wasm`
files carry no peer dependencies and no native build, so install stays
portable and conflict-free.

## Consequences

- Grammar loading is a one-time async `Parser.init()` bootstrap; the
  deterministic core is otherwise unchanged.
- The committed `.wasm` grammar files are a documented exception to the "no
  generated files" rule, refreshed by a pinned build/download step.
- Ticket 01 spike pins the exact grammar versions and the vendoring path, and
  confirms the parser round-trips a fixture before any resolver work proceeds.
- `grammars/` must be added to `package.json` `files` when the files land.
