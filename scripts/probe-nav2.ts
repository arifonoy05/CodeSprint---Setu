import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [demo] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
for (const email of ['ba@bracits.com', 'dev@bracits.com', 'qa@bracits.com', 'pm@bracits.com']) {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
  const bl = await (await fetch(`http://127.0.0.1:3000/runs/${demo.id}/backlog?view=all`, { headers: { cookie } })).text()
  const mx = await (await fetch(`http://127.0.0.1:3000/runs/${demo.id}/matrix`, { headers: { cookie } })).text()
  const fi = await (await fetch(`http://127.0.0.1:3000/runs/${demo.id}`, { headers: { cookie } })).text()
  console.log(`${u.role.padEnd(4)} approve-backlog:${/Approve backlog/.test(bl) ? 'y' : 'n'}` +
    ` export-links:${/Backlog \(XLSX\)/.test(mx) ? 'y' : 'n'}` +
    ` jira-preview:${/Preview Jira push/.test(mx) ? 'y' : 'n'}` +
    ` dismiss-blocked:${/Only a BA can dismiss/.test(fi) ? 'y' : 'n'}`)
}
await sql.end()
