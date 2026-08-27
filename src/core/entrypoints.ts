/**
 * Entrypoint detection across ecosystems: package.json entry targets for the
 * JS/TS ecosystem, plus whatever each language resolver flags as entrypoints
 * (Python's `__main__.py` files and `__name__ == "__main__"` entry scripts).
 * Only targets that resolve to a discovered module are entrypoints;
 * externals are ignored.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  getResolverForPath,
  resolveEntrypointModule,
} from "./resolver-registry.js";

/**
 * Returns the sorted module ids flagged as entrypoints: package.json targets
 * for JS/TS repos plus each resolver's path- and AST-based entrypoint rules.
 * A missing or malformed package.json yields no metadata entrypoints rather
 * than aborting the scan.
 */
export function findEntrypoints(
  root: string,
  modulePaths: ReadonlySet<string>,
  entryScriptModules: ReadonlySet<string> = new Set()
): string[] {
  const entrypoints = new Set<string>(entryScriptModules);
  const packageJson = readPackageJson(root);
  if (packageJson !== null) {
    for (const target of entryTargets(packageJson)) {
      const moduleId = resolveEntrypointModule(target, modulePaths);
      if (moduleId !== null) {
        entrypoints.add(moduleId);
      }
    }
  }
  for (const path of modulePaths) {
    const resolver = getResolverForPath(path);
    if (resolver?.isEntrypointPath?.(path) === true) {
      entrypoints.add(path);
    }
  }
  return [...entrypoints].sort();
}

/** Reads and JSON-parses package.json, returning null when absent/invalid. */
function readPackageJson(root: string): Record<string, unknown> | null {
  let content: string;
  try {
    content = readFileSync(join(root, "package.json"), "utf8");
  } catch {
    return null;
  }
  try {
    // package.json is arbitrary user input, so JSON.parse result casts here.
    const parsed = JSON.parse(content) as unknown;
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Collects every file target named by the standard entry fields. */
function entryTargets(packageJson: Record<string, unknown>): string[] {
  const targets: string[] = [];
  const strings = (value: unknown): string[] =>
    typeof value === "string" ? [value] : [];

  targets.push(...strings(packageJson["main"]));
  targets.push(...strings(packageJson["module"]));
  targets.push(...binTargets(packageJson["bin"]));
  targets.push(...exportsTargets(packageJson["exports"]));
  return targets;
}

/** bin may be a single string or a map of command name to target. */
function binTargets(bin: unknown): string[] {
  if (typeof bin === "string") {
    return [bin];
  }
  if (typeof bin === "object" && bin !== null) {
    return Object.values(bin).filter(
      (value): value is string => typeof value === "string"
    );
  }
  return [];
}

/** exports may be a string, or an object with a "." entry (itself string/object). */
function exportsTargets(exportsField: unknown): string[] {
  if (typeof exportsField === "string") {
    return [exportsField];
  }
  if (typeof exportsField !== "object" || exportsField === null) {
    return [];
  }
  // exports is user input, so the record shape is cast at this boundary.
  const record = exportsField as Record<string, unknown>;
  const rootExport = record["."];
  if (typeof rootExport === "string") {
    return [rootExport];
  }
  if (typeof rootExport === "object" && rootExport !== null) {
    return Object.values(rootExport).filter(
      (value): value is string => typeof value === "string"
    );
  }
  return [];
}
