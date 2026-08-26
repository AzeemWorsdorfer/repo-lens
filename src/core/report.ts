/**
 * Report assembler converts the ordered Analysis into the ReportContract,
 * adding derived metrics (coupling, centrality, dependents) and stable
 * counts. Field order follows the contract so the JSON is byte-identical.
 */
import type { Analysis } from "./graph.js";
import type {
  Architecture,
  LanguageStat,
  Module,
  ReportContract,
  ReportCounts,
  ReportMeta,
} from "./report-contract.js";

/**
 * Builds the full report contract from an Analysis. Modules, edges, cycles,
 * and entrypoints are already ordered by the graph layer; this layer only
 * derives per-module dependents/coupling/centrality and aggregates counts.
 */
export function buildReport(analysis: Analysis): ReportContract {
  const dependentsByModule = buildDependents(analysis);
  const modules: Module[] = analysis.modules.map((module) => {
    const dependents = [...(dependentsByModule.get(module.id) ?? [])].sort();
    return {
      id: module.id,
      path: module.path,
      language: module.language,
      size: module.size,
      complexity: module.complexity,
      coupling: dependents.length + module.deps.length,
      centrality:
        (analysis.pageRank.get(module.id) ?? 0) *
        module.complexity *
        module.size,
      deps: [...module.deps],
      dependents,
      summary: null,
    };
  });

  const languages: LanguageStat[] = languageStats(modules);
  const counts: ReportCounts = {
    modules: modules.length,
    edges: analysis.edges.length,
    cycles: analysis.cycles.length,
    entrypoints: analysis.entrypoints.length,
  };
  const meta: ReportMeta = {
    repo: analysis.repoName,
    languages,
    counts,
    budgetUsed: 0,
  };
  const architecture: Architecture = {
    layers: [],
    narrative: null,
  };

  return {
    meta,
    modules,
    edges: [...analysis.edges],
    cycles: analysis.cycles.map((cycle) => [...cycle]),
    entrypoints: [...analysis.entrypoints],
    architecture,
    flows: [],
  };
}

/** Reverses edges into a map of module id to its (unordered) dependents. */
function buildDependents(analysis: Analysis): Map<string, string[]> {
  const dependents = new Map<string, string[]>();
  for (const edge of analysis.edges) {
    const list = dependents.get(edge.target);
    if (list === undefined) {
      dependents.set(edge.target, [edge.source]);
    } else if (!list.includes(edge.source)) {
      list.push(edge.source);
    }
  }
  return dependents;
}

/** Aggregates file counts per language, sorted by language name. */
function languageStats(modules: readonly Module[]): LanguageStat[] {
  const counts = new Map<string, number>();
  for (const module of modules) {
    counts.set(module.language, (counts.get(module.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([language, fileCount]) => ({ language, fileCount }))
    .sort((a, b) => a.language.localeCompare(b.language));
}
