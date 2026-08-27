/**
 * Deterministic per-module metrics: cyclomatic complexity from the AST and
 * PageRank centrality over the dependency graph. All iteration is over a
 * stable, sorted module order so the numbers are byte-identical run to run.
 */
import type { Node } from "web-tree-sitter";

/** Decision node types that each add one to cyclomatic complexity. */
const DECISION_TYPES: string[] = [
  "if_statement",
  "for_statement",
  "for_in_statement",
  "for_of_statement",
  "while_statement",
  "do_statement",
  "switch_case",
  "catch_clause",
  "ternary_expression",
  // Python equivalents of the JS/TS nodes above, per ADR 0002.
  "except_clause",
  "case_clause",
  "conditional_expression",
];

/** Binary operators that short-circuit and count as a decision point. */
const BOOLEAN_OPERATORS = new Set(["&&", "||", "??"]);

/** PageRank damping factor, matching the pinned metric definition. */
const DAMPING = 0.85;
/** Fixed iteration count, pinned so results are reproducible. */
const PAGE_RANK_ITERATIONS = 100;

/**
 * Cyclomatic complexity: 1 plus one for each decision point in the AST.
 * Decision points are if/for/while/do/case/catch/ternary and the
 * short-circuiting &&, ||, ?? operators.
 */
export function cyclomaticComplexity(root: Node): number {
  let complexity = 1;
  complexity += root.descendantsOfType(DECISION_TYPES).length;
  for (const node of root.descendantsOfType("binary_expression")) {
    const operator = node.childForFieldName("operator")?.text;
    if (operator !== undefined && BOOLEAN_OPERATORS.has(operator)) {
      complexity += 1;
    }
  }
  return complexity;
}

/**
 * Computes PageRank over the directed module graph for the given sorted
 * module ids. `depsByModule` maps each module id to its (sorted) dependency
 * ids; edges point source -> target. Dangling modules (no dependencies)
 * distribute their rank uniformly to every module. Returns a rank per module.
 */
export function computePageRank(
  moduleIds: readonly string[],
  depsByModule: ReadonlyMap<string, readonly string[]>
): Map<string, number> {
  const ranks = new Map<string, number>();
  const count = moduleIds.length;
  if (count === 0) {
    return ranks;
  }
  const initial = 1 / count;
  for (const id of moduleIds) {
    ranks.set(id, initial);
  }
  const outDegree = new Map<string, number>();
  const incoming = new Map<string, string[]>();
  for (const id of moduleIds) {
    outDegree.set(id, depsByModule.get(id)?.length ?? 0);
    incoming.set(id, []);
  }
  for (const id of moduleIds) {
    for (const dependency of depsByModule.get(id) ?? []) {
      incoming.get(dependency)?.push(id);
    }
  }
  for (let iteration = 0; iteration < PAGE_RANK_ITERATIONS; iteration++) {
    let danglingMass = 0;
    for (const id of moduleIds) {
      if ((outDegree.get(id) ?? 0) === 0) {
        danglingMass += ranks.get(id) ?? 0;
      }
    }
    const danglingShare = danglingMass / count;
    const next = new Map<string, number>();
    for (const target of moduleIds) {
      let sum = danglingShare;
      for (const source of incoming.get(target) ?? []) {
        const degree = outDegree.get(source) ?? 0;
        if (degree > 0) {
          sum += (ranks.get(source) ?? 0) / degree;
        }
      }
      next.set(target, (1 - DAMPING) / count + DAMPING * sum);
    }
    for (const id of moduleIds) {
      ranks.set(id, next.get(id) ?? 0);
    }
  }
  return ranks;
}
