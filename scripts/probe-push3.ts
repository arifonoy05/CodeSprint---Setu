import { buildJiraPayload, pushToJira } from '../lib/export/jira.ts'
import { sql } from '../lib/db/client.ts'
const issues = await buildJiraPayload(9)
try { await pushToJira(issues.slice(0, 1)) }
catch (e) { console.log(`  REFUSED — ${(e as Error).message}`) }
await sql.end()
