# 14 — Content-first home + contextual disclosure

**What to build:** The discoverability surface of the AXI CLI: a content-first no-argument home view, `help[]` next-step lines after every output, and consistent per-subcommand `--help` (AXI principles 8, 9, 10).

**Blocked by:** 13 — Query subcommands + --report

**Status:** ready-for-agent

- [ ] `repo-lens` with no arguments shows live repo state, not help text: executable path (home-directory prefix rendered as `~`), one-line description, aggregate counts, entrypoints, top-complexity modules, top cycle clusters - sourced from a default scan of `.` or a `--report` file
- [ ] Every command's output ends with `help[]` lines suggesting concrete next commands with placeholder values, e.g. ``Run `repo-lens graph --deps-of <id>` ``
- [ ] Every subcommand has a concise `--help`; `repo-lens --help` lists subcommands with one-line descriptions
- [ ] Home view and help output are deterministic and TOON-rendered
- [ ] Seam tests assert home-view content, `help[]` presence on representative commands, and per-subcommand `--help`
