/**
 * Graph build orchestrates the deterministic pass end to end for a repo root:
 * discovery, parse, import resolution, edges, cycles, entrypoints, and
 * PageRank. It is the single seam the report assembler consumes, and it keeps
 * ordering explicit so output is byte-identical across runs.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverSourceFiles } from "./discovery.js";
import { parseSource } from "./parser.js";
import { cyclomaticComplexity, computePageRank } from "./metrics.js";
import { findCycles } from "./cycle.js";
import { findEntrypoints } from "./entrypoints.js";
import {
  getResolverForPath,
  type ImportReference,
} from "./resolver-registry.js";
import type { Edge } from "./report-contract.js";

/** The resolved view of one source module before coupling/centrality are added. */
export interface BuiltModule {
  readonly id: string;
  readonly path: string;
  readonly language: string;
  readonly size: number;
  readonly complexity: number;
  /** Unique dependency module ids, sorted. */
  readonly deps: readonly string[];
}

/** Mutable working copy used while assembling a BuiltModule. */
interface DraftModule extends Omit<BuiltModule, "deps"> {
  deps: string[];
}

/** Everything the report assembler needs, already deterministically ordered. */
export interface Analysis {
  readonly repoName: string;
  readonly modules: readonly BuiltModule[];
  readonly edges: readonly Edge[];
  readonly cycles: readonly string[][];
  readonly entrypoints: readonly string[];
  readonly pageRank: ReadonlyMap<string, number>;
}

/**
 * Runs the full deterministic pass over `root` and returns an ordered
 * Analysis. Throws with an actionable message when the root is unusable or a
 * discovered file cannot be read.
 */
export async function analyze(root: string): Promise<Analysis> {
  const absolute = resolve(root);
  const files = discoverSourceFiles(absolute);
  const modulePaths = new Set(files);

  const drafts: DraftModule[] = [];
  const importsByModule = new Map<string, readonly ImportReference[]>();
  const entryScripts = new Set<string>();
  for (const file of files) {
    const resolver = getResolverForPath(file);
    if (resolver === null) {
      continue;
    }
    const content = readFileSync(join(absolute, file), "utf8");
    const rootNode = await parseSource(content, resolver.grammarFileFor(file));
    if (resolver.isEntryScript?.(rootNode) === true) {
      entryScripts.add(file);
    }
    drafts.push({
      id: file,
      path: file,
      language: resolver.languageFor(file),
      size: Buffer.byteLength(content, "utf8"),
      complexity: cyclomaticComplexity(rootNode),
      deps: [],
    });
    importsByModule.set(file, resolver.extractImports(rootNode));
  }

  const edges: Edge[] = [];
  const depsByModule = new Map<string, string[]>();
  for (const draft of drafts) {
    const resolver = getResolverForPath(draft.id);
    if (resolver === null) {
      continue;
    }
    const dependencySet = new Set<string>();
    for (const reference of importsByModule.get(draft.id) ?? []) {
      const target = resolver.resolveImport(reference, draft.id, modulePaths);
      if (target === null || target === draft.id) {
        continue;
      }
      dependencySet.add(target);
      edges.push({ source: draft.id, target, kind: reference.kind });
    }
    draft.deps = [...dependencySet].sort();
    depsByModule.set(draft.id, draft.deps);
  }

  edges.sort(compareEdges);
  const moduleIds = drafts.map((draft) => draft.id);
  const cycles = findCycles(moduleIds, depsByModule);
  const entrypoints = findEntrypoints(absolute, modulePaths, entryScripts);
  const pageRank = computePageRank(moduleIds, depsByModule);

  return {
    repoName: packageName(absolute),
    modules: drafts,
    edges,
    cycles,
    entrypoints,
    pageRank,
  };
}

/** Reads package.json's name, falling back to the root directory's basename. */
function packageName(root: string): string {
  try {
    // package.json is arbitrary user input, so it is cast at this boundary.
    const parsed = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8")
    ) as { name?: unknown };
    if (typeof parsed.name === "string" && parsed.name !== "") {
      return parsed.name;
    }
  } catch {
    // Fall through to the directory name.
  }
  return basename(root);
}

/** Positions edges deterministically: source, then target, then kind. */
function compareEdges(a: Edge, b: Edge): number {
  return (
    a.source.localeCompare(b.source) ||
    a.target.localeCompare(b.target) ||
    a.kind.localeCompare(b.kind)
  );
}

/** Returns the final path segment, or the path itself when it has none. */
function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  const name = slash === -1 ? path : path.slice(slash + 1);
  return name === "" ? path : name;
}
