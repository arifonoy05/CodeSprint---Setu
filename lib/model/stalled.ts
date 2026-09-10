import { sql } from '../db/client.ts'

/**
 * A run is stalled when it says it is waiting on a job that no longer exists — either it
 * was never created, or it died without recording a failure.
 *
 * Checked against the queue rather than elapsed time: a busy queue is slow, not stalled,
 * and a timeout guess would offer a retry that duplicates work.
 */
export async function generationStalled(runId: number): Promise<boolean> {
  const [run] = await sql<any[]>`
    SELECT status, stage, generate_job_id FROM runs WHERE id = ${runId}`
  if (!run) return false
  const waiting = run.status === 'generating' || run.stage === 'queued'
  if (!waiting) return false
  if (!run.generate_job_id) return true // enqueued before this was tracked, or never enqueued

  const [job] = await sql<any[]>`
    SELECT state FROM pgboss.job WHERE id = ${run.generate_job_id}::uuid
    UNION ALL
    SELECT state FROM pgboss.archive WHERE id = ${run.generate_job_id}::uuid
    LIMIT 1`
  if (!job) return true
  return ['failed', 'cancelled', 'expired'].includes(job.state)
}
