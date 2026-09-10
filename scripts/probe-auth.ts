import { sealData } from 'iron-session'
import { verify } from '@node-rs/argon2'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
import type { Role } from '../lib/auth/roles.ts'

const BASE = 'http://127.0.0.1:3111'

// --- credential verification, at the layer that actually decides -----------
console.log('credentials:')
for (const [pw, expect] of [['setu-demo-password', true], ['wrong', false]] as const) {
  const [row] = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE email = 'ba@bracits.com'`
  const ok = await verify(row!.password_hash, pw)
  console.log(`  ${pw.padEnd(20)} -> ${ok ? 'accepted' : 'rejected'} ${ok === expect ? '✓' : '✗ WRONG'}`)
}

// --- role landing + RBAC, through the real HTTP boundary -------------------
console.log('\nrendered gates per role:')
const users = await sql<{ id: number; email: string; name: string; role: Role }[]>`
  SELECT id, email, name, role FROM users ORDER BY role`

for (const u of users) {
  const sealed = await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })
  const res = await fetch(`${BASE}/runs`, { headers: { cookie: `setu_session=${sealed}` } })
  const html = await res.text()
  const gates = [...html.matchAll(/(✅|⛔)<\/td><td[^>]*>([a-z:]+)</g)]
  const allowed = gates.filter((m) => m[1] === '✅').map((m) => m[2]!)
  const denied = gates.filter((m) => m[1] === '⛔').map((m) => m[2]!)
  console.log(`  ${u.role.padEnd(11)} HTTP ${res.status}  allow=[${allowed.join(' ')}]  deny=[${denied.join(' ')}]`)
}

// --- a tampered cookie must not authenticate -------------------------------
const forged = await sealData({ user: { id: 1, email: 'x', name: 'x', role: 'superadmin' } },
  { password: 'a-completely-different-secret-32-chars', ttl: 0 })
const bad = await fetch(`${BASE}/runs`, { headers: { cookie: `setu_session=${forged}` }, redirect: 'manual' })
console.log(`\ncookie sealed with the wrong secret -> HTTP ${bad.status} ${bad.headers.get('location') ?? ''}`)

await sql.end()
