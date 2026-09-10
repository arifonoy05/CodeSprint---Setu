import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [open] = await sql<any[]>`
  SELECT id FROM runs WHERE approved_at IS NULL AND status='review' ORDER BY id DESC LIMIT 1`
const [demo] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
for (const [label, runId] of [['approved run', demo.id], ['open run', open?.id]] as const) {
  if (!runId) { console.log(`${label}: none available`); continue }
  for (const email of ['ba@bracits.com', 'qa@bracits.com']) {
    const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
    const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
    const html = await (await fetch(`http://127.0.0.1:3000/runs/${runId}`, { headers: { cookie } })).text()
    console.log(`${label.padEnd(13)} ${u.role.padEnd(3)} ` +
      `locked-notice:${/Approved — decisions are fixed/.test(html) ? 'y' : 'n'} ` +
      `dismiss-button:${/Dismiss/.test(html) ? 'y' : 'n'} ` +
      `dismiss-blocked-title:${/Only a BA can dismiss/.test(html) ? 'y' : 'n'}`)
  }
}
await sql.end()
