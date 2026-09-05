/**
 * Black-box tests for ticket 04 (Java resolver): they spawn the built CLI as
 * a subprocess over the Java fixture and assert on the public JSON report
 * contract - modules, edges, entrypoints, and determinism.
 * They never import internal core modules.
 */
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { scan, scanReport } from "./helpers.js";

const JAVA = fileURLToPath(new URL("./fixtures/java", import.meta.url));

describe("repo-lens Java resolver", () => {
  it("discovers Java source files and reports them as modules", () => {
    const report = scanReport(JAVA);
    expect(report.meta.languages).toEqual([{ language: "java", fileCount: 5 }]);
    expect(report.modules.map((module) => module.id)).toEqual([
      "src/main/java/com/example/app/Main.java",
      "src/main/java/com/example/model/Severity.java",
      "src/main/java/com/example/store/Store.java",
      "src/main/java/com/example/store/StoreHelper.java",
      "src/test/java/com/example/store/StoreTest.java",
    ]);
  });

  it("resolves local Java imports through package and class declarations", () => {
    const report = scanReport(JAVA);
    // java.util.List is external; local fully-qualified class imports map to
    // their declared source files, not to a guessed path.
    expect(report.edges).toEqual([
      {
        source: "src/main/java/com/example/app/Main.java",
        target: "src/main/java/com/example/model/Severity.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/app/Main.java",
        target: "src/main/java/com/example/store/Store.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/store/Store.java",
        target: "src/main/java/com/example/model/Severity.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/store/StoreHelper.java",
        target: "src/main/java/com/example/model/Severity.java",
        kind: "import",
      },
      {
        source: "src/test/java/com/example/store/StoreTest.java",
        target: "src/main/java/com/example/store/Store.java",
        kind: "import",
      },
    ]);
    expect(report.meta.counts).toMatchObject({
      modules: 5,
      edges: 5,
      cycles: 0,
    });
  });

  it("flags Java classes with a static void main method as entrypoints", () => {
    const report = scanReport(JAVA);
    expect(report.entrypoints).toEqual([
      "src/main/java/com/example/app/Main.java",
    ]);
    expect(report.meta.counts.entrypoints).toBe(1);
  });

  it("honors .gitignore for Java files", () => {
    const report = scanReport(JAVA);
    expect(report.modules.map((module) => module.id)).not.toContain(
      "scratch/Scratch.java"
    );
  });

  it("produces byte-identical output across runs for the Java fixture", () => {
    const first = scan(JAVA);
    const second = scan(JAVA);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
