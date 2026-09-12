/**
 * Black-box tests for ticket 05 (Rust resolver): they spawn the built CLI as
 * a subprocess over the Rust fixture and assert on the public JSON report
 * contract - modules, edges, entrypoints, metrics, and determinism.
 * They never import internal core modules.
 */
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { scan, scanReport } from "./helpers.js";

const RUST = fileURLToPath(new URL("./fixtures/rust", import.meta.url));

describe("repo-lens rust resolver", () => {
  it("discovers Rust source files and reports them as modules", () => {
    const report = scanReport(RUST);
    expect(report.meta.languages).toEqual([{ language: "rust", fileCount: 8 }]);
    expect(report.modules.map((module) => module.id)).toEqual([
      "src/alias.rs",
      "src/cli.rs",
      "src/extra/under_a_different_name.rs",
      "src/lib.rs",
      "src/main.rs",
      "src/nested/leaf.rs",
      "src/nested/reader.rs",
      "src/no_main.rs",
    ]);
  });

  it("resolves mod and use references into module edges, excluding externals", () => {
    const report = scanReport(RUST);
    // std, serde_json, and tracing are external and must not become edges;
    // super::/self::/crate:: paths, `mod` declarations (including an
    // #[path]-remapped one), and an aliased use all resolve through the
    // module tree. The unlinked `mod orphan;` has no file and produces no
    // edge, and duplicated mod/use references dedupe to one edge.
    expect(report.edges).toEqual([
      {
        source: "src/cli.rs",
        target: "src/main.rs",
        kind: "import",
      },
      {
        source: "src/extra/under_a_different_name.rs",
        target: "src/cli.rs",
        kind: "import",
      },
      {
        source: "src/lib.rs",
        target: "src/extra/under_a_different_name.rs",
        kind: "import",
      },
      {
        source: "src/main.rs",
        target: "src/alias.rs",
        kind: "import",
      },
      {
        source: "src/main.rs",
        target: "src/cli.rs",
        kind: "import",
      },
      {
        source: "src/nested/leaf.rs",
        target: "src/cli.rs",
        kind: "import",
      },
      {
        source: "src/nested/leaf.rs",
        target: "src/nested/reader.rs",
        kind: "import",
      },
      {
        source: "src/no_main.rs",
        target: "src/cli.rs",
        kind: "import",
      },
    ]);
    expect(report.meta.counts).toMatchObject({
      modules: 8,
      edges: 8,
      cycles: 1,
    });
  });

  it("reports the main.rs/cli.rs mutual dependency as one cycle", () => {
    const report = scanReport(RUST);
    // main.rs declares `mod cli;` while cli.rs reads a crate-root const via
    // `use super::MAIN_MESSAGE;`: a genuine two-module cycle that Tarjan
    // reports once, members sorted.
    expect(report.cycles).toEqual([["src/cli.rs", "src/main.rs"]]);
  });

  it("flags the crate root main.rs as the sole entrypoint", () => {
    const report = scanReport(RUST);
    // lib.rs is a library root and no_main.rs has helper functions only:
    // neither starts a binary, so only main.rs is flagged.
    expect(report.entrypoints).toEqual(["src/main.rs"]);
    expect(report.meta.counts.entrypoints).toBe(1);
  });

  it("counts Rust decision nodes in cyclomatic complexity", () => {
    const report = scanReport(RUST);
    // main.rs: one if_expression plus one && short-circuit.
    const main = report.modules.find((module) => module.id === "src/main.rs");
    expect(main?.complexity).toBe(3);
    expect(main?.deps).toEqual(["src/alias.rs", "src/cli.rs"]);
    // no_main.rs: one if_expression and two match_arms.
    const noMain = report.modules.find(
      (module) => module.id === "src/no_main.rs"
    );
    expect(noMain?.complexity).toBe(4);
    // cli.rs: no decision points, but three dependents.
    const cli = report.modules.find((module) => module.id === "src/cli.rs");
    expect(cli?.complexity).toBe(1);
    expect(cli?.dependents).toEqual([
      "src/extra/under_a_different_name.rs",
      "src/main.rs",
      "src/nested/leaf.rs",
      "src/no_main.rs",
    ]);
  });

  it("honors .gitignore for Rust files", () => {
    const report = scanReport(RUST);
    expect(report.modules.map((module) => module.id)).not.toContain(
      "scratch.rs"
    );
  });

  it("produces byte-identical output across runs for the Rust fixture", () => {
    const first = scan(RUST);
    const second = scan(RUST);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
