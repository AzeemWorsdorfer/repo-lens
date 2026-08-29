/**
 * Go resolver: turns import declarations into import references, ties each
 * source file to the vendored Go grammar, resolves imports to module ids
 * through the package module map, and owns Go entrypoint detection: files
 * that declare `package main` and define the top-level `func main()`.
 *
 * Resolution rules are deliberately simple and path-shaped:
 * - An import is local iff it equals the module path declared in the scan
 *   root's go.mod, or starts with that path plus a slash. Stdlib and
 *   third-party imports ("fmt", "github.com/...") resolve to null.
 * - Because imports name packages (directories) while modules are files, a
 *   local import resolves to the lexicographically smallest non-test `.go`
 *   file in the target directory - a deterministic stand-in for the package.
 *   Test files (`_test.go`) are deliberately never import targets, though
 *   they still appear as modules in the report.
 * - Single-module repos only in v1: go.mod is read at the scan root. A
 *   missing or malformed go.mod safely degrades to no local edges.
 */
import type { Node } from "web-tree-sitter";
import { basename, dirname, join } from "node:path/posix";
import { readFileSync } from "node:fs";
import type {
  ImportReference,
  LanguageResolver,
  ResolveContext,
} from "../resolver-registry.js";
import { stringLiteralContent } from "./string-literal.js";

const EXTENSIONS = [".go"] as const;
const GRAMMAR_FILE = "tree-sitter-go.wasm";
/** The package whose imperative entrypoint is `func main()`. */
const MAIN_PACKAGE = "main";
/** The top-level function that starts a Go program. */
const MAIN_FUNCTION = "main";
/** The suffix naming a Go test file, excluded from import targets. */
const TEST_FILE_SUFFIX = "_test.go";

/** Tree-sitter node types for the Go constructs the resolver matches. */
const IMPORT_SPEC = "import_spec";
const PACKAGE_CLAUSE = "package_clause";
const PACKAGE_IDENTIFIER = "package_identifier";
const FUNCTION_DECLARATION = "function_declaration";

/** go.mod module paths already read, keyed by the absolute scan root. */
const modulePathCache = new Map<string, string | null>();

/** Extracts one import reference per import_spec from the file's language. */
function extractImports(root: Node): ImportReference[] {
  const references: ImportReference[] = [];
  for (const spec of root.descendantsOfType(IMPORT_SPEC)) {
    const path = spec.childForFieldName("path");
    const specifier = path === null ? null : stringLiteralContent(path);
    if (specifier !== null) {
      references.push({ specifier, kind: "import" });
    }
  }
  return references;
}

/**
 * Reads the module path declared by the scan root's go.mod. Returns null
 * when the file is absent or declares no single-line module directive.
 * Results are cached per root so a multi-file scan reads go.mod once.
 */
function modulePathFor(context: ResolveContext): string | null {
  const cached = modulePathCache.get(context.root);
  if (cached !== undefined) {
    return cached;
  }
  let content: string;
  try {
    content = readFileSync(join(context.root, "go.mod"), "utf8");
  } catch {
    modulePathCache.set(context.root, null);
    return null;
  }
  const modulePath = content.match(/^module\s+(\S+)/m)?.[1] ?? null;
  modulePathCache.set(context.root, modulePath);
  return modulePath;
}

/**
 * True when an import path belongs to the scanned module: it is the go.mod
 * module path, possibly with sub-package segments appended.
 */
function isLocalImport(specifier: string, modulePath: string): boolean {
  return specifier === modulePath || specifier.startsWith(`${modulePath}/`);
}

/**
 * Maps a local import path to a module id: the lexicographically smallest
 * non-test `.go` file in the package directory, or null when the package has
 * no such file (e.g. only test files or an empty directory).
 */
function resolvePackageModule(
  packageDir: string,
  modulePaths: ReadonlySet<string>
): string | null {
  const candidates = [...modulePaths]
    .filter(
      (path) =>
        dirname(path) === packageDir &&
        !basename(path).endsWith(TEST_FILE_SUFFIX)
    )
    .sort();
  return candidates[0] ?? null;
}

/**
 * True when a file both declares `package main` and defines the top-level
 * `func main()`: the canonical shape of a Go entrypoint. Methods and
 * `TestMain` (a plain TestMain function in test files) never match.
 */
function isEntryScript(root: Node): boolean {
  const declaresMainPackage = root.namedChildren.some((node) => {
    if (node.type !== PACKAGE_CLAUSE) {
      return false;
    }
    const name = node.namedChildren[0];
    return (
      name !== undefined &&
      name.type === PACKAGE_IDENTIFIER &&
      name.text === MAIN_PACKAGE
    );
  });
  const definesMainFunction = root.namedChildren.some((node) => {
    if (node.type !== FUNCTION_DECLARATION) {
      return false;
    }
    return node.childForFieldName("name")?.text === MAIN_FUNCTION;
  });
  return declaresMainPackage && definesMainFunction;
}

export const GO_RESOLVER: LanguageResolver = {
  languageFor(): string {
    return "go";
  },
  extensions: EXTENSIONS,
  grammarFileFor(): string {
    return GRAMMAR_FILE;
  },
  extractImports,
  resolveImport(reference, fromModule, modulePaths, context): string | null {
    const modulePath = context === undefined ? null : modulePathFor(context);
    if (
      modulePath === null ||
      !isLocalImport(reference.specifier, modulePath)
    ) {
      return null;
    }
    const packageDir =
      reference.specifier === modulePath
        ? ""
        : reference.specifier.slice(modulePath.length + 1);
    return resolvePackageModule(packageDir, modulePaths);
  },
  isEntryScript,
};
