import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email='ba@bracits.com'`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`

const r = await fetch('http://127.0.0.1:3000/demo', { headers: { cookie }, redirect: 'manual' })
const target = r.headers.get('location') ?? ''
console.log(`/demo -> ${r.status} ${target}`)

const [demo] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
for (const path of [`/runs/${demo.id}`, `/runs/${demo.id}/backlog`, `/runs/${demo.id}/matrix`]) {
  const res = await fetch(`http://127.0.0.1:3000${path}`, { headers: { cookie } })
  const html = await res.text()
  console.log(`  ${path.padEnd(22)} HTTP ${res.status}  banner:${/Stored run\./.test(html) ? 'yes' : 'NO'}` +
    `  content:${/REQ-00/.test(html) ? 'yes' : 'no'}`)
}
const list = await (await fetch('http://127.0.0.1:3000/runs', { headers: { cookie } })).text()
console.log(`  /runs list marks it stored: ${/>stored</.test(list) ? 'yes' : 'NO'}`)

const exp = await fetch(`http://127.0.0.1:3000/api/runs/${demo.id}/export?format=xlsx`, { headers: { cookie } })
console.log(`  export from stored run:     HTTP ${exp.status}, ${(await exp.arrayBuffer()).byteLength} bytes`)
await sql.end()
