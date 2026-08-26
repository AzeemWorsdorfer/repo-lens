/**
 * The machine-readable report contract shared by `--emit json` and the HTML
 * embed. This file owns the exact shape and field order of the report so the
 * JSON stays byte-identical across runs.
 */

/** Aggregated per-language file counts shown in the Overview view. */
export interface LanguageStat {
  readonly language: string;
  readonly fileCount: number;
}

/** Summary counts so consumers can assert totals without re-deriving them. */
export interface ReportCounts {
  readonly modules: number;
  readonly edges: number;
  readonly cycles: number;
  readonly entrypoints: number;
}

/** Top-level metadata about the scan and the repository. */
export interface ReportMeta {
  readonly repo: string;
  readonly languages: LanguageStat[];
  readonly counts: ReportCounts;
  /** Tokens spent by the LLM pass; always 0 in the deterministic pass. */
  readonly budgetUsed: number;
}

/** One source file in the report. Ids are repository-relative paths. */
export interface Module {
  readonly id: string;
  readonly path: string;
  readonly language: string;
  /** Source size in bytes. */
  readonly size: number;
  /** Cyclomatic complexity (1 + decision points in the AST). */
  readonly complexity: number;
  /** Afferent + efferent coupling (dependents + dependencies). */
  readonly coupling: number;
  /** PageRank x complexity x size, the only consumer of which is budget ranking. */
  readonly centrality: number;
  /** Module ids this module depends on, sorted. */
  readonly deps: string[];
  /** Module ids that depend on this module, sorted. */
  readonly dependents: string[];
  /** Absent (`null`) until an LLM pass supplies a summary. */
  readonly summary: string | null;
}

/** A directed dependency between two modules. */
export interface Edge {
  readonly source: string;
  readonly target: string;
  /** The statement shape that produced the edge, e.g. "import" or "require". */
  readonly kind: string;
}

/** Optional LLM architecture narrative; empty/absent in the deterministic pass. */
export interface Architecture {
  readonly layers: string[];
  readonly narrative: string | null;
}

/** The full report. Field order is fixed to keep JSON output stable. */
export interface ReportContract {
  readonly meta: ReportMeta;
  readonly modules: Module[];
  readonly edges: Edge[];
  /** Each cycle is a group of module ids that depend on each other circularly. */
  readonly cycles: string[][];
  /** Module ids that start a program, e.g. package.json main/bin targets. */
  readonly entrypoints: string[];
  readonly architecture: Architecture;
  /** LLM-generated flows; always empty in the deterministic pass. */
  readonly flows: never[];
}
