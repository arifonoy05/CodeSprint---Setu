import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
for (const who of ['ba@bracits.com', 'dev@bracits.com', 'qa@bracits.com']) {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${who}`
  const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
  const res = await fetch('http://127.0.0.1:3000/runs/9/backlog', { headers: { cookie } })
  const html = await res.text()
  console.log(`${u.role.padEnd(4)} HTTP ${res.status}  ` +
    `criteria:${/<b>Given<\/b>/.test(html) ? 'y' : 'n'} ` +
    `tasks:${/Development tasks/.test(html) ? 'y' : 'n'} ` +
    `tests:${/Test scenarios/.test(html) ? 'y' : 'n'} ` +
    `gap-linked:${/covers a reviewed gap/.test(html) ? 'y' : 'n'} ` +
    `approve:${/Approve backlog/.test(html) ? 'y' : 'n'}`)
}
await sql.end()
