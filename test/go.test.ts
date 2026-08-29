/**
 * Black-box tests for ticket 03 (go resolver): they spawn the built CLI as
 * a subprocess over the go fixture and assert on the public JSON report
 * contract - modules, edges, entrypoints, metrics, and determinism. They
 * never import internal core modules; the report type is type-only.
 */
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { scan, scanReport } from "./helpers.js";

const GO = fileURLToPath(new URL("./fixtures/go", import.meta.url));

describe("repo-lens go resolver", () => {
  it("discovers go source files and reports them as modules", () => {
    const report = scanReport(GO);
    expect(report.meta.languages).toEqual([{ language: "go", fileCount: 6 }]);
    expect(report.modules.map((module) => module.id)).toEqual([
      "internal/model/model.go",
      "internal/store/helper.go",
      "internal/store/store.go",
      "internal/store/store_test.go",
      "main.go",
      "version.go",
    ]);
  });

  it("resolves local imports into edges, excluding stdlib and third-party imports", () => {
    const report = scanReport(GO);
    // fmt, errors, testing, and github.com/google/uuid are externals and
    // must not become edges; local packages resolve through the go.mod
    // module path, and a package import targets the smallest non-test file
    // in its directory (internal/store/helper.go, not store.go).
    expect(report.edges).toEqual([
      {
        source: "internal/store/helper.go",
        target: "internal/model/model.go",
        kind: "import",
      },
      {
        source: "internal/store/store_test.go",
        target: "internal/store/helper.go",
        kind: "import",
      },
      {
        source: "internal/store/store.go",
        target: "internal/model/model.go",
        kind: "import",
      },
      {
        source: "main.go",
        target: "internal/model/model.go",
        kind: "import",
      },
      {
        source: "main.go",
        target: "internal/store/helper.go",
        kind: "import",
      },
    ]);
    expect(report.meta.counts).toMatchObject({
      modules: 6,
      edges: 5,
      cycles: 0,
    });
  });

  it("flags package main files with func main as the sole entrypoint", () => {
    const report = scanReport(GO);
    // version.go also declares package main, but without func main() it is
    // not a program start and must not be flagged.
    expect(report.entrypoints).toEqual(["main.go"]);
    expect(report.meta.counts.entrypoints).toBe(1);
  });

  it("honors .gitignore for go files", () => {
    const report = scanReport(GO);
    expect(report.modules.map((module) => module.id)).not.toContain(
      "scratch.go"
    );
  });

  it("counts go decision nodes in cyclomatic complexity", () => {
    const report = scanReport(GO);
    // model.go: two expression cases, one default case, one boolean `and`,
    // and one if_statement.
    const model = report.modules.find(
      (module) => module.id === "internal/model/model.go"
    );
    expect(model?.complexity).toBe(6);
    expect(model?.dependents).toEqual([
      "internal/store/helper.go",
      "internal/store/store.go",
      "main.go",
    ]);
    // helper.go: one for_statement (range loop).
    const helper = report.modules.find(
      (module) => module.id === "internal/store/helper.go"
    );
    expect(helper?.complexity).toBe(2);
    expect(helper?.deps).toEqual(["internal/model/model.go"]);
    expect(helper?.coupling).toBe(3);
    // store.go: no decision points.
    const store = report.modules.find(
      (module) => module.id === "internal/store/store.go"
    );
    expect(store?.complexity).toBe(1);
    // store_test.go: the test's if_statement adds one decision point.
    const storeTest = report.modules.find(
      (module) => module.id === "internal/store/store_test.go"
    );
    expect(storeTest?.complexity).toBe(2);
  });

  it("produces byte-identical output across runs for the go fixture", () => {
    const first = scan(GO);
    const second = scan(GO);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
