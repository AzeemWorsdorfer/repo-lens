# ADR 0003 - Flow diagram schema

Status: Accepted

## Context

The spec lists `flows[]` as `(name, description, steps)` but never defines
what `steps` contains, so the Flows view (ticket 08) cannot render it
deterministically. The LLM pass must emit a shape the viewer can draw without
re-litigating.

## Decision

`flows[]` is a list of:

```
Flow = {
  id: string,            // stable, unique
  name: string,
  description: string,
  entrypoint: string,    // module id, must exist in modules[]
  steps: Step[]
}

Step = {
  id: string,            // unique within the flow
  label: string,
  description?: string,
  moduleIds: string[],   // modules involved in this step (may be empty)
  branches?: string[]    // step ids of alternative next steps (fork/join)
}
```

The LLM is instructed to emit this schema; the deterministic layer validates
and normalizes it (drops unknown fields, enforces unique ids, orders steps by
declaration) so the viewer never sees malformed flows.

## Consequences

- The Flows view renders steps top-to-bottom with fork/join at `branches`,
  and `moduleIds` as clickable links into the graph.
- "Flows absent" (no LLM / `--no-llm`) renders as the honest not-configured
  state, unchanged by this schema.
