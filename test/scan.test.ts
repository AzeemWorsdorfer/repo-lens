/**
 * Black-box tests for ticket 01 (tracer bullet): they spawn the built CLI as
 * a subprocess over fixture repos and assert on the public JSON report
 * contract. They never import internal core modules - the report type comes
 * from the package entrypoint and is type-only (erased at runtime).
 */
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { CLI, fileSize, scan, scanReport } from "./helpers.js";

const BASIC = fileURLToPath(new URL("./fixtures/basic", import.meta.url));
const CYCLE = fileURLToPath(new URL("./fixtures/cycle", import.meta.url));

describe("repo-lens scan --emit json", () => {
  it("scans a TypeScript/JavaScript fixture into a report matching the contract", () => {
    const report = scanReport(BASIC);
    expect(Object.keys(report).sort()).toEqual([
      "architecture",
      "cycles",
      "edges",
      "entrypoints",
      "flows",
      "meta",
      "modules",
    ]);
    expect(report.meta.repo).toBe("basic-fixture");
    expect(report.meta.counts).toEqual({
      modules: 4,
      edges: 4,
      cycles: 0,
      entrypoints: 1,
    });
    expect(report.meta.languages).toEqual([
      { language: "javascript", fileCount: 1 },
      { language: "typescript", fileCount: 3 },
    ]);
  });

  it("discovers tracked source files and honors .gitignore", () => {
    const report = scanReport(BASIC);
    const ids = report.modules.map((module) => module.id);
    expect(ids).toEqual([
      "src/helper.js",
      "src/index.ts",
      "src/math.ts",
      "src/utils.ts",
    ]);
    expect(ids).not.toContain("src/ignored.ts");
    expect(ids).not.toContain("node_modules/some-package/index.ts");
    expect(ids).not.toContain("README.md");
    expect(ids.every((id) => !id.startsWith("node_modules"))).toBe(true);
  });

  it("resolves TS/JS import and require statements into edges, excluding externals", () => {
    const report = scanReport(BASIC);
    // src/index.ts imports "node:fs", an external that must not become an edge.
    expect(report.edges).toEqual([
      { source: "src/helper.js", target: "src/math.ts", kind: "require" },
      { source: "src/index.ts", target: "src/math.ts", kind: "import" },
      { source: "src/index.ts", target: "src/utils.ts", kind: "import" },
      { source: "src/utils.ts", target: "src/math.ts", kind: "import" },
    ]);
    expect(report.edges.map((edge) => edge.kind)).toEqual([
      "require",
      "import",
      "import",
      "import",
    ]);
  });

  it("reports per-module size, complexity, coupling, and centrality", () => {
    const report = scanReport(BASIC);
    const utils = report.modules.find((module) => module.id === "src/utils.ts");
    expect(utils).toBeDefined();
    expect(utils?.size).toBe(fileSize("basic", "src/utils.ts"));
    expect(utils?.complexity).toBe(4);
    expect(utils?.coupling).toBe(2);
    expect(utils?.deps).toEqual(["src/math.ts"]);
    expect(utils?.dependents).toEqual(["src/index.ts"]);
    expect(utils && utils.centrality).toBeGreaterThan(0);

    const math = report.modules.find((module) => module.id === "src/math.ts");
    expect(math?.size).toBe(fileSize("basic", "src/math.ts"));
    expect(math?.complexity).toBe(1);
    expect(math?.coupling).toBe(3);
    expect(math?.dependents).toEqual([
      "src/helper.js",
      "src/index.ts",
      "src/utils.ts",
    ]);
    expect(math?.summary).toBeNull();
  });

  it("labels each module by its real language from the extension", () => {
    const report = scanReport(BASIC);
    const helper = report.modules.find(
      (module) => module.id === "src/helper.js"
    );
    expect(helper?.language).toBe("javascript");
    const index = report.modules.find((module) => module.id === "src/index.ts");
    expect(index?.language).toBe("typescript");
  });

  it("flags package.json entrypoint modules", () => {
    const report = scanReport(BASIC);
    expect(report.entrypoints).toEqual(["src/index.ts"]);
  });

  it("reports a cycle when modules depend on each other", () => {
    const report = scanReport(CYCLE);
    expect(report.cycles).toEqual([["src/a.ts", "src/b.ts"]]);
    expect(report.meta.counts.cycles).toBe(1);
    expect(report.entrypoints).toEqual(["src/index.ts"]);
    expect(report.edges).toHaveLength(3);
  });

  it("produces byte-identical output across runs for the same fixture", () => {
    const first = scan(BASIC);
    const second = scan(BASIC);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });

  it("fails loudly with an actionable message for an unimplemented emit format", () => {
    const result = spawnSync("node", [CLI, "scan", BASIC, "--emit", "html"], {
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--emit html is not implemented");
  });
});
