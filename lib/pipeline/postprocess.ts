import type { GapClass } from '../rag/checks.ts'

export type RawFinding = {
  gap: string
  severity: string
  evidence_ids: string[]
  question: string
}

export type Candidate = RawFinding & {
  requirementRef: string
  gapClass: GapClass
}

export type Suppressed = Candidate & { reason: 'no_evidence' | 'out_of_set'; rawEvidence: string }

export type Merged = Candidate & {
  evidenceIds: string[]
  mergedClasses: GapClass[]
  /** index into the same array; null for a survivor. Losers are kept, never discarded (D14). */
  mergedIntoIndex: number | null
}

const SEVERITY_ORDER = { high: 3, medium: 2, low: 1 } as const
export type Severity = keyof typeof SEVERITY_ORDER
export const isSeverity = (s: string): s is Severity => s in SEVERITY_ORDER

/**
 * D17: normalise both sides before comparing. Cited ids are adversarial input.
 *
 * Observed in the wild, all of these mean the same chunk:
 *   R-1041 · [R-1041] · `R-1041` · RCA-1041 · "[R-1092] (RCA-1092)"
 *
 * The last one is the expensive case: the prompt renders evidence as "[ID] (sourceRef)"
 * and the model echoes the whole line back as its citation. Measured, that accounted for
 * 5 of 6 suppressions on the first real run — valid findings being thrown away as
 * ungrounded. Take the bracketed id when there is one, otherwise the leading token.
 */
export function normaliseId(raw: string): string {
  const bracketed = raw.match(/\[([^\]]+)\]/)
  const token = (bracketed ? bracketed[1]! : raw).trim().split(/[\s(,]/)[0] ?? ''
  return token
    .replace(/[`'"]/g, '')
    .replace(/^RCA-/i, 'R-')
    .toUpperCase()
}

/**
 * D3: the citation guarantee is a property of this function, not of the model's good
 * behaviour. A finding citing anything outside what was actually retrieved for THIS
 * request is dropped, and the raw string is kept so a format quirk can be told apart
 * from a hallucination (D17).
 */
export function filterToRetrieved(
  candidates: Candidate[],
  retrievedIds: string[],
): { kept: Candidate[]; suppressed: Suppressed[] } {
  const allowed = new Set(retrievedIds.map(normaliseId))
  const kept: Candidate[] = []
  const suppressed: Suppressed[] = []

  for (const c of candidates) {
    const rawEvidence = JSON.stringify(c.evidence_ids)
    if (!c.evidence_ids || c.evidence_ids.length === 0) {
      suppressed.push({ ...c, reason: 'no_evidence', rawEvidence })
      continue
    }
    if (!c.evidence_ids.every((e) => allowed.has(normaliseId(e)))) {
      suppressed.push({ ...c, reason: 'out_of_set', rawEvidence })
      continue
    }
    kept.push(c)
  }
  return { kept, suppressed }
}

/** Map a normalised citation back to the canonical chunk id it matched. */
export function canonicalise(candidate: Candidate, retrievedIds: string[]): string[] {
  const byNorm = new Map(retrievedIds.map((id) => [normaliseId(id), id]))
  return [...new Set(candidate.evidence_ids.map((e) => byNorm.get(normaliseId(e))!).filter(Boolean))]
}

/**
 * D20: four checks will report the same gap more than once — "no idempotency on retry"
 * is legitimately both a failure path and a contradiction. A BA reading near-duplicates
 * concludes the tool is noisy, and that is precision damage the automated recall metric
 * never sees.
 *
 * Grouping is union-find over shared evidence, one merged finding per connected
 * component. Plain "group by overlap" is undefined: overlap is not transitive, so
 * A∩B≠∅ and B∩C≠∅ does not imply A∩C≠∅.
 *
 * The losing rows are kept with mergedIntoIndex set — their gap text and question are
 * AI proposals too, and D14 makes those immutable.
 */
export function dedupe(items: (Candidate & { evidenceIds: string[] })[]): Merged[] {
  const parent = items.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i]!.requirementRef !== items[j]!.requirementRef) continue
      const shared = items[i]!.evidenceIds.some((e) => items[j]!.evidenceIds.includes(e))
      if (shared) union(i, j)
    }
  }

  const groups = new Map<number, number[]>()
  items.forEach((_, i) => {
    const root = find(i)
    groups.set(root, [...(groups.get(root) ?? []), i])
  })

  const out: Merged[] = items.map((it) => ({ ...it, mergedClasses: [it.gapClass], mergedIntoIndex: null }))

  for (const members of groups.values()) {
    if (members.length === 1) continue
    const rank = (i: number) =>
      isSeverity(items[i]!.severity) ? SEVERITY_ORDER[items[i]!.severity as Severity] : 0
    // Highest severity wins; ties break on the earlier index so the result is stable.
    const survivor = members.reduce((best, i) => (rank(i) > rank(best) ? i : best), members[0]!)
    const classes = [...new Set(members.map((i) => items[i]!.gapClass))]
    out[survivor]!.mergedClasses = classes
    out[survivor]!.evidenceIds = [...new Set(members.flatMap((i) => items[i]!.evidenceIds))]
    for (const i of members) if (i !== survivor) out[i]!.mergedIntoIndex = survivor
  }
  return out
}
