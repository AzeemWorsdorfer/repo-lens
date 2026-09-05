/**
 * Java resolver: extracts import declarations, maps fully-qualified Java
 * types to source modules, and detects canonical static `void main` methods.
 * Java imports are resolved against the discovered source files, so standard
 * library and third-party imports remain external.
 */
import type { Node } from "web-tree-sitter";
import type {
  ImportReference,
  LanguageResolver,
} from "../resolver-registry.js";

const EXTENSIONS = [".java"] as const;
const GRAMMAR_FILE = "tree-sitter-java.wasm";
const JAVA_EXTENSION = ".java";
const IMPORT_DECLARATION = "import_declaration";
const METHOD_DECLARATION = "method_declaration";
const MODIFIERS = "modifiers";
const VOID_TYPE = "void_type";
const MAIN_METHOD = "main";
const MAIN_MODIFIERS = /\b(?:public|static)\b/g;
const JAVA_MAIN_PARAMETER =
  /^(?:java\.lang\.)?String(?:\[\][A-Za-z_$][\w$]*|\.\.\.[A-Za-z_$][\w$]*|[A-Za-z_$][\w$]*\[\])$/;
const packageMapCache = new WeakMap<ReadonlySet<string>, JavaPackageMap>();

interface JavaPackageMap {
  readonly types: ReadonlyMap<string, string>;
  readonly packages: ReadonlyMap<string, string>;
}

/** Extracts one fully-qualified import reference per Java import declaration. */
function extractImports(root: Node): ImportReference[] {
  const references: ImportReference[] = [];
  for (const declaration of root.descendantsOfType(IMPORT_DECLARATION)) {
    const specifier = declaration.text
      .replace(/^import\s+/, "")
      .replace(/^static\s+/, "")
      .replace(/;\s*$/, "")
      .trim();
    if (specifier !== "") {
      references.push({ specifier, kind: "import" });
    }
  }
  return references;
}

/**
 * Resolves a Java import against the discovered source type map. A wildcard
 * package import uses its first stable source module, while static member
 * imports resolve to the type before the member name.
 */
function resolveImport(
  reference: ImportReference,
  modulePaths: ReadonlySet<string>
): string | null {
  const packageMap = getPackageMap(modulePaths);
  if (reference.specifier.endsWith(".*")) {
    return packageMap.packages.get(reference.specifier.slice(0, -2)) ?? null;
  }
  const direct = packageMap.types.get(reference.specifier);
  if (direct !== undefined) {
    return direct;
  }
  const memberSeparator = reference.specifier.lastIndexOf(".");
  if (memberSeparator === -1) {
    return null;
  }
  return (
    packageMap.types.get(reference.specifier.slice(0, memberSeparator)) ?? null
  );
}

/** Reuses a package map for every import in one scan's module set. */
function getPackageMap(modulePaths: ReadonlySet<string>): JavaPackageMap {
  const cached = packageMapCache.get(modulePaths);
  if (cached !== undefined) {
    return cached;
  }
  const packageMap = buildPackageMap(modulePaths);
  packageMapCache.set(modulePaths, packageMap);
  return packageMap;
}

/**
 * Builds maps from Java qualified type/package names to source modules. Every
 * path suffix is considered because Java source roots such as `src/main/java`
 * are not part of a package declaration.
 */
function buildPackageMap(modulePaths: ReadonlySet<string>): JavaPackageMap {
  const types = new Map<string, string>();
  const packageCandidates = new Map<string, string[]>();
  const javaPaths = [...modulePaths]
    .filter((path) => path.endsWith(JAVA_EXTENSION))
    .sort();

  for (const path of javaPaths) {
    const segments = path
      .slice(0, -JAVA_EXTENSION.length)
      .split("/")
      .filter((segment) => segment !== "");
    const className = segments.at(-1);
    if (className === undefined) {
      continue;
    }
    for (let start = 0; start < segments.length; start += 1) {
      const qualifiedName = segments.slice(start).join(".");
      if (!types.has(qualifiedName)) {
        types.set(qualifiedName, path);
      }
      const packageName = segments.slice(start, -1).join(".");
      if (packageName !== "") {
        const candidates = packageCandidates.get(packageName);
        if (candidates === undefined) {
          packageCandidates.set(packageName, [path]);
        } else {
          candidates.push(path);
        }
      }
    }
  }

  const packages = new Map<string, string>();
  for (const [packageName, candidates] of packageCandidates) {
    packages.set(packageName, candidates[0] ?? "");
  }
  return { types, packages };
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
  if (modifiers === undefined || !hasPublicStaticModifiers(modifiers.text)) {
    return false;
  }
  const parameters = method.childForFieldName("parameters");
  const parameter = parameters?.namedChildren[0];
  return (
    parameters?.namedChildren.length === 1 &&
    parameter !== undefined &&
    JAVA_MAIN_PARAMETER.test(parameter.text.replace(/\s+/g, ""))
  );
}

/** Checks both required method modifiers without accepting a partial word. */
function hasPublicStaticModifiers(text: string): boolean {
  return [...text.matchAll(MAIN_MODIFIERS)].length === 2;
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
  resolveImport(reference, _fromModule, modulePaths): string | null {
    return resolveImport(reference, modulePaths);
  },
  isEntryScript,
};
