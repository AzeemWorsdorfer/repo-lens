# rust-fixture

A small Rust crate used as ground truth for the Rust resolver tests: `mod`
declarations (file and inline, `mod.rs` and `x.rs` layouts, including a
nested inline module), `use` references to `crate::`, `self::`, and
`super::` paths resolved through the module tree, brace-list uses expanded
per leaf, an `#[path = "..."]` attribute remap, an aliased `use`, std and
third-party references excluded as externals, `main.rs` as the crate-root
entrypoint, a library root that is not an entrypoint, a helper file without
`fn main` that must not be flagged, and a `.gitignore`d scratch file that
must not appear.

Ground truth per file:

- `src/main.rs` - the crate root and only entrypoint. Declares `mod
alias;`, `mod cli;`, the inline `mod nested { pub mod leaf; }` (mapping
  `nested/leaf.rs`), and `mod service;` (mapping `service/mod.rs`). The
  inline leaf's `mod reader;` maps under `nested/leaf/`. Uses both via `mod`.
  Complexity 3 (one `if`, one `&&`).
- `src/cli.rs` - file module `cli`. Uses `super::MAIN_MESSAGE` (the crate
  root, `main.rs`). Complexity 1.
- `src/nested/leaf.rs` - file module `nested::leaf` (the `nested.rs` file is
  deliberately absent; the directory convention alone must not invent a
  module). Declares `mod reader;` under `nested/leaf/` and uses it via
  `self::reader` (both spell one deduped edge), and `super::super::cli`
  (resolves to `cli.rs`), plus `std::collections::HashMap` (external).
  Complexity 2 (one `if`).
- `src/nested/leaf/reader.rs` - file module `nested::leaf::reader`,
  referenced via `mod reader;`/`self::reader` from `leaf.rs` and via the
  brace leaf `nested::leaf::reader as r` from `no_main.rs`. Uses
  `std::collections::HashMap` (external). Complexity 1.
- `src/lib.rs` - the library root: declares `mod renamed;` remapped by
  `#[path = "extra/under_a_different_name.rs"]`, and `#[cfg(test)] mod tests`
  (inline, body uses are not top-level). Not an entrypoint. Complexity 1.
- `src/extra/under_a_different_name.rs` - the `#[path]`-remapped module
  `renamed`. Uses `crate::cli` and `serde_json::Value` (external).
  Complexity 1.
- `src/alias.rs` - a file module declared with `mod alias;` in `main.rs`,
  and itself declaring an unlinked `mod orphan;` whose file does not exist
  (no edge, no module). Uses `tracing::info` (external). Complexity 1.
- `src/no_main.rs` - helper functions but no `fn main`; proves a
  crate-root-adjacent file is not an entrypoint by itself. Uses the
  brace-list `use crate::{service::auth, nested::leaf::reader as r};`
  (one edge per leaf, alias keeping its target) and `crate::cli as c`.
  Complexity 5 (one `if`, two `match_arm`s, one `&&`).
- `src/service/mod.rs` - the `service` module root (the `x/mod.rs`
  layout). Declares `mod auth;` and reads it via `auth::tag()`.
  Complexity 1.
- `src/service/auth.rs` - file module `service::auth`. Uses
  `super::SERVICE_TAG` (the `service` module, `service/mod.rs`).
  Complexity 1.

Edges (all kind `import`, source -> target):

- `src/cli.rs` -> `src/main.rs` (via `super::MAIN_MESSAGE`)
- `src/extra/under_a_different_name.rs` -> `src/cli.rs` (via `crate::cli`)
- `src/lib.rs` -> `src/extra/under_a_different_name.rs` (via `mod renamed;`
  with `#[path]`)
- `src/main.rs` -> `src/alias.rs` (via `mod alias;`)
- `src/main.rs` -> `src/cli.rs` (via `mod cli;`)
- `src/main.rs` -> `src/service/mod.rs` (via `mod service;`)
- `src/main.rs` -> `src/nested/leaf.rs` (via the inline module declaration)
- `src/nested/leaf.rs` -> `src/cli.rs` (via `super::super::cli`)
- `src/nested/leaf.rs` -> `src/nested/leaf/reader.rs` (via `mod reader;`
  and `self::reader`, deduped to one edge)
- `src/no_main.rs` -> `src/cli.rs` (via `crate::cli as c`)
- `src/no_main.rs` -> `src/nested/leaf/reader.rs` (via the aliased brace leaf)
- `src/no_main.rs` -> `src/service/auth.rs` (via the brace leaf)
- `src/service/auth.rs` -> `src/service/mod.rs` (via `super::SERVICE_TAG`)
- `src/service/mod.rs` -> `src/service/auth.rs` (via `mod auth;`)

`use std::collections::HashMap`, `use serde_json::Value`, and
`use tracing::info` resolve to no module: they are external.

Cycles: the mutual `main.rs`/`cli.rs` dependency and the mutual
`service/mod.rs`/`service/auth.rs` dependency are each reported as one
Tarjan cycle.
