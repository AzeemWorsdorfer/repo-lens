/**
 * Rust resolver: turns `mod` and `use` declarations into import references,
 * ties each source file to the vendored Rust grammar, resolves crate-internal
 * paths to module ids through the module tree, and owns Rust entrypoint
 * detection: a file defining a top-level `fn main()`.
 *
 * The resolver builds the crate's module tree from `mod` declarations, not
 * from directory layout: `mod x;` maps to `x.rs` (or `x/mod.rs`) beside the
 * declaring file, inline `mod x { ... }` declares a virtual child whose
 * children live under `x/`, and `#[path = "..."]` remaps a file module
 * explicitly. A `mod` whose file is absent (or a virtual inline module)
 * still occupies a node in the tree so `crate::`/`super::`/`self::` paths
 * resolve through it, but virtual nodes carry no file and produce no edges.
 *
 * `use` references resolve through the same tree: `crate::` anchors at the
 * crate root (the scanned file no other file declares as a child), `self::`
 * and `super::` walk relative to the declaring module, unqualified paths try
 * the local module tree first, and unresolved leading segments stay external
 * (std, serde, ...).
 * Brace lists expand to one reference per leaf and aliases keep their
 * path's target; a path ending on an item rather than a module depends on
 * the module declaring that item.
 *
 * Deliberate v1 limits: one crate tree per scan, so multi-crate workspaces
 * resolve `crate::` against the discovered root only; `extern crate`
 * declarations are ignored (they name a crate, never a module file).
 */
import type { Node } from "web-tree-sitter";
import { basename, dirname, join } from "node:path/posix";
import type {
  ImportReference,
  LanguageResolver,
  ResolvedImport,
} from "../resolver-registry.js";

const EXTENSIONS = [".rs"] as const;
const GRAMMAR_FILE = "tree-sitter-rust.wasm";
const RUST_EXTENSION = ".rs";

/** Tree-sitter node types for the Rust constructs the resolver matches. */
const MOD_ITEM = "mod_item";
const USE_DECLARATION = "use_declaration";
const USE_LIST = "use_list";
const SCOPED_USE_LIST = "scoped_use_list";
const USE_AS_CLAUSE = "use_as_clause";
const USE_WILDCARD = "use_wildcard";
const FUNCTION_ITEM = "function_item";
const ATTRIBUTE_ITEM = "attribute_item";
const ATTRIBUTE = "attribute";

/** The `#[path]` attribute that remaps a file module's location. */
const PATH_ATTRIBUTE = "path";
/** The only function that starts a Rust binary. */
const MAIN_FUNCTION = "main";
/** Path keywords anchoring a use path inside the current crate. */
const CRATE_SEGMENT = "crate";
const SELF_SEGMENT = "self";
const SUPER_SEGMENT = "super";
/** The binary crate root outranks a library root when discovering the root. */
const BINARY_ROOT_FILE = "main.rs";
/** The library crate root, the secondary root-discovery candidate. */
const LIBRARY_ROOT_FILE = "lib.rs";

/**
 * One `mod` declaration with the file backing it, if any, and the virtual
 * module path of its enclosing inline mods (relative to the declaring
 * file's module), so inline children attach under their parent node.
 */
interface ModDeclaration {
  readonly name: string;
  /** Module id of the backing file, or null for an inline `mod x { }`. */
  readonly fileId: string | null;
  /** Whether the declaration supplied an explicit `#[path]` attribute. */
  readonly isPathAttribute: boolean;
  /** Enclosing inline mod path, e.g. "nested" for `mod nested { mod leaf; }`. */
  readonly inlinePath: string;
}

/** Compact metadata stored per file in the registry's context map. */
interface RustModuleMetadata {
  readonly mods: readonly ModDeclaration[];
}

/** A mod declaration paired with its resolved file target for tree assembly. */
interface ResolvedModDeclaration extends ModDeclaration {
  readonly resolvedFileId: string | null;
}

/** A node in the crate module tree: file-backed, or virtual when null. */
interface ModuleTreeNode {
  fileId: string | null;
  readonly children: Map<string, ModuleTreeNode>;
}

/** The assembled crate: its tree and the file id of the root module. */
interface CrateTree {
  readonly root: ModuleTreeNode;
  readonly rootFileId: string;
  /** Each file's virtual module path below the crate root. */
  readonly declaringModules: ReadonlyMap<string, string>;
}

/** Per-scan crate context cached on the registry's metadata map. */
interface CrateContext {
  readonly crate: CrateTree;
}

/** Crate trees cached per scan, keyed by the metadata map identity. */
const CRATE_CACHE = new WeakMap<ReadonlyMap<string, unknown>, CrateContext>();

/**
 * Extracts import references from source scopes: file-backed mods become
 * edges, inline mods are traversed for their children and uses, and each use
 * declaration expands to one reference per leaf of its brace-list tree.
 */
function extractImports(root: Node): ImportReference[] {
  return importsInScope(root, "");
}

/** Collects imports from one source scope and recursively visits inline mods. */
function importsInScope(scope: Node, moduleScope: string): ImportReference[] {
  const references: ImportReference[] = [];
  for (const declaration of scope.namedChildren) {
    if (declaration.type === MOD_ITEM) {
      const specifier = fileModSpecifier(declaration);
      if (specifier !== null) {
        references.push({ specifier, kind: "import", moduleScope });
      }
      const body = declaration.childForFieldName("body");
      if (body !== null) {
        references.push(
          ...importsInScope(
            body,
            joinInline(moduleScope, declarationName(declaration))
          )
        );
      }
    } else if (declaration.type === USE_DECLARATION) {
      const argument = declaration.childForFieldName("argument");
      if (argument !== null) {
        for (const leaf of useLeaves(argument, "")) {
          references.push({
            specifier: leaf,
            kind: "import",
            moduleScope,
          });
        }
      }
    }
  }
  return references;
}

/** Returns the name of an inline module for recursive import traversal. */
function declarationName(declaration: Node): string {
  return declaration.childForFieldName("name")?.text ?? "";
}

/**
 * Flattens a use argument into concrete path specifiers: brace lists expand
 * to every leaf (`a::{b, c::d}` yields `a::b` and `a::c::d`), an alias
 * resolves to its path part, a wildcard names its prefix module, and plain
 * paths pass through unchanged.
 */
function useLeaves(node: Node, prefix: string): string[] {
  if (node.type === USE_LIST) {
    return node.namedChildren.flatMap((child) => useLeaves(child, prefix));
  }
  if (node.type === SCOPED_USE_LIST) {
    const path = node.childForFieldName("path");
    const scopedPrefix = joinPath(prefix, path?.text ?? "");
    return node.namedChildren
      .filter((child) => child.id !== path?.id)
      .flatMap((child) => useLeaves(child, scopedPrefix));
  }
  if (node.type === USE_AS_CLAUSE) {
    return [joinPath(prefix, node.childForFieldName("path")?.text ?? "")];
  }
  if (node.type === USE_WILDCARD) {
    return [joinPath(prefix, node.text)];
  }
  return [joinPath(prefix, node.text)];
}

/** Joins a use-tree prefix with one segment, keeping empty prefixes out. */
function joinPath(prefix: string, segment: string): string {
  if (prefix === "") {
    return segment;
  }
  return segment === "" ? prefix : `${prefix}::${segment}`;
}

/** The specifier of a file-backed `mod x;`, or null for an inline mod. */
function fileModSpecifier(declaration: Node): string | null {
  return declaration.childForFieldName("body") === null
    ? (declaration.childForFieldName("name")?.text ?? null)
    : null;
}

/** Returns compact Rust mod declarations for the resolver context. */
function moduleMetadataFor(root: Node): RustModuleMetadata {
  return { mods: declaredMods(root) };
}

/**
 * Reads every `mod` declaration of a file with its backing file id, relative
 * to the enclosing module path: the `#[path = "..."]` attribute wins, then
 * `x.rs` beside the declaring file, then `x/mod.rs`. Inline mods get a null
 * file id but still name a node, and their bodies are scanned recursively
 * so `mod nested { pub mod leaf; }` maps `leaf` to `nested/leaf.rs`.
 */
function declaredMods(root: Node): ModDeclaration[] {
  return modsInScope(root, "");
}

/** Collects mod declarations within one scope at an inline-mod path. */
function modsInScope(scope: Node, inlinePath: string): ModDeclaration[] {
  const mods: ModDeclaration[] = [];
  for (const declaration of scope.namedChildren) {
    if (declaration.type !== MOD_ITEM) {
      continue;
    }
    const name = declaration.childForFieldName("name")?.text;
    if (name === undefined) {
      continue;
    }
    const body = declaration.childForFieldName("body");
    if (body !== null) {
      mods.push({
        name,
        fileId: null,
        isPathAttribute: false,
        inlinePath,
      });
      mods.push(...modsInScope(body, joinInline(inlinePath, name)));
      continue;
    }
    const pathAttribute = pathAttributeOf(declaration);
    mods.push({
      name,
      fileId: pathAttribute ?? `${name}${RUST_EXTENSION}`,
      isPathAttribute: pathAttribute !== null,
      inlinePath,
    });
  }
  return mods;
}

/** Joins an inline path with a child mod name using `/` separators. */
function joinInline(inlinePath: string, name: string): string {
  return inlinePath === "" ? name : `${inlinePath}/${name}`;
}

/** Returns the `#[path = "..."]` value preceding a mod, or null. */
function pathAttributeOf(declaration: Node): string | null {
  let sibling = declaration.previousNamedSibling;
  while (sibling !== null && sibling.type === ATTRIBUTE_ITEM) {
    const attribute = sibling.namedChildren.find(
      (child) => child.type === ATTRIBUTE
    );
    // The attribute node has no name field; its first child is the name.
    if (attribute?.namedChildren[0]?.text === PATH_ATTRIBUTE) {
      const value = attribute.childForFieldName("value");
      if (value !== null) {
        return normalizeAttributePath(stripStringQuotes(value.text));
      }
    }
    sibling = sibling.previousNamedSibling;
  }
  return null;
}

/** Normalizes an `#[path]` value to a repo-relative posix module id. */
function normalizeAttributePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Removes surrounding double quotes from an attribute string literal. */
function stripStringQuotes(text: string): string {
  return text.replace(/^"(.*)"$/s, "$1");
}

/**
 * Builds (and caches) the crate module tree for one scan. Only file-backed
 * nodes and explicitly declared mods enter the tree; directory structure
 * alone never invents modules.
 */
function crateFor(
  modulePaths: ReadonlySet<string>,
  moduleMetadata: ReadonlyMap<string, unknown> | undefined
): CrateContext | null {
  if (moduleMetadata === undefined) {
    return null;
  }
  const cached = CRATE_CACHE.get(moduleMetadata);
  if (cached !== undefined) {
    return cached;
  }
  const context = buildCrate(modulePaths, moduleMetadata);
  CRATE_CACHE.set(moduleMetadata, context);
  return context;
}

/** Validates compact metadata crossing the generic resolver context boundary. */
function isRustModuleMetadata(value: unknown): value is RustModuleMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // The registry intentionally stores language-specific metadata as unknown.
  const record = value as { mods?: unknown };
  if (!Array.isArray(record.mods)) {
    return false;
  }
  return record.mods.every(
    (mod) =>
      typeof mod === "object" &&
      mod !== null &&
      typeof (mod as ModDeclaration).name === "string" &&
      typeof (mod as ModDeclaration).inlinePath === "string" &&
      typeof (mod as ModDeclaration).isPathAttribute === "boolean" &&
      ((mod as ModDeclaration).fileId === null ||
        typeof (mod as ModDeclaration).fileId === "string")
  );
}

/** Parses metadata for every Rust file and links the declarations. */
function buildCrate(
  modulePaths: ReadonlySet<string>,
  moduleMetadata: ReadonlyMap<string, unknown>
): CrateContext {
  const rustPaths = [...modulePaths]
    .filter((path) => path.endsWith(RUST_EXTENSION))
    .sort();

  const modsByFile = new Map<string, readonly ModDeclaration[]>();
  for (const path of rustPaths) {
    const metadata = moduleMetadata.get(path);
    if (isRustModuleMetadata(metadata)) {
      modsByFile.set(path, metadata.mods);
    }
  }

  const rootIndependentModsByFile = resolveModDeclarations(
    modulePaths,
    modsByFile,
    ""
  );
  const rootStyleModsByFile = resolveModDeclarations(
    modulePaths,
    modsByFile,
    null
  );
  const declaredFileIds = resolvedFileIds(rootIndependentModsByFile);

  // The crate root is the file no scanned file declares as a child module;
  // main.rs/lib.rs are the conventional fallbacks for single-file crates.
  const rootCandidates = rustPaths.filter((path) => !declaredFileIds.has(path));
  // A binary crate's main.rs outranks a library root lib.rs: crate:: and
  // super:: anchors resolve against the runnable crate root.
  const rootFileId = selectRootFileId(
    rootCandidates.length > 0 ? rootCandidates : rustPaths,
    rootStyleModsByFile
  );
  const resolvedModsByFile = resolveModDeclarations(
    modulePaths,
    modsByFile,
    rootFileId
  );

  const root: ModuleTreeNode = { fileId: rootFileId, children: new Map() };
  const declaringModules = modulePathsForDeclarations(
    rootFileId,
    rustPaths,
    resolvedModsByFile
  );
  for (const [fileId, modulePath] of declaringModules) {
    if (fileId !== rootFileId) {
      attachFileNode(root, modulePath, fileId);
    }
  }
  for (const [declaringFile, mods] of resolvedModsByFile) {
    const declaringModule =
      declaringModules.get(declaringFile) ??
      modulePathOf(declaringFile, rootFileId);
    for (const mod of mods) {
      attach(root, join(declaringModule, mod.inlinePath), mod.name, {
        fileId: mod.resolvedFileId,
        children: new Map(),
      });
    }
  }
  return {
    crate: { root, rootFileId, declaringModules },
  };
}

/** Chooses a crate root without treating every file as a root declaration. */
function selectRootFileId(
  candidates: readonly string[],
  rootStyleModsByFile: ReadonlyMap<
    string,
    readonly ResolvedModDeclaration[]
  >
): string {
  return (
    candidates.find((path) => basename(path) === BINARY_ROOT_FILE) ??
    candidates.find((path) => basename(path) === LIBRARY_ROOT_FILE) ??
    candidates.reduce((selected, candidate) => {
      const selectedScore =
        rootStyleModsByFile.get(selected)?.filter(
          (mod) => mod.resolvedFileId !== null
        ).length ?? 0;
      const candidateScore =
        rootStyleModsByFile.get(candidate)?.filter(
          (mod) => mod.resolvedFileId !== null
        ).length ?? 0;
      return candidateScore > selectedScore ? candidate : selected;
    }, candidates[0] ?? "")
  );
}

/** Resolves every mod declaration against the selected crate-root semantics. */
function resolveModDeclarations(
  modulePaths: ReadonlySet<string>,
  modsByFile: ReadonlyMap<string, readonly ModDeclaration[]>,
  rootFileId: string | null
): Map<string, readonly ResolvedModDeclaration[]> {
  const resolvedModsByFile = new Map<
    string,
    readonly ResolvedModDeclaration[]
  >();
  for (const [declaringFile, mods] of modsByFile) {
    resolvedModsByFile.set(
      declaringFile,
      mods.map((mod) => ({
        ...mod,
        resolvedFileId: declaredFileId(
          mod,
          declaringFile,
          modulePaths,
          rootFileId
        ),
      }))
    );
  }
  return resolvedModsByFile;
}

/** Collects file-backed declaration targets for root-candidate selection. */
function resolvedFileIds(
  resolvedModsByFile: ReadonlyMap<
    string,
    readonly ResolvedModDeclaration[]
  >
): Set<string> {
  const fileIds = new Set<string>();
  for (const mods of resolvedModsByFile.values()) {
    for (const mod of mods) {
      if (mod.resolvedFileId !== null) {
        fileIds.add(mod.resolvedFileId);
      }
    }
  }
  return fileIds;
}

/**
 * The virtual module path a file occupies relative to the crate root's
 * directory: its path minus the extension, where a `mod.rs` file names its
 * directory itself (the `x/mod.rs` convention). The root file's module is
 * the crate root itself, so it maps to the empty path.
 */
function modulePathOf(fileId: string, rootFileId: string): string {
  if (fileId === "" || fileId === rootFileId) {
    return "";
  }
  const rootDirectory = dirname(rootFileId);
  const relative = fileId.startsWith(`${rootDirectory}/`)
    ? fileId.slice(rootDirectory.length + 1)
    : fileId;
  const withoutExtension = relative.slice(0, -RUST_EXTENSION.length);
  const modulePath = withoutExtension.endsWith("/mod")
    ? withoutExtension.slice(0, -"/mod".length)
    : withoutExtension;
  return modulePath;
}

/**
 * Maps each file to the virtual module path assigned by its declaration.
 * Unreachable files retain a path-derived fallback so relative references
 * from loose scan files remain deterministic.
 */
function modulePathsForDeclarations(
  rootFileId: string,
  rustPaths: readonly string[],
  resolvedModsByFile: ReadonlyMap<
    string,
    readonly ResolvedModDeclaration[]
  >
): Map<string, string> {
  const declaringModules = new Map<string, string>();
  if (rootFileId !== "") {
    declaringModules.set(rootFileId, "");
  }
  const pending = rootFileId === "" ? [] : [rootFileId];
  const declaredFileIds = resolvedFileIds(resolvedModsByFile);
  let pendingIndex = 0;
  let fallbackIndex = 0;
  while (true) {
    while (pendingIndex < pending.length) {
      const declaringFile = pending[pendingIndex];
      pendingIndex += 1;
      if (declaringFile === undefined) {
        continue;
      }
      const declaringModule = declaringModules.get(declaringFile);
      if (declaringModule === undefined) {
        continue;
      }
      for (const mod of resolvedModsByFile.get(declaringFile) ?? []) {
        if (
          mod.resolvedFileId !== null &&
          !declaringModules.has(mod.resolvedFileId)
        ) {
          declaringModules.set(
            mod.resolvedFileId,
            join(declaringModule, mod.inlinePath, mod.name)
          );
          pending.push(mod.resolvedFileId);
        }
      }
    }
    let fallbackFile: string | undefined;
    while (fallbackIndex < rustPaths.length) {
      const candidate = rustPaths[fallbackIndex];
      fallbackIndex += 1;
      if (
        candidate !== undefined &&
        !declaringModules.has(candidate) &&
        !declaredFileIds.has(candidate)
      ) {
        fallbackFile = candidate;
        break;
      }
    }
    fallbackFile ??= rustPaths.find(
      (path) => !declaringModules.has(path)
    );
    if (fallbackFile === undefined) {
      return declaringModules;
    }
    declaringModules.set(fallbackFile, modulePathOf(fallbackFile, rootFileId));
    pending.push(fallbackFile);
  }
}

/**
 * Resolves a mod declaration's metadata file id to a repo-relative module
 * id. Metadata paths are relative to the directory the declaration lives
 * in: the declaring file's directory, plus any enclosing inline mods. A
 * missing `x.rs` falls back to `x/mod.rs`; unresolved declarations leave
 * the node virtual.
 */
function declaredFileId(
  mod: ModDeclaration,
  declaringFile: string,
  modulePaths: ReadonlySet<string>,
  rootFileId: string | null
): string | null {
  if (mod.fileId === null) {
    return null;
  }
  const directory = join(
    mod.isPathAttribute
      ? dirname(declaringFile)
      : declaringDirectory(declaringFile, rootFileId),
    mod.inlinePath
  );
  const base = normalizeAttributePath(mod.fileId);
  const direct = join(directory, base);
  if (modulePaths.has(direct)) {
    return direct;
  }
  const withoutExtension = base.endsWith(RUST_EXTENSION)
    ? base.slice(0, -RUST_EXTENSION.length)
    : base;
  const modRs = join(directory, withoutExtension, "mod.rs");
  return modulePaths.has(modRs) ? modRs : null;
}

/**
 * Resolves a reference against the crate tree. Mod specifiers are single
 * names resolved in the declaring module's scope (the tree already carries
 * their `#[path]`-aware file); use specifiers are `::`-paths resolved
 * through the tree.
 */
function resolveReference(
  reference: ImportReference,
  fromModule: string,
  crate: CrateTree
): ResolvedImport {
  const segments = reference.specifier.split("::");
  const declaringModulePath = modulePathForReference(
    reference,
    fromModule,
    crate
  );
  if (segments.length === 1) {
    // A mod declaration: a child of the declaring module.
    const declaringModule = nodeAt(crate.root, declaringModulePath);
    const mod = declaringModule?.children.get(segments[0] ?? "");
    return mod === undefined || mod.fileId === null ? null : mod.fileId;
  }
  return resolveUsePath(segments, fromModule, declaringModulePath, crate);
}

/** Returns the logical module path containing one extracted reference. */
function modulePathForReference(
  reference: ImportReference,
  fromModule: string,
  crate: CrateTree
): string {
  const declaringModule = crate.declaringModules.get(fromModule) ?? "";
  return join(declaringModule, reference.moduleScope ?? "");
}

/** Returns the source directory where a file module's children are found. */
function declaringDirectory(fileId: string, rootFileId: string | null): string {
  const directory = dirname(fileId);
  if (rootFileId === null || fileId === rootFileId) {
    return directory;
  }
  const fileName = basename(fileId);
  if (
    fileName === "mod.rs"
  ) {
    return directory;
  }
  return join(directory, fileName.slice(0, -RUST_EXTENSION.length));
}

/**
 * Resolves a `use` path's segments to a module id. Anchors decide the
 * starting node: `crate` at the root, `self`/`super` relative to the
 * declaring module, and unqualified paths at that module. Virtual
 * intermediate nodes pass resolution through; only the final file id becomes
 * the edge target.
 */
function resolveUsePath(
  segments: readonly string[],
  declaringFile: string,
  declaringModulePath: string,
  crate: CrateTree
): ResolvedImport {
  const [first = ""] = segments;
  let node: ModuleTreeNode;
  let currentFile: string | null;
  let rest: readonly string[];
  if (first === CRATE_SEGMENT) {
    node = crate.root;
    currentFile = crate.rootFileId;
    rest = segments.slice(1);
  } else if (first === SELF_SEGMENT || first === SUPER_SEGMENT) {
    let ups = 0;
    while (segments[ups] === SUPER_SEGMENT) {
      ups += 1;
    }
    const hasSelf = segments[ups] === SELF_SEGMENT;
    rest = segments.slice(ups + (hasSelf ? 1 : 0));
    let modulePath = declaringModulePath;
    for (let index = 0; index < ups; index += 1) {
      modulePath = dirname(modulePath);
    }
    const target = nodeAt(crate.root, modulePath);
    if (target === null) {
      return null;
    }
    node = target;
    currentFile = target.fileId ?? declaringFile;
  } else {
    const target = nodeAt(crate.root, declaringModulePath);
    if (target === null) {
      return null;
    }
    node = target;
    currentFile = target.fileId ?? declaringFile;
    rest = segments;
  }

  for (let index = 0; index < rest.length; index += 1) {
    const segment = rest[index];
    const child = node.children.get(segment ?? "");
    if (child === undefined) {
      if (index < rest.length - 1) {
        return null;
      }
      // The final segment may name an item (or the wildcard marker) inside
      // the last resolved module, so depend on that module's file.
      return currentFile === declaringFile ? null : currentFile;
    }
    if (child.fileId !== null) {
      currentFile = child.fileId;
    }
    node = child;
  }
  return currentFile === declaringFile ? null : currentFile;
}

/** Attaches a file-backed node at its virtual module path. */
function attachFileNode(
  root: ModuleTreeNode,
  modulePath: string,
  fileId: string
): void {
  if (modulePath === "") {
    return;
  }
  const parentPath = dirname(modulePath);
  attach(root, parentPath === "." ? "" : parentPath, basename(modulePath), {
    fileId,
    children: new Map(),
  });
}

/** Attaches `node` as `name` under the module path below the crate root. */
function attach(
  root: ModuleTreeNode,
  fromModule: string,
  name: string,
  node: ModuleTreeNode
): void {
  let current = root;
  for (const segment of fromModule.split("/")) {
    if (segment !== "") {
      current = getOrCreateChild(current, segment);
    }
  }
  const existing = current.children.get(name);
  if (existing === undefined) {
    current.children.set(name, node);
  } else if (existing.fileId === null && node.fileId !== null) {
    existing.fileId = node.fileId;
  }
}

/** Returns the named child, creating a virtual intermediate when absent. */
function getOrCreateChild(
  parent: ModuleTreeNode,
  name: string
): ModuleTreeNode {
  const existing = parent.children.get(name);
  if (existing !== undefined) {
    return existing;
  }
  const created: ModuleTreeNode = { fileId: null, children: new Map() };
  parent.children.set(name, created);
  return created;
}

/** Walks the tree along a module path, or null when the path is absent. */
function nodeAt(
  root: ModuleTreeNode,
  modulePath: string
): ModuleTreeNode | null {
  let node: ModuleTreeNode | undefined = root;
  for (const segment of modulePath.split("/")) {
    // Empty and "." segments appear when dirname walks above the root;
    // both name the crate root itself.
    if (segment === "" || segment === ".") {
      continue;
    }
    node = node?.children.get(segment);
    if (node === undefined) {
      return null;
    }
  }
  return node ?? null;
}

/** True when the file declares the top-level `fn main()` of a Rust binary. */
function isEntryScript(root: Node): boolean {
  return root.namedChildren.some(
    (node) =>
      node.type === FUNCTION_ITEM &&
      node.childForFieldName("name")?.text === MAIN_FUNCTION
  );
}

export const RUST_RESOLVER: LanguageResolver = {
  languageFor(): string {
    return "rust";
  },
  extensions: EXTENSIONS,
  grammarFileFor(): string {
    return GRAMMAR_FILE;
  },
  extractImports,
  moduleMetadataFor,
  resolveImport(reference, fromModule, modulePaths, context): ResolvedImport {
    const crateContext = crateFor(modulePaths, context?.moduleMetadata);
    if (crateContext === null) {
      return null;
    }
    return resolveReference(reference, fromModule, crateContext.crate);
  },
  isEntryScript,
};
