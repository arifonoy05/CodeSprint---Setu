import { sql } from '../db/client.ts'
import { extractRun } from './extract.ts'
import { analyzeRun } from './analyze.ts'
import { GAP_CLASSES } from '../rag/checks.ts'

/**
 * Extract then analyse, as one job.
 *
 * Idempotent on runId: a retry after a dropped tunnel clears what the previous attempt
 * wrote rather than appending to it, so a run cannot end up with duplicate findings.
 */
export async function processRun(runId: number) {
  await sql`DELETE FROM finding_evidence
            WHERE finding_id IN (SELECT id FROM findings WHERE run_id = ${runId})`
  await sql`DELETE FROM findings WHERE run_id = ${runId}`
  await sql`DELETE FROM suppressed WHERE run_id = ${runId}`
  await sql`DELETE FROM requirements WHERE run_id = ${runId}`
  await sql`DELETE FROM chunks WHERE run_id = ${runId}`

  const [row] = await sql<{ document_id: number }[]>`SELECT document_id FROM runs WHERE id = ${runId}`
  if (!row) throw new Error(`run ${runId} not found`)

  await sql`UPDATE runs SET stage = 'extracting requirements', progress_done = 0, progress_total = 0,
                            status = 'extracting', error = NULL WHERE id = ${runId}`
  const { count } = await extractRun(row.document_id, runId)

  await sql`UPDATE runs SET stage = 'checking requirements against the system',
                            progress_total = ${count * GAP_CLASSES.length} WHERE id = ${runId}`
  await analyzeRun(runId, [...GAP_CLASSES])

  await sql`UPDATE runs SET stage = NULL, status = 'review', finished_at = now() WHERE id = ${runId}`
}
