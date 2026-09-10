import type { ChunkKind } from './ids.ts'

export const GAP_CLASSES = ['missing_ac', 'failure_path', 'contradiction', 'dependency'] as const
export type GapClass = (typeof GAP_CLASSES)[number]

/**
 * D8: each check retrieves the evidence it actually needs.
 *
 * Quotas per kind, not one ranked list. Measured on the answer key:
 *   code-only for contradiction, ddl+code for dependency   -> retrieval@k 0.82
 *   widened to include rca, single ranked list             -> 0.73  (worse)
 *   per-kind quotas                                        -> see eval
 *
 * Widening a single ranked list backfires because RCAs are prose and embed closer to a
 * prose requirement than source code does, so they crowd code and DDL out of the top k.
 * That is the D9 vocabulary gap: the SRS says "partial disbursement", the code says
 * `disburseTranche`. Quotas stop the kinds competing and guarantee each one slots.
 *
 * Single-sourced here so the evaluator and the pipeline cannot disagree about what a
 * check is able to see.
 */
export const CHECKS: Record<
  GapClass,
  { quotas: Partial<Record<ChunkKind, number>>; question: string; evidenceRule: string }
> = {
  missing_ac: {
    quotas: { requirement: 4 },
    question: 'acceptance criteria that the requirement leaves unstated',
    evidenceRule: 'Cite the requirement itself, and any sibling requirement it fails to pin down.',
  },
  failure_path: {
    quotas: { rca: 5 },
    question: 'failure paths the requirement does not specify behaviour for',
    evidenceRule: 'Cite the incident report describing the failure that has actually occurred.',
  },
  contradiction: {
    quotas: { code: 5, rca: 3 },
    question: 'ways the requirement contradicts how the system already behaves',
    evidenceRule:
      'A contradiction is with CODE. Cite the function whose behaviour differs from the ' +
      'requirement. An incident report may support it, but must not be the only citation.',
  },
  dependency: {
    quotas: { ddl: 3, code: 3, rca: 2 },
    question: 'cross-module or data dependencies the requirement does not mention',
    evidenceRule:
      'A dependency lives in a TABLE or a FUNCTION. Cite the table or function that carries ' +
      'it — the table holding the data another module owns, or the function calling out to ' +
      'that module. An incident report alone is not evidence of a dependency; it is only a ' +
      'symptom of one.',
  },
}
