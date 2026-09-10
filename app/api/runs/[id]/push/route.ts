import { NextResponse } from 'next/server'
import { apiUser, isResponse } from '@/lib/auth/api.ts'
import { audit } from '@/lib/auth/audit.ts'
import { sql } from '@/lib/db/client.ts'
import { env } from '@/lib/env.ts'
import { buildJiraPayload, pushToJira } from '@/lib/export/jira.ts'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser('artifact:push')
  if (isResponse(user)) return user

  const runId = Number((await ctx.params).id)
  const dryRun = new URL(req.url).searchParams.get('dryRun') !== 'false'

  const [run] = await sql<any[]>`SELECT backlog_approved_at FROM runs WHERE id = ${runId}`
  if (!run) return NextResponse.json({ error: 'run not found' }, { status: 404 })

  const issues = await buildJiraPayload(runId)

  if (dryRun) {
    // Contacts nothing. Works with no Jira instance configured at all.
    return NextResponse.json({
      dryRun: true,
      enabled: env.jiraPushEnabled,
      target: env.jiraBaseUrl || '(not configured)',
      project: env.jiraProjectKey,
      issueCount: issues.length,
      issues,
    })
  }

  if (!env.jiraPushEnabled) {
    return NextResponse.json({ error: 'Jira push is disabled. Set JIRA_PUSH_ENABLED=true.' }, { status: 409 })
  }
  if (!run.backlog_approved_at) {
    return NextResponse.json({ error: 'the backlog is not approved — nothing is pushed before sign-off' }, { status: 409 })
  }

  try {
    const result = await pushToJira(issues)
    await audit({ actorId: user.id, action: 'artifact:push', entityType: 'run', entityId: runId,
                  after: result })
    return NextResponse.json(result, { status: result.failed > 0 ? 207 : 200 })
  } catch (err) {
    await audit({ actorId: user.id, action: 'artifact:push:failed', entityType: 'run', entityId: runId,
                  after: { error: (err as Error).message } })
    return NextResponse.json({ error: (err as Error).message }, { status: 502 })
  }
}
