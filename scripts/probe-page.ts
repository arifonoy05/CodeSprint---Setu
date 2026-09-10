import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const who = process.argv[3] ?? 'ba@bracits.com'
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${who}`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const res = await fetch(`http://127.0.0.1:3000${process.argv[2] ?? '/runs/9'}`, { headers: { cookie } })
const html = await res.text()
console.log(`HTTP ${res.status} as ${u.role}`)
const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '|')
  .split('|').map((s) => s.trim()).filter(Boolean)
console.log(text.slice(0, 46).join(' · '))
console.log('\nDismiss button disabled for this role?',
  /Only a BA can dismiss/.test(html) ? 'YES (blocked)' : 'no (allowed)')
await sql.end()
