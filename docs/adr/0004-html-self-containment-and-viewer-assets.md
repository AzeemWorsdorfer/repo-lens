# ADR 0004 - HTML self-containment and viewer assets

Status: Accepted

## Context

The primary artifact is one self-contained, offline HTML file that "bundles"
Cytoscape.js and D3. The mechanism for bundling them was unspecified, and
`package.json` `files` only ships `dist`, `README.md`, and `LICENSE`.

## Decision

- Vendor the minified UMD builds of Cytoscape.js and D3 as committed assets
  under `src/viewer/vendor/`. At report-generation time the HTML writer reads
  and inlines them, guaranteeing zero network requests and no bundler in the
  critical path.
- When ticket 07 introduces those assets, add `src/viewer/vendor` to
  `package.json` `files` so the published package actually ships them.
- The LLM layer uses the built-in global `fetch` (Node 20+); no HTTP client
  dependency.
- The MCP server uses `@modelcontextprotocol/sdk`; it is pinned now and
  installed when ticket 10 starts (it is not needed by ticket 01).

## Consequences

- Committed vendor files are the documented exception to "no generated files"
  in commits; a small refresh script records how they are updated.
- Self-containment stays a build-time guarantee, not a runtime assumption.
