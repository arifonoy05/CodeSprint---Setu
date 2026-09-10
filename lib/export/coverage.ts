import { sql } from '../db/client.ts'

export type Coverage = {
  total: number
  withStory: number
  withTest: number
  complete: number
  percent: number
  unmapped: { ref: string; missing: string }[]
}

/**
 * D28: a success criterion that is never asserted is one you discover you failed on
 * stage. Coverage is computed, shown, and gates export.
 *
 * Dismissed artifacts do not count — a story the BA dropped does not cover anything.
 */
export async function coverageFor(runId: number): Promise<Coverage> {
  const rows = await sql<{ ref: string; stories: number; tests: number }[]>`
    SELECT r.ref,
      (SELECT count(*)::int FROM stories s
        WHERE s.requirement_id = r.id AND s.status <> 'dismissed')                    AS stories,
      (SELECT count(*)::int FROM trace_links t
        JOIN test_scenarios ts ON ts.id = t.test_id
        WHERE t.requirement_id = r.id AND ts.status <> 'dismissed')                   AS tests
    FROM requirements r WHERE r.run_id = ${runId} ORDER BY r.order_index`

  const unmapped = rows
    .filter((r) => r.stories === 0 || r.tests === 0)
    .map((r) => ({
      ref: r.ref,
      missing: r.stories === 0 && r.tests === 0 ? 'no story and no test'
             : r.stories === 0 ? 'no story' : 'no test',
    }))

  const complete = rows.length - unmapped.length
  return {
    total: rows.length,
    withStory: rows.filter((r) => r.stories > 0).length,
    withTest: rows.filter((r) => r.tests > 0).length,
    complete,
    percent: rows.length ? complete / rows.length : 0,
    unmapped,
  }
}
