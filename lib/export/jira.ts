import { sql } from '../db/client.ts'
import { env } from '../env.ts'

/**
 * D15: optional, shipped switched off, with a dry run that shows exactly what would be
 * sent. An untested integration is the likeliest thing to fail in front of an audience,
 * so the path must be demonstrable without a live instance.
 */
export type JiraIssue = {
  fields: {
    project: { key: string }
    issuetype: { name: string }
    summary: string
    description: string
    labels: string[]
  }
  /** Local reference so a reviewer can see what each issue came from. */
  _source: string
}

export async function buildJiraPayload(runId: number): Promise<JiraIssue[]> {
  const project = env.jiraProjectKey
  const issues: JiraIssue[] = []

  const stories = await sql<any[]>`
    SELECT s.id, r.ref, coalesce(s.edited_text, s.ai_original) AS title, s.criteria
    FROM stories s JOIN requirements r ON r.id = s.requirement_id
    WHERE s.run_id = ${runId} AND s.status <> 'dismissed'
    ORDER BY r.order_index, s.id`

  for (const s of stories) {
    const criteria = (s.criteria as any[])
      .map((c) => `* Given ${c.given}\n  When ${c.when}\n  Then ${c.then}`).join('\n')
    const tasks = await sql<any[]>`
      SELECT coalesce(edited_text, ai_original) AS task, modules, tables
      FROM tasks WHERE story_id = ${s.id} AND status <> 'dismissed' ORDER BY id`
    const tests = await sql<any[]>`
      SELECT coalesce(edited_text, ai_original) AS scenario, kind,
             from_finding_id IS NOT NULL AS from_gap
      FROM test_scenarios WHERE story_id = ${s.id} AND status <> 'dismissed' ORDER BY id`

    issues.push({
      fields: {
        project: { key: project },
        issuetype: { name: 'Story' },
        summary: s.title.slice(0, 254),
        description: [
          `*Requirement:* ${s.ref}`,
          '', 'h3. Acceptance criteria', criteria,
          '', 'h3. Development tasks',
          ...tasks.map((t) => `# ${t.task}` +
            ([...(t.modules ?? []), ...(t.tables ?? [])].length
              ? ` _(${[...(t.modules ?? []), ...(t.tables ?? [])].join(', ')})_` : '')),
          '', 'h3. Test scenarios',
          ...tests.map((t) => `* [${t.kind}] ${t.scenario}` +
            (t.from_gap ? ' _(covers a gap raised in requirement review)_' : '')),
          '', `_Drafted by Setu from ${s.ref}, reviewed and approved by a person._`,
        ].join('\n'),
        labels: ['setu', `run-${runId}`, s.ref.toLowerCase()],
      },
      _source: `${s.ref} → story ${s.id} (${tasks.length} tasks, ${tests.length} tests)`,
    })
  }
  return issues
}

export type PushResult = { pushed: number; failed: number; errors: string[] }

export async function pushToJira(issues: JiraIssue[]): Promise<PushResult> {
  if (!env.jiraPushEnabled) throw new Error('Jira push is disabled. Set JIRA_PUSH_ENABLED=true.')
  if (!env.jiraBaseUrl) throw new Error('JIRA_BASE_URL is not configured.')

  // The same rule as the model endpoint (D31): approved stories carry client business
  // logic, so they may not leave the network either.
  const { assertPrivateEndpoint } = await import('../egress.ts')
  await assertPrivateEndpoint(env.jiraBaseUrl, 'JIRA_BASE_URL')

  const result: PushResult = { pushed: 0, failed: 0, errors: [] }
  for (const issue of issues) {
    try {
      const res = await fetch(`${env.jiraBaseUrl}/rest/api/2/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.jiraToken}`,
        },
        body: JSON.stringify({ fields: issue.fields }),
      })
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`)
      result.pushed++
    } catch (err) {
      result.failed++
      result.errors.push(`${issue._source}: ${(err as Error).message}`)
    }
  }
  return result
}
