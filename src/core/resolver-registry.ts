/**
 * The resolver registry is the single extension point for new languages: a
 * language arrives as a LanguageResolver module registered here, and no core
 * control flow is edited. The registry also owns cross-language helpers such
 * as entrypoint resolution that need to know every supported extension.
 */
import { dirname, join, normalize } from "node:path/posix";
import { TYPE_SCRIPT_RESOLVER } from "./resolvers/typescript-resolver.js";
import { PYTHON_RESOLVER } from "./resolvers/python-resolver.js";
import { GO_RESOLVER } from "./resolvers/go-resolver.js";
import { JAVA_RESOLVER } from "./resolvers/java-resolver.js";
import { RUST_RESOLVER } from "./resolvers/rust-resolver.js";
import type { Node } from "web-tree-sitter";

/** How an import/require reference was written, used as the edge kind. */
export type ImportKind = "import" | "require" | "import-from";

/**
 * Per-scan context handed to resolvers when a language needs repo-level
 * metadata that the module map cannot express, such as go.mod for Go's
 * module path. Absent for languages that resolve purely from the AST.
 */
export interface ResolveContext {
  /** Absolute path of the scan root, e.g. for locating go.mod. */
  readonly root: string;
  /** Compact language-specific metadata keyed by repository-relative module id. */
  readonly moduleMetadata: ReadonlyMap<string, unknown>;
}

/** A raw import/require reference extracted from the AST of a source file. */
export interface ImportReference {
  /** The module specifier as written, e.g. "./utils" or "lodash". */
  readonly specifier: string;
  readonly kind: ImportKind;
  /** Virtual module scope relative to the source file, when applicable. */
  readonly moduleScope?: string;
  /** True for language forms whose member resolution differs from packages. */
  readonly isStatic?: boolean;
}

/**
 * One or more local module ids resolved from a single import declaration;
 * null means the reference is external or cannot be resolved.
 */
export type ResolvedImport = string | readonly string[] | null;

/**
 * A per-language translator: it parses imports out of an AST and resolves
 * them to module ids. Implementing this interface is the whole job of adding
 * a language.
 */
export interface LanguageResolver {
  /** Domain name reported in modules[], e.g. "typescript". */
  languageFor(path: string): string;
  /** File extensions this resolver owns, including the leading dot. */
  readonly extensions: readonly string[];
  /** Names the vendored grammar file suited to a given path. */
  grammarFileFor(path: string): string;
  /** Extracts import/require references from a parsed root node. */
  extractImports(root: Node): readonly ImportReference[];
  /**
   * Resolves a reference to one or more module ids, or null for
   * externals/unresolvable references. `context` is provided by the scan when
   * a resolver needs the scan root or compact module metadata (e.g. Java or Go);
   * resolvers that do not need it omit the param.
   */
  resolveImport(
    reference: ImportReference,
    fromModule: string,
    modulePaths: ReadonlySet<string>,
    context?: ResolveContext
  ): ResolvedImport;
  /**
   * Returns compact metadata needed to resolve this language's imports, or
   * undefined when its resolver can work from the reference and module paths.
   */
  moduleMetadataFor?(root: Node): unknown;
  /**
   * True when a parsed module is an entry script for its ecosystem (e.g. a
   * Python `__name__ == "__main__"` guard). Absent for languages whose
   * entrypoints are found by metadata only.
   */
  isEntryScript?(root: Node): boolean;
  /**
   * True when a module path is an entrypoint for its ecosystem without
   * needing a parse (e.g. Python's `__main__.py`). Absent for languages
   * whose entrypoints are found by metadata or AST only.
   */
  isEntrypointPath?(path: string): boolean;
}

/** The ordered set of resolvers, newest languages appended here. */
export const RESOLVERS: readonly LanguageResolver[] = [
  TYPE_SCRIPT_RESOLVER,
  PYTHON_RESOLVER,
  GO_RESOLVER,
  JAVA_RESOLVER,
  RUST_RESOLVER,
];

/** Every extension across all resolvers, sorted, for cross-language lookups. */
export const ALL_EXTENSIONS: readonly string[] = [
  ...new Set(RESOLVERS.flatMap((resolver) => resolver.extensions)),
].sort();

/** Returns the resolver owning `path`, or null when no language is registered for it. */
export function getResolverForPath(path: string): LanguageResolver | null {
  const extension = getExtension(path);
  if (extension === null) {
    return null;
  }
  return (
    RESOLVERS.find((resolver) => resolver.extensions.includes(extension)) ??
    null
  );
}

/**
 * Resolves a bare-relative module reference the way a resolver would:
 * tries the exact path, then each extension, then each `/index.<ext>`.
 * Non-relative specifiers (bare names, node: builtins) resolve to null, and
 * modulePaths membership decides whether a relative specifier is internal.
 */
export function resolveModuleReference(
  specifier: string,
  fromModule: string,
  modulePaths: ReadonlySet<string>,
  extensions: readonly string[]
): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null;
  }
  const clean = specifier.split(/[?#]/, 1)[0] ?? "";
  const basePath = clean.startsWith("/")
    ? clean.slice(1)
    : normalize(join(dirname(fromModule), clean));
  if (basePath.startsWith("../")) {
    return null;
  }
  if (modulePaths.has(basePath)) {
    return basePath;
  }
  for (const extension of extensions) {
    if (modulePaths.has(basePath + extension)) {
      return basePath + extension;
    }
    if (modulePaths.has(joinPosix(basePath, `index${extension}`))) {
      return joinPosix(basePath, `index${extension}`);
    }
  }
  return null;
}

/**
 * Resolves a package.json entry target (main/module/bin/exports) to a module
 * id across every registered extension. Returns null when no module matches.
 */
export function resolveEntrypointModule(
  specifier: string,
  modulePaths: ReadonlySet<string>
): string | null {
  const clean = specifier.split(/[?#]/, 1)[0]?.replace(/^\.\//, "") ?? "";
  if (modulePaths.has(clean)) {
    return clean;
  }
  for (const extension of ALL_EXTENSIONS) {
    if (modulePaths.has(clean + extension)) {
      return clean + extension;
    }
    if (modulePaths.has(joinPosix(clean, `index${extension}`))) {
      return joinPosix(clean, `index${extension}`);
    }
  }
  return null;
}

/** Returns the lowercase extension including the dot, or null if none. */
function getExtension(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot <= 0 || path.lastIndexOf("/") > dot) {
    return null;
  }
  return path.slice(dot).toLowerCase();
}

/** Joins two posix relative paths while treating empty members cleanly. */
function joinPosix(left: string, right: string): string {
  if (left === "" && right !== "") {
    return right;
  }
  if (right === "") {
    return left;
  }
  return `${left}/${right}`;
}
