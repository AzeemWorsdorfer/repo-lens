# go-fixture

A small Go module used as ground truth for the Go resolver tests: a main
package with `func main()`, a non-entry `package main` file, local package
imports resolved through the go.mod module path (`example.com/acme`), stdlib
and third-party imports excluded as externals, a test file that is a module
but never an import target, and hand-countable complexity constructs.

Ground truth per file:

- `main.go` - package main + `func main()`: the only entrypoint. Imports
  `fmt` (external) and the local `model` and `store` packages.
- `version.go` - package main without `func main()`: proves a package-main
  file is not an entrypoint by itself.
- `internal/model/model.go` - imports `fmt` (external) only; no edges out.
  Complexity 6 (two expression cases, one default case, one `&&`, one `if`).
- `internal/store/store.go` - imports `errors` and `github.com/google/uuid`
  (externals) and the local `model` package; complexity 1.
- `internal/store/helper.go` - same package as store.go and the canonical
  target for `example.com/acme/internal/store` imports (the smallest
  non-test file in the directory, alphabetically before store.go); imports
  the local `model` package; complexity 2 (one `for`).
- `internal/store/store_test.go` - a module that imports the local `store`
  package, but is never an import target; complexity 2 (one `if`).

Edges (all kind `import`): `main.go -> internal/model/model.go`,
`main.go -> internal/store/helper.go`,
`internal/store/helper.go -> internal/model/model.go`,
`internal/store/store.go -> internal/model/model.go`,
`internal/store/store_test.go -> internal/store/helper.go`.
