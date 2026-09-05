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
    expect(report.meta.languages).toEqual([{ language: "java", fileCount: 10 }]);
    expect(report.modules.map((module) => module.id)).toEqual([
      "src/main/java/com/example/app/Main.java",
      "src/main/java/com/example/app/OuterUser.java",
      "src/main/java/com/example/app/SeverityPrinter.java",
      "src/main/java/com/example/model/Outer.java",
      "src/main/java/com/example/model/Severity.java",
      "src/main/java/com/example/store/Store.java",
      "src/main/java/com/example/store/StoreHelper.java",
      "src/main/java/com/example/uppercase/UpperCase.JAVA",
      "src/main/java/definitions/Level.java",
      "src/test/java/com/example/store/StoreTest.java",
    ]);
  });

  it("discovers uppercase Java extensions and resolves their declared type", () => {
    const report = scanReport(JAVA);
    expect(
      report.modules.find(
        (module) =>
          module.id === "src/main/java/com/example/uppercase/UpperCase.JAVA"
      )?.language
    ).toBe("java");
    expect(report.edges).toContainEqual({
      source: "src/main/java/com/example/app/SeverityPrinter.java",
      target: "src/main/java/com/example/uppercase/UpperCase.JAVA",
      kind: "import",
    });
  });

  it("resolves local Java imports through package and class declarations", () => {
    const report = scanReport(JAVA);
    // java.util.List is external; package wildcards and static imports map to
    // declared local types rather than to guessed path suffixes.
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
        source: "src/main/java/com/example/app/Main.java",
        target: "src/main/java/definitions/Level.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/app/OuterUser.java",
        target: "src/main/java/com/example/model/Outer.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/app/SeverityPrinter.java",
        target: "src/main/java/com/example/model/Severity.java",
        kind: "import",
      },
      {
        source: "src/main/java/com/example/app/SeverityPrinter.java",
        target: "src/main/java/com/example/uppercase/UpperCase.JAVA",
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
      modules: 10,
      edges: 9,
      cycles: 0,
    });
  });

  it("flags only canonical Java main methods as entrypoints", () => {
    const report = scanReport(JAVA);
    // Main's final varargs parameter is legal. Store also has an instance
    // main and a non-void main, neither of which can launch a Java program.
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
