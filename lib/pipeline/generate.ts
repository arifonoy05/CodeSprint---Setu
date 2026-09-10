import { sql } from '../db/client.ts'
import { generateStories, generateTasks, generateTests, generateGapTests } from '../ai/generate.ts'
import { retrieve } from '../rag/store.ts'

/**
 * D13: the four role-facing artifacts, generated from the APPROVED requirement set.
 * D30: trace links are written structurally as each artifact is created — the link is
 * known by construction, so no semantic matching and no extra model call.
 */
export async function generateBacklog(runId: number) {
  const [run] = await sql<any[]>`SELECT approved_at FROM runs WHERE id = ${runId}`
  if (!run) throw new Error('run not found')
  // The gate: nothing is generated before sign-off (BRD section 4).
  if (!run.approved_at) throw new Error('run is not approved — nothing is generated before sign-off')

  await sql`UPDATE runs SET status = 'generating', stage = 'drafting the backlog',
                            progress_done = 0 WHERE id = ${runId}`

  // Idempotent: regenerating replaces rather than appends.
  await sql`DELETE FROM trace_links WHERE run_id = ${runId}`
  await sql`DELETE FROM test_scenarios WHERE run_id = ${runId}`
  await sql`DELETE FROM tasks WHERE run_id = ${runId}`
  await sql`DELETE FROM stories WHERE run_id = ${runId}`

  const reqs = await sql<any[]>`
    SELECT id, ref, classification, coalesce(edited_text, ai_original) AS text
    FROM requirements WHERE run_id = ${runId} ORDER BY order_index`

  await sql`UPDATE runs SET progress_total = ${reqs.length} WHERE id = ${runId}`
  let done = 0

  for (const req of reqs) {
    /**
     * Which modules and tables a task touches is a RETRIEVAL question about the
     * requirement, not a lookup of what its gaps happened to cite.
     *
     * The first version read the findings' evidence. Measured, that left most
     * requirements with an empty vocabulary — REQ-001's four findings all cite incident
     * reports and no code or schema at all — so every task came back with no modules and
     * no tables, and the dev-facing artifact the BRD leads with produced nothing.
     * Findings cite evidence FOR A GAP; that is a different question.
     */
    const evidence = (await retrieve({
      query: req.text, quotas: { ddl: 4, code: 4 }, runId,
    })).map((e) => ({ ref: e.sourceRef, kind: e.kind }))

    // Gaps the BA did not dismiss seed the negative test scenarios (D13).
    const gaps = await sql<any[]>`
      SELECT id, coalesce(edited_text, ai_original) AS text
      FROM findings
      WHERE requirement_id = ${req.id} AND merged_into_id IS NULL AND status <> 'dismissed'`

    // Gaps belong to the requirement, not to a story — cover each once, on the first story.
    let gapsCovered = false

    for (const s of await generateStories(req)) {
      const [story] = await sql<any[]>`
        INSERT INTO stories (run_id, requirement_id, title, criteria, ai_original)
        VALUES (${runId}, ${req.id}, ${s.title}, ${sql.json(s.criteria as never)}, ${s.title})
        RETURNING id`

      for (const t of await generateTasks(s, evidence)) {
        await sql`INSERT INTO tasks (run_id, story_id, modules, tables, ai_original)
                  VALUES (${runId}, ${story!.id}, ${t.modules ?? []}, ${t.tables ?? []}, ${t.task})`
      }

      const link = async (kind: 'positive' | 'negative', text: string, fromFinding: number | null) => {
        const [test] = await sql<any[]>`
          INSERT INTO test_scenarios (run_id, story_id, kind, from_finding_id, ai_original)
          VALUES (${runId}, ${story!.id}, ${kind}, ${fromFinding}, ${text}) RETURNING id`
        // D30: requirement -> story -> test, recorded as it is built.
        await sql`INSERT INTO trace_links (run_id, requirement_id, story_id, test_id)
                  VALUES (${runId}, ${req.id}, ${story!.id}, ${test!.id})`
      }

      const tests = await generateTests(s, gaps)
      for (const t of tests) await link(t.kind === 'negative' ? 'negative' : 'positive', t.scenario, null)

      // One scenario per reviewed gap, linked by position rather than by an echoed id.
      const gapTests = gapsCovered ? [] : await generateGapTests(s, gaps)
      for (const g of gapTests) await link('negative', g.scenario, g.gapId)
      if (gapTests.length > 0) gapsCovered = true

      if (tests.length + gapTests.length === 0) {
        await sql`INSERT INTO trace_links (run_id, requirement_id, story_id, test_id)
                  VALUES (${runId}, ${req.id}, ${story!.id}, NULL)`
      }
    }
    await sql`UPDATE runs SET progress_done = ${++done} WHERE id = ${runId}`
  }

  await sql`UPDATE runs SET status = 'ready', stage = NULL WHERE id = ${runId}`
}
