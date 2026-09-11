import { sql } from './db/client.ts'

export type Pending = {
  findings: number
  stories: number
  tasks: number
  tests: number
  backlog: number   // stories + tasks + tests
  total: number
}

/**
 * What still needs a human decision, per artifact kind.
 *
 * A single "undecided" number on the run header answered "am I done?" but never "with
 * what?" — with forty items across three kinds, that is the only question worth asking.
 * Merged-away findings are excluded: they are never shown, so they can never be decided.
 */
export async function pendingFor(runId: number): Promise<Pending> {
  const [row] = await sql<any[]>`
    SELECT
      (SELECT count(*)::int FROM findings
        WHERE run_id = ${runId} AND merged_into_id IS NULL AND status = 'proposed') AS findings,
      (SELECT count(*)::int FROM stories WHERE run_id = ${runId} AND status = 'proposed') AS stories,
      (SELECT count(*)::int FROM tasks WHERE run_id = ${runId} AND status = 'proposed') AS tasks,
      (SELECT count(*)::int FROM test_scenarios WHERE run_id = ${runId} AND status = 'proposed') AS tests`
  const p = row!
  return { ...p, backlog: p.stories + p.tasks + p.tests,
           total: p.findings + p.stories + p.tasks + p.tests }
}
