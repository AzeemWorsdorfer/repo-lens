# rust-fixture

A small Rust crate used as ground truth for the Rust resolver tests: `mod`
declarations (file and inline, including a nested inline module), `use`
references to `crate::`, `self::`, and `super::` paths resolved through the
module tree, an `#[path = "..."]` attribute remap, an aliased `use`, std and
third-party references excluded as externals, `main.rs` as the crate-root
entrypoint, a library root that is not an entrypoint, a helper file without
`fn main` that must not be flagged, and a `.gitignore`d scratch file that
must not appear.

Ground truth per file:

- `src/main.rs` - the crate root and only entrypoint. Declares `mod alias;`,
  `mod cli;`, and the inline `mod nested { pub mod leaf; }` (mapping
  `nested/leaf.rs`), uses both via `mod` and nothing external. Complexity 3
  (one `if`, one `&&`).
- `src/cli.rs` - file module `cli`. Uses `super::MAIN_MESSAGE` (the crate
  root, `main.rs`). Complexity 1.
- `src/nested/leaf.rs` - file module `nested::leaf` (the `nested.rs` file is
  deliberately absent; the directory convention alone must not invent a
  module). Declares `mod reader;` and uses it via `self::reader` (both spell
  one deduped edge), and `super::super::cli` (resolves to `cli.rs`), plus
  `std::collections::HashMap` (external). Complexity 1.
- `src/nested/reader.rs` - file module `nested::reader`, referenced via
  `mod reader;`/`self::reader` from `leaf.rs`. Uses `std::collections::HashMap`
  (external). Complexity 1.
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
  crate-root-adjacent file is not an entrypoint by itself. Uses
  `crate::cli as c` (an alias must not change the target). Complexity 4
  (one `if`, two `match_arm`s).

Edges (all kind `import`, source -> target):

- `src/cli.rs` -> `src/main.rs` (via `super::MAIN_MESSAGE`)
- `src/extra/under_a_different_name.rs` -> `src/cli.rs` (via `crate::cli`)
- `src/lib.rs` -> `src/extra/under_a_different_name.rs` (via `mod renamed;`
  with `#[path]`)
- `src/main.rs` -> `src/alias.rs` (via `mod alias;`)
- `src/main.rs` -> `src/cli.rs` (via `mod cli;`)
- `src/nested/leaf.rs` -> `src/cli.rs` (via `super::super::cli`)
- `src/nested/leaf.rs` -> `src/nested/reader.rs` (via `mod reader;` and
  `self::reader`, deduped to one edge)
- `src/no_main.rs` -> `src/cli.rs` (via `crate::cli as c`)

`use std::collections::HashMap`, `use serde_json::Value`, and
`use tracing::info` resolve to no module: they are external.
