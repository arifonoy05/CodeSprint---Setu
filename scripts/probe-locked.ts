import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email='ba@bracits.com'`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const html = await (await fetch('http://127.0.0.1:3000/runs/9', { headers: { cookie } })).text()
for (const [label, re] of [
  ['approved banner', /Requirements approved/],
  ['fixed-set notice', /requirement set is fixed/],
  ['decisions locked', /Approved — decisions are fixed/],
  ['revise link gone', /&gt;revise&lt;|>revise</],
  ['approve button gone', /Approve requirements/],
] as const) {
  const hit = re.test(html)
  const want = ['revise link gone', 'approve button gone'].includes(label) ? false : true
  console.log(`  ${label.padEnd(20)} ${hit ? 'present' : 'absent '}  ${hit === want ? '✓' : '✗'}`)
}
await sql.end()
