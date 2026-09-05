/**
 * Java resolver: extracts import declarations, indexes Java package/type
 * declarations, and detects canonical static `void main` methods. Java
 * imports are resolved against declared source types, so standard library and
 * third-party imports remain external.
 */
import type { Node } from "web-tree-sitter";
import type {
  ImportReference,
  LanguageResolver,
  ResolvedImport,
} from "../resolver-registry.js";

const EXTENSIONS = [".java"] as const;
const GRAMMAR_FILE = "tree-sitter-java.wasm";
const JAVA_EXTENSION = ".java";
const IMPORT_DECLARATION = "import_declaration";
const METHOD_DECLARATION = "method_declaration";
const MODIFIERS = "modifiers";
const VOID_TYPE = "void_type";
const MAIN_METHOD = "main";
const PUBLIC_MODIFIER = "public";
const STATIC_MODIFIER = "static";
const TYPE_DECLARATIONS = new Set([
  "annotation_type_declaration",
  "class_declaration",
  "enum_declaration",
  "interface_declaration",
  "record_declaration",
]);
const TYPE_BODIES = new Set([
  "annotation_type_body",
  "class_body",
  "enum_body",
  "interface_body",
]);
const JAVA_STRING_TYPES = new Set(["String", "java.lang.String"]);
const JAVA_TYPE_NODES = new Set(["scoped_type_identifier", "type_identifier"]);
const PACKAGE_MAP_CACHE = new WeakMap<
  ReadonlyMap<string, unknown>,
  JavaPackageMap
>();

interface JavaModuleMetadata {
  readonly packageName: string;
  readonly declaredTypes: readonly string[];
}

interface JavaPackageMap {
  readonly types: ReadonlyMap<string, string | null>;
  readonly packages: ReadonlyMap<string, readonly string[]>;
}

/** Extracts one import reference per Java import declaration. */
function extractImports(root: Node): ImportReference[] {
  const references: ImportReference[] = [];
  for (const declaration of root.descendantsOfType(IMPORT_DECLARATION)) {
    const match = declaration.text.match(/^import\s+(static\s+)?(.+?)\s*;\s*$/);
    const specifier = match?.[2]?.trim();
    if (specifier !== undefined && specifier !== "") {
      references.push({
        specifier,
        kind: "import",
        isStatic: match?.[1] !== undefined,
      });
    }
  }
  return references;
}

/**
 * Resolves a Java import against compact parsed declarations. Ordinary package
 * wildcards return every declared type in the package; static imports target
 * their declaring type, including static wildcard imports.
 */
function resolveImport(
  reference: ImportReference,
  modulePaths: ReadonlySet<string>,
  moduleMetadata: ReadonlyMap<string, unknown> | undefined
): ResolvedImport {
  if (moduleMetadata === undefined) {
    return null;
  }
  const packageMap = getPackageMap(modulePaths, moduleMetadata);
  const specifier = reference.specifier;
  if (specifier.endsWith(".*")) {
    const prefix = specifier.slice(0, -2);
    if (reference.isStatic === true) {
      return localType(packageMap, prefix);
    }
    return packageMap.packages.get(prefix) ?? null;
  }
  if (reference.isStatic === true) {
    const memberSeparator = specifier.lastIndexOf(".");
    if (memberSeparator === -1) {
      return null;
    }
    return localType(packageMap, specifier.slice(0, memberSeparator));
  }
  return localType(packageMap, specifier);
}

/** Returns a non-ambiguous local type as a one-edge resolution. */
function localType(
  packageMap: JavaPackageMap,
  qualifiedName: string
): string | null {
  const path = packageMap.types.get(qualifiedName);
  return path === undefined || path === null ? null : path;
}

/** Reuses a package map for every import in one scan's module set. */
function getPackageMap(
  modulePaths: ReadonlySet<string>,
  moduleMetadata: ReadonlyMap<string, unknown>
): JavaPackageMap {
  const cached = PACKAGE_MAP_CACHE.get(moduleMetadata);
  if (cached !== undefined) {
    return cached;
  }
  const packageMap = buildPackageMap(modulePaths, moduleMetadata);
  PACKAGE_MAP_CACHE.set(moduleMetadata, packageMap);
  return packageMap;
}

/**
 * Builds maps from Java package/type declarations to source modules. The
 * package declaration and declared type names are authoritative even when a
 * repository uses a non-standard source-root layout.
 */
function buildPackageMap(
  modulePaths: ReadonlySet<string>,
  moduleMetadata: ReadonlyMap<string, unknown>
): JavaPackageMap {
  const types = new Map<string, string | null>();
  const packageCandidates = new Map<string, Set<string>>();
  const javaPaths = [...modulePaths]
    .filter((path) => path.toLowerCase().endsWith(JAVA_EXTENSION))
    .sort();

  for (const path of javaPaths) {
    const metadata = moduleMetadata.get(path);
    if (
      !isJavaModuleMetadata(metadata) ||
      metadata.declaredTypes.length === 0
    ) {
      continue;
    }
    const candidates = packageCandidates.get(metadata.packageName) ?? new Set();
    candidates.add(path);
    packageCandidates.set(metadata.packageName, candidates);
    for (const declaredType of metadata.declaredTypes) {
      const qualifiedName =
        metadata.packageName === ""
          ? declaredType
          : `${metadata.packageName}.${declaredType}`;
      addType(types, qualifiedName, path);
    }
  }

  const packages = new Map<string, readonly string[]>();
  for (const [packageName, candidates] of packageCandidates) {
    packages.set(packageName, [...candidates].sort());
  }
  return { types, packages };
}

/** Adds a type mapping, marking duplicate qualified declarations ambiguous. */
function addType(
  types: Map<string, string | null>,
  qualifiedName: string,
  path: string
): void {
  const existing = types.get(qualifiedName);
  if (existing === undefined) {
    types.set(qualifiedName, path);
  } else if (existing !== path) {
    types.set(qualifiedName, null);
  }
}

/** Validates compact metadata crossing the generic resolver context boundary. */
function isJavaModuleMetadata(value: unknown): value is JavaModuleMetadata {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  // The registry intentionally stores language-specific metadata as unknown.
  const record = value as {
    packageName?: unknown;
    declaredTypes?: unknown;
  };
  return (
    typeof record.packageName === "string" &&
    Array.isArray(record.declaredTypes) &&
    record.declaredTypes.every((type) => typeof type === "string")
  );
}

/** Returns compact Java package/type metadata for the resolver context. */
function moduleMetadataFor(root: Node): JavaModuleMetadata {
  return {
    packageName: declaredPackage(root),
    declaredTypes: declaredTypeNames(root),
  };
}

/** Returns the package declaration's qualified name, or the default package. */
function declaredPackage(root: Node): string {
  const declaration = root.namedChildren.find(
    (child) => child.type === "package_declaration"
  );
  return declaration?.namedChildren[0]?.text ?? "";
}

/** Returns every top-level and member type declared by a Java source file. */
function declaredTypeNames(root: Node): string[] {
  const names: string[] = [];
  for (const child of root.namedChildren) {
    if (TYPE_DECLARATIONS.has(child.type)) {
      collectTypeNames(child, "", names);
    }
  }
  return names;
}

/** Recursively names a type and its importable member types. */
function collectTypeNames(
  declaration: Node,
  enclosingName: string,
  names: string[]
): void {
  const name = declaration.childForFieldName("name")?.text;
  if (name === undefined) {
    return;
  }
  const qualifiedName =
    enclosingName === "" ? name : `${enclosingName}.${name}`;
  names.push(qualifiedName);
  const body = declaration.namedChildren.find((child) =>
    TYPE_BODIES.has(child.type)
  );
  for (const child of body?.namedChildren ?? []) {
    if (TYPE_DECLARATIONS.has(child.type)) {
      collectTypeNames(child, qualifiedName, names);
    }
  }
}

/** True when a method has Java's canonical public static void main signature. */
function isMainMethod(method: Node): boolean {
  if (method.childForFieldName("name")?.text !== MAIN_METHOD) {
    return false;
  }
  if (method.childForFieldName("type")?.type !== VOID_TYPE) {
    return false;
  }
  const modifiers = method.namedChildren.find(
    (child) => child.type === MODIFIERS
  );
  if (modifiers === undefined || !hasPublicStaticModifiers(modifiers)) {
    return false;
  }
  const parameters = method.childForFieldName("parameters");
  const parameter = parameters?.namedChildren[0];
  return (
    parameters?.namedChildren.length === 1 &&
    parameter !== undefined &&
    isStringArrayParameter(parameter)
  );
}

/** Checks both required method modifiers. */
function hasPublicStaticModifiers(modifiers: Node): boolean {
  const modifierTypes = new Set(
    modifiers.children
      .filter(
        (child) =>
          child.type === PUBLIC_MODIFIER || child.type === STATIC_MODIFIER
      )
      .map((child) => child.type)
  );
  return modifierTypes.has(PUBLIC_MODIFIER) && modifierTypes.has(STATIC_MODIFIER);
}

/** Accepts array and varargs String parameters with legal annotations/modifiers. */
function isStringArrayParameter(parameter: Node): boolean {
  if (parameter.type === "spread_parameter") {
    return isStringType(
      parameter.namedChildren.find((child) => JAVA_TYPE_NODES.has(child.type))
    );
  }
  if (parameter.type !== "formal_parameter") {
    return false;
  }
  const type = parameter.childForFieldName("type");
  if (type?.type === "array_type") {
    return isStringType(type.namedChildren[0]);
  }
  return (
    isStringType(type) &&
    parameter.namedChildren.some((child) => child.type === "dimensions")
  );
}

/** True for either spelling of java.lang.String's simple source name. */
function isStringType(node: Node | null | undefined): boolean {
  return (
    node !== null && node !== undefined && JAVA_STRING_TYPES.has(node.text)
  );
}

/** True when any Java method in the source has the canonical main signature. */
function isEntryScript(root: Node): boolean {
  return root.descendantsOfType(METHOD_DECLARATION).some(isMainMethod);
}

export const JAVA_RESOLVER: LanguageResolver = {
  languageFor(): string {
    return "java";
  },
  extensions: EXTENSIONS,
  grammarFileFor(): string {
    return GRAMMAR_FILE;
  },
  extractImports,
  moduleMetadataFor,
  resolveImport(reference, _fromModule, modulePaths, context): ResolvedImport {
    return resolveImport(reference, modulePaths, context?.moduleMetadata);
  },
  isEntryScript,
};
