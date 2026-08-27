/**
 * Python resolver: turns `import` and `from ... import` statements into
 * import references, ties each source file to the vendored Python grammar,
 * resolves references to module ids through the package module map, and
 * flags entry scripts carrying a top-level `__name__ == "__main__"` guard.
 *
 * Resolution rules are deliberately simple and statement-shaped:
 * - `import a.b` resolves to `a/b.py` or `a/b/__init__.py`; anything not in
 *   the module map (stdlib, third-party, broken paths) resolves to null.
 * - `from a.b import x` resolves to the from-module `a.b`, never the bound
 *   name `x` - the statement's dependency is the module whose namespace is
 *   consumed.
 * - `from . import x` (pure-relative) is the one exception: the bound name
 *   IS the submodule being imported, so it resolves to `x.py` under the
 *   current package directory (the grammar gives the same shape as
 *   `from .x import`, so both are encoded identically during extraction).
 * - Relative specifiers walk up one package level per leading dot.
 */
import type { Node } from "web-tree-sitter";
import { dirname, join } from "node:path/posix";
import type {
  ImportReference,
  LanguageResolver,
} from "../resolver-registry.js";

const EXTENSIONS = [".py"] as const;
const GRAMMAR_FILE = "tree-sitter-python.wasm";
/** The identifier and value a top-level guard must compare to be an entry script. */
const MAIN_GUARD_NAME = "__name__";
const MAIN_GUARD_VALUE = "__main__";

/** Strips surrounding quotes from a string literal, or null when malformed. */
function stringContent(node: Node): string | null {
  const raw = node.text;
  if (raw.length < 2) {
    return null;
  }
  const quote = raw[0];
  if ((quote === '"' || quote === "'") && raw.endsWith(quote)) {
    return raw.slice(1, -1);
  }
  return null;
}

/**
 * Extracts the from-module specifier of an `import_from_statement`: its
 * first named child is the `relative_import` (e.g. ".utils") or `dotted_name`
 * (e.g. "package.math") naming the module whose namespace is consumed.
 */
function fromModuleSpecifier(node: Node): string | null {
  const first = node.namedChildren[0];
  if (first === undefined) {
    return null;
  }
  if (first.type === "relative_import" || first.type === "dotted_name") {
    return first.text;
  }
  return null;
}

/** The names bound by a from-import, used only for pure-relative imports. */
function importedNames(node: Node): string[] {
  return node.namedChildren
    .slice(1)
    .map((child) => {
      if (child.type === "dotted_name") {
        return child.text;
      }
      // An aliased_import like `x as y` still binds the original name `x`.
      if (child.type === "aliased_import") {
        return child.namedChildren[0]?.text ?? null;
      }
      return null;
    })
    .filter((name): name is string => name !== null);
}

/**
 * Builds the reference(s) for an `import_from_statement`. A pure-relative
 * statement (`from . import x`) emits one reference per bound name, encoded
 * as the dotted specifier the name would have (`from .x import`), so both
 * shapes resolve identically.
 */
function fromImportReference(node: Node): ImportReference[] {
  const source = fromModuleSpecifier(node);
  if (source === null) {
    return [];
  }
  const leadingDots = source.match(/^\.+/)?.[0] ?? "";
  if (source === leadingDots) {
    return importedNames(node).map((name) => ({
      specifier: `${leadingDots}${name}`,
      kind: "import-from",
    }));
  }
  return [{ specifier: source, kind: "import-from" }];
}

/**
 * Walks the tree collecting import references. `import` statements yield one
 * reference per dotted module path; `from ... import` statements yield the
 * from-module reference via the statement-specific extractor above.
 */
function extractImports(root: Node): ImportReference[] {
  const references: ImportReference[] = [];
  const visit = (node: Node): void => {
    if (node.type === "import_statement") {
      for (const dotted of node.descendantsOfType("dotted_name")) {
        references.push({ specifier: dotted.text, kind: "import" });
      }
    } else if (node.type === "import_from_statement") {
      references.push(...fromImportReference(node));
    }
    for (const child of node.namedChildren) {
      visit(child);
    }
  };
  visit(root);
  return references;
}

/** Maps a dotted module path to a module id, or null when it is not local. */
function resolveDottedModule(
  dotted: string,
  modulePaths: ReadonlySet<string>
): string | null {
  return findModuleFile(dotted.split(".").join("/"), modulePaths);
}

/**
 * Maps a relative from-import specifier to a module id. The first leading
 * dot selects the importing file's package directory; each further dot walks
 * one package level up. Escaping the repo root resolves to null.
 */
function resolveRelativeModule(
  specifier: string,
  fromModule: string,
  modulePaths: ReadonlySet<string>
): string | null {
  const leadingDots = specifier.match(/^\.+/)?.[0] ?? "";
  const rest = specifier.slice(leadingDots.length);
  let packageDir = dirname(fromModule);
  for (let extra = 1; extra < leadingDots.length; extra++) {
    packageDir = dirname(packageDir);
    if (packageDir === ".") {
      return null;
    }
  }
  if (rest === "") {
    const init = join(packageDir, "__init__.py");
    return modulePaths.has(init) ? init : null;
  }
  return findModuleFile(
    join(packageDir, rest.split(".").join("/")),
    modulePaths
  );
}

/** Tries the package file first, then the module file, matching CPython. */
function findModuleFile(
  relativePath: string,
  modulePaths: ReadonlySet<string>
): string | null {
  for (const candidate of [
    `${relativePath}/__init__.py`,
    `${relativePath}.py`,
  ]) {
    if (modulePaths.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** True when an `if` node's condition compares `__name__` to `"__main__"`. */
function isMainGuard(node: Node): boolean {
  const condition = node.childForFieldName("condition");
  if (condition === null) {
    return false;
  }
  const hasGuardName = condition
    .descendantsOfType("identifier")
    .some((identifier) => identifier.text === MAIN_GUARD_NAME);
  const hasGuardValue = condition
    .descendantsOfType("string")
    .some((stringNode) => stringContent(stringNode) === MAIN_GUARD_VALUE);
  return hasGuardName && hasGuardValue;
}

/**
 * True when the module is a Python entry script: a top-level
 * `if __name__ == "__main__"` guard, the canonical "runnable directly" idiom.
 */
function isEntryScript(root: Node): boolean {
  return root.namedChildren.some(
    (node) => node.type === "if_statement" && isMainGuard(node)
  );
}

export const PYTHON_RESOLVER: LanguageResolver = {
  languageFor(): string {
    return "python";
  },
  extensions: EXTENSIONS,
  grammarFileFor(): string {
    return GRAMMAR_FILE;
  },
  extractImports,
  resolveImport(reference, fromModule, modulePaths): string | null {
    if (reference.kind === "import") {
      return resolveDottedModule(reference.specifier, modulePaths);
    }
    return reference.specifier.startsWith(".")
      ? resolveRelativeModule(reference.specifier, fromModule, modulePaths)
      : resolveDottedModule(reference.specifier, modulePaths);
  },
  isEntryScript,
};
