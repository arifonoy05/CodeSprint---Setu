import { sql } from '../lib/db/client.ts'
import { audit } from '../lib/auth/audit.ts'

const [ba] = await sql<{ id: number }[]>`SELECT id FROM users WHERE email='ba@bracits.com'`
await audit({
  actorId: ba!.id, action: 'finding:edit', entityType: 'finding', entityId: 42,
  before: { text: 'what the AI proposed' }, after: { text: 'what the human changed it to' },
})
const rows = await sql<any[]>`
  SELECT a.action, u.role, a.entity_type, a.entity_id, a.before, a.after
  FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 3`
console.log('recent audit rows:')
for (const r of rows)
  console.log(`  ${r.action.padEnd(14)} by ${String(r.role).padEnd(10)} ${r.entity_type}#${r.entity_id ?? '-'}` +
    (r.before ? `\n      before: ${JSON.stringify(r.before)}\n      after:  ${JSON.stringify(r.after)}` : ''))
await sql.end()
