import { buildJiraPayload, pushToJira } from '../lib/export/jira.ts'
import { sql } from '../lib/db/client.ts'

const issues = await buildJiraPayload(9)
console.log(`payload: ${issues.length} issues\n`)

const attempt = async (label: string) => {
  try { const r = await pushToJira(issues.slice(0, 1)); console.log(`  ${label}: pushed=${r.pushed} failed=${r.failed} ${r.errors[0] ?? ''}`) }
  catch (e) { console.log(`  ${label}: REFUSED — ${(e as Error).message.split('.')[0]}`) }
}

process.env.JIRA_PUSH_ENABLED = 'false'
await attempt('flag off                       ')
await sql.end()
