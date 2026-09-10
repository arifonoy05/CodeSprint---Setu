import { sql } from '../db/client.ts'
import { retrieve } from '../rag/store.ts'
import { CHECKS, type GapClass } from '../rag/checks.ts'
import { runGapCheck } from '../ai/gapcheck.ts'
import {
  canonicalise, dedupe, filterToRetrieved, isSeverity,
  type Candidate, type Suppressed,
} from './postprocess.ts'

export type AnalyzeReport = {
  runId: number
  proposed: number
  suppressed: number
  merged: number
  kept: number
  seconds: number
}

/**
 * D8: checks run sequentially. Measured, 4-wide concurrency is ~17% SLOWER than serial
 * against LM Studio under real prefill load — the fan-out machinery would make it worse.
 */
export async function analyzeRun(runId: number, classes: GapClass[]): Promise<AnalyzeReport> {
  const t0 = Date.now()
  await sql`UPDATE runs SET status = 'analyzing' WHERE id = ${runId}`

  const reqs = await sql<{ id: number; ref: string; ai_original: string }[]>`
    SELECT id, ref, ai_original FROM requirements WHERE run_id = ${runId} ORDER BY order_index`

  const candidates: (Candidate & { evidenceIds: string[]; requirementId: number })[] = []
  const suppressed: Suppressed[] = []
  let proposed = 0
  let done = 0
  await sql`UPDATE runs SET progress_done = 0, progress_total = ${reqs.length * classes.length}
            WHERE id = ${runId}`

  for (const req of reqs) {
    for (const gapClass of classes) {
      const evidence = await retrieve({
        query: req.ai_original,
        quotas: CHECKS[gapClass].quotas,
        runId, // D23 — never another run's requirements
      })
      if (evidence.length === 0) { await sql`UPDATE runs SET progress_done = ${++done} WHERE id = ${runId}`; continue }

      const raw = await runGapCheck({
        gapClass,
        requirementRef: req.ref,
        requirementText: req.ai_original,
        evidence,
      })
      proposed += raw.length

      const asCandidates: Candidate[] = raw.map((r) => ({
        ...r,
        requirementRef: req.ref,
        gapClass,
      }))
      const retrievedIds = evidence.map((e) => e.id)
      const { kept, suppressed: dropped } = filterToRetrieved(asCandidates, retrievedIds) // D3
      suppressed.push(...dropped)

      for (const k of kept) {
        candidates.push({ ...k, requirementId: req.id, evidenceIds: canonicalise(k, retrievedIds) })
      }
      await sql`UPDATE runs SET progress_done = ${++done} WHERE id = ${runId}`
    }
  }

  // D20: union-find over shared evidence; losing rows kept with merged_into_id.
  const merged = dedupe(candidates)
  const ids: (number | null)[] = new Array(merged.length).fill(null)

  // Survivors first, so a loser can point at a row that already exists.
  const order = [...merged.keys()].sort((a, b) =>
    Number(merged[a]!.mergedIntoIndex !== null) - Number(merged[b]!.mergedIntoIndex !== null))

  for (const i of order) {
    const m = merged[i]!
    const src = candidates[i]!
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO findings (run_id, requirement_id, gap_class, merged_classes, merged_into_id,
                            severity, ai_original, question)
      VALUES (${runId}, ${src.requirementId}, ${m.gapClass}, ${m.mergedClasses},
              ${m.mergedIntoIndex === null ? null : ids[m.mergedIntoIndex]},
              ${isSeverity(m.severity) ? m.severity : 'low'}, ${m.gap}, ${m.question})
      RETURNING id`
    ids[i] = row!.id
    for (const chunkId of m.evidenceIds) {
      await sql`INSERT INTO finding_evidence (finding_id, chunk_id) VALUES (${row!.id}, ${chunkId})
                ON CONFLICT DO NOTHING`
    }
  }

  for (const s of suppressed) {
    await sql`
      INSERT INTO suppressed (run_id, requirement_ref, gap_class, raw_evidence, reason, gap)
      VALUES (${runId}, ${s.requirementRef}, ${s.gapClass}, ${s.rawEvidence}, ${s.reason}, ${s.gap})`
  }

  await sql`UPDATE runs SET status = 'review' WHERE id = ${runId}`
  return {
    runId,
    proposed,
    suppressed: suppressed.length,
    merged: merged.filter((m) => m.mergedIntoIndex !== null).length,
    kept: merged.filter((m) => m.mergedIntoIndex === null).length,
    seconds: (Date.now() - t0) / 1000,
  }
}
