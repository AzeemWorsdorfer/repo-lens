# ADR 0002 - Deterministic metrics

Status: Accepted

## Context

The report contract promises per-module `size`, `complexity`, `centrality`,
and coupling drives two views (treemap, scatter). The spec left `complexity`
undefined, `coupling` absent from the contract, and `centrality` only loosely
described ("PageRank x complexity x size"). These must be exact and
deterministic because reports are fixture-tested and byte-stable.

## Decision

- **size** = source file size in bytes (already implied; pinned for clarity).
- **complexity** = cyclomatic complexity: 1 plus one for each decision point
  in the tree-sitter AST (if, for, while, do, case, catch, ternary, `&&`,
  `||`, `??`). Language-independent, explainable, and computed the same way
  across all resolvers.
- **coupling** = afferent + efferent coupling (number of dependents plus
  number of dependencies), stored explicitly as an integer in `modules[]`.
  Views read `coupling` rather than recomputing it from edges.
- **centrality** = PageRank on the directed module graph (damping 0.85, fixed
  100 iterations with a stable node ordering, ties broken by module id) times
  `complexity` times `size`, stored as a number. Its only consumer is budget
  ranking, so the raw product is sufficient; iteration count is pinned for
  determinism.

## Consequences

- `modules[]` gains `coupling` (see SPEC report contract).
- All metrics derive from the tree-sitter AST and the graph, never from the
  LLM pass, preserving the deterministic pass as the single source of truth.
