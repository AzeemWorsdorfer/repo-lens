/**
 * repo-lens package entrypoint: single source of truth for the version and a
 * public surface for the report contract types, so library consumers can type
 * the JSON output without importing internal core modules.
 */
export const REPO_LENS_VERSION = "0.1.0";

export type {
  Architecture,
  Edge,
  LanguageStat,
  Module,
  ReportContract,
  ReportCounts,
  ReportMeta,
} from "./core/report-contract.js";
