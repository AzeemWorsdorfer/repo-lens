/**
 * Black-box tests for ticket 02 (python resolver): they spawn the built CLI
 * as a subprocess over the python fixture and assert on the public JSON
 * report contract - modules, edges, entrypoints, metrics, and determinism.
 * They never import internal core modules; the report type is type-only.
 */
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { scan, scanReport } from "./helpers.js";

const PYTHON = fileURLToPath(new URL("./fixtures/python", import.meta.url));

describe("repo-lens python resolver", () => {
  it("discovers python source files and reports them as modules", () => {
    const report = scanReport(PYTHON);
    expect(report.meta.languages).toEqual([
      { language: "python", fileCount: 10 },
    ]);
    expect(report.modules.map((module) => module.id)).toEqual([
      "__main__.py",
      "app.py",
      "src/__init__.py",
      "src/config.py",
      "src/core.py",
      "src/models.py",
      "src/utils.py",
      "src/web/__init__.py",
      "src/web/routing.py",
      "src/web/server.py",
    ]);
  });

  it("resolves import, from-import, and relative imports into edges, excluding externals", () => {
    const report = scanReport(PYTHON);
    // os and re are externals and must not become edges; absolute
    // from-imports resolve to the from-module (src/__init__.py, never the
    // bound name), while pure-relative from-imports resolve the submodule.
    expect(report.edges).toEqual([
      { source: "__main__.py", target: "app.py", kind: "import-from" },
      { source: "app.py", target: "src/core.py", kind: "import-from" },
      { source: "app.py", target: "src/web/server.py", kind: "import-from" },
      { source: "src/core.py", target: "src/config.py", kind: "import-from" },
      { source: "src/core.py", target: "src/models.py", kind: "import-from" },
      { source: "src/core.py", target: "src/utils.py", kind: "import" },
      { source: "src/models.py", target: "src/config.py", kind: "import-from" },
      {
        source: "src/web/server.py",
        target: "src/__init__.py",
        kind: "import-from",
      },
      {
        source: "src/web/server.py",
        target: "src/core.py",
        kind: "import-from",
      },
      {
        source: "src/web/server.py",
        target: "src/web/routing.py",
        kind: "import-from",
      },
    ]);
    expect(report.meta.counts).toMatchObject({
      modules: 10,
      edges: 10,
      cycles: 0,
    });
  });

  it("flags __main__.py files and main-guard scripts as entrypoints", () => {
    const report = scanReport(PYTHON);
    // Underscore sorts before letters, so the module entrypoint leads.
    expect(report.entrypoints).toEqual(["__main__.py", "app.py"]);
    expect(report.meta.counts.entrypoints).toBe(2);
  });

  it("honors .gitignore for python files", () => {
    const report = scanReport(PYTHON);
    expect(report.modules.map((module) => module.id)).not.toContain(
      "scratch.py"
    );
  });

  it("counts python decision nodes in cyclomatic complexity", () => {
    const report = scanReport(PYTHON);
    // models.py: one if_statement plus a boolean `and` plus an elif_clause.
    const models = report.modules.find(
      (module) => module.id === "src/models.py"
    );
    expect(models?.complexity).toBe(4);
    // core.py: a boolean `or` fallback plus one if_statement.
    const core = report.modules.find((module) => module.id === "src/core.py");
    expect(core?.complexity).toBe(3);
    // app.py: the entry guard plus one conditional_expression (ternary).
    const app = report.modules.find((module) => module.id === "app.py");
    expect(app?.complexity).toBe(3);
    // utils.py: the generator `if` is not a statement, so no decision points.
    const utils = report.modules.find((module) => module.id === "src/utils.py");
    expect(utils?.complexity).toBe(1);
    expect(utils?.coupling).toBe(1);
    expect(utils?.dependents).toEqual(["src/core.py"]);
  });

  it("produces byte-identical output across runs for the python fixture", () => {
    const first = scan(PYTHON);
    const second = scan(PYTHON);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
