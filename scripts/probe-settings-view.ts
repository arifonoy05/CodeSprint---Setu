import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE role='superadmin' LIMIT 1`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const res = await fetch('http://127.0.0.1:3000/settings/model', { headers: { cookie } })
const html = await res.text()
console.log(`HTTP ${res.status}`)
const fields = [...html.matchAll(/value="([^"]*)"[^>]*placeholder="([^"]*)"|placeholder="([^"]*)"/g)].slice(0, 5)
console.log('current values on the form:')
for (const m of html.matchAll(/<input[^>]*value="([^"]*)"[^>]*>/g)) {
  const v = m[1]; if (v && v.length < 80) console.log(`  ${v}`)
}
console.log('buttons:', [...html.matchAll(/>(Test connection|Save and verify)</g)].map(m => m[1]).join(', '))
await sql.end()
