import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email='ba@bracits.com'`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const html = await (await fetch('http://127.0.0.1:3000/runs/9', { headers: { cookie } })).text()
const head = html.slice(0, html.indexOf('REQ-'))
const bits = head.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '|')
  .split('|').map((s) => s.trim()).filter(Boolean)
console.log(bits.join('\n'))
await sql.end()
