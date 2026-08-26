/**
 * Discovery walks a repository root and returns the relative paths of every
 * source file it should analyze: it applies .gitignore rules (including
 * nested ones), always skips VCS and dependency directories, and keeps only
 * files whose extension maps to a registered language resolver.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ignoreImport, { type Ignore } from "ignore";
import { getResolverForPath } from "./resolver-registry.js";

/** Directories skipped unconditionally even if a .gitignore would keep them. */
const ALWAYS_SKIPPED_DIRECTORIES = new Set([".git", "node_modules"]);

/** Directories that are never meaningful source and are skipped as a safety
 * net against vendored build output (e.g. .next, .cache). */
const HIDDEN_DIRECTORY_PREFIX = ".";

/** `ignore` is a CJS package; newer TypeScript types its default import as
 * the module namespace while the runtime default is the callable factory, so
 * the callable type is recovered at this library trust boundary. */
const createIgnore: () => Ignore = ignoreImport.default;

/** A .gitignore rule set scoped to the directory that declared it. */
interface IgnoreFilter {
  /** Posix relative path of the directory holding the .gitignore. */
  readonly dirRel: string;
  readonly matcher: Ignore;
}

/**
 * Discovers the analysis targets under `root`.
 *
 * Returns absolute-free, posix-normalized paths relative to `root`, sorted so
 * downstream ordering is stable. Throws if `root` cannot be read.
 */
export function discoverSourceFiles(root: string): string[] {
  const files: string[] = [];
  const rootFilter = readIgnoreFilter(root, "");
  const filters: IgnoreFilter[] = rootFilter ? [rootFilter] : [];
  walk(root, "", filters, files);
  return files.sort();
}

/** Recursively collects source files, applying each directory's ignore rules. */
function walk(
  dirAbs: string,
  dirRel: string,
  filters: readonly IgnoreFilter[],
  files: string[]
): void {
  const localFilter = readIgnoreFilter(dirAbs, dirRel);
  const localFilters = localFilter ? [...filters, localFilter] : filters;
  const entries = readdirSync(dirAbs, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.isDirectory() && isSkippedDirectory(entry.name)) {
      continue;
    }
    const childRel = dirRel === "" ? entry.name : `${dirRel}/${entry.name}`;
    if (isIgnored(childRel, localFilters)) {
      continue;
    }
    if (entry.isDirectory()) {
      walk(join(dirAbs, entry.name), childRel, localFilters, files);
    } else if (entry.isFile() && getResolverForPath(childRel) !== null) {
      files.push(childRel);
    }
  }
}

/** Reads a directory's .gitignore or returns null when it has none. */
function readIgnoreFilter(dirAbs: string, dirRel: string): IgnoreFilter | null {
  let content: string;
  try {
    content = readFileSync(join(dirAbs, ".gitignore"), "utf8");
  } catch {
    return null;
  }
  return { dirRel, matcher: createIgnore().add(content) };
}

/** True when a hidden (dot-prefixed) or special directory is skipped. */
function isSkippedDirectory(name: string): boolean {
  if (ALWAYS_SKIPPED_DIRECTORIES.has(name)) {
    return true;
  }
  return name.startsWith(HIDDEN_DIRECTORY_PREFIX);
}

/**
 * Decides whether a path is excluded by any ancestor .gitignore. Each filter
 * is asked about the path relative to its own directory so nested rule bases
 * line up with git's semantics.
 */
function isIgnored(
  childRel: string,
  filters: readonly IgnoreFilter[]
): boolean {
  for (const filter of filters) {
    const relToFilter = relativePosix(filter.dirRel, childRel);
    if (relToFilter === null) {
      continue;
    }
    if (filter.matcher.ignores(relToFilter)) {
      return true;
    }
  }
  return false;
}

/** Returns `to` relative to `from` (both posix), or null when not nested under it. */
function relativePosix(from: string, to: string): string | null {
  if (from === "") {
    return to;
  }
  if (!to.startsWith(`${from}/`)) {
    return null;
  }
  return to.slice(from.length + 1);
}
