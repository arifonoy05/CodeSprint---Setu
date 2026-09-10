import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE role='superadmin' LIMIT 1`
const cookie = `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
const html = await (await fetch('http://127.0.0.1:3000/health', { headers: { cookie } })).text()
const txt = html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,'|').split('|').map(s=>s.trim()).filter(Boolean)
console.log('  ' + txt.slice(txt.indexOf('Health')+1, txt.indexOf('Health')+20).join(' · '))
await sql.end()
