/**
 * TypeScript/JavaScript resolver: turns ES import statements and CommonJS
 * require() calls into import references, ties each source file to the right
 * vendored grammar, and resolves references to module ids via the shared
 * registry helper.
 */
import type { Node } from "web-tree-sitter";
import {
  resolveModuleReference,
  type ImportReference,
  type LanguageResolver,
} from "../resolver-registry.js";
import { stringLiteralContent } from "./string-literal.js";

const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;

/** Extracts the source specifier from an `import` statement. */
function importSpecifier(node: Node): string | null {
  const source = node.childForFieldName("source");
  return source === null ? null : stringLiteralContent(source);
}

/** Extracts the argument specifier from a `require("...")` call expression. */
function requireSpecifier(node: Node): string | null {
  const callee = node.childForFieldName("function");
  if (
    callee === null ||
    callee.type !== "identifier" ||
    callee.text !== "require"
  ) {
    return null;
  }
  const args = node.childForFieldName("arguments");
  if (args === null) {
    return null;
  }
  const first = args.namedChildren[0];
  return first === undefined ? null : stringLiteralContent(first);
}

/**
 * Walks the tree collecting import references. Both `import_statement` nodes
 * and `require()` call expressions are matched by calling the per-type
 * extractor on every named descendant.
 */
function extractImports(root: Node): ImportReference[] {
  const references: ImportReference[] = [];
  const visit = (node: Node): void => {
    if (node.type === "import_statement") {
      const specifier = importSpecifier(node);
      if (specifier !== null) {
        references.push({ specifier, kind: "import" });
      }
    } else if (node.type === "call_expression") {
      const specifier = requireSpecifier(node);
      if (specifier !== null) {
        references.push({ specifier, kind: "require" });
      }
    }
    for (const child of node.namedChildren) {
      visit(child);
    }
  };
  visit(root);
  return references;
}

export const TYPE_SCRIPT_RESOLVER: LanguageResolver = {
  /** .js-family files are JavaScript, everything else is TypeScript. */
  languageFor(path: string): string {
    return path.endsWith(".js") ||
      path.endsWith(".jsx") ||
      path.endsWith(".mjs") ||
      path.endsWith(".cjs")
      ? "javascript"
      : "typescript";
  },
  extensions: EXTENSIONS,
  grammarFileFor(path: string): string {
    if (path.endsWith(".tsx")) {
      return "tree-sitter-tsx.wasm";
    }
    if (path.endsWith(".ts")) {
      return "tree-sitter-typescript.wasm";
    }
    return "tree-sitter-javascript.wasm";
  },
  extractImports,
  resolveImport(reference, fromModule, modulePaths): string | null {
    return resolveModuleReference(
      reference.specifier,
      fromModule,
      modulePaths,
      EXTENSIONS
    );
  },
};
