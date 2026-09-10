import { writeFile } from 'node:fs/promises'
import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'
import { coverageFor } from '../lib/export/coverage.ts'

const RUN = 9
const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
}
const get = async (email: string, format: string) => {
  const res = await fetch(`http://127.0.0.1:3000/api/runs/${RUN}/export?format=${format}`,
    { headers: { cookie: await cookieFor(email) } })
  const type = res.headers.get('content-type') ?? ''
  return { status: res.status, type, res }
}

console.log('coverage:', JSON.stringify(await coverageFor(RUN)).slice(0, 120))

console.log('\nRBAC:')
console.log(`  dev  -> ${(await get('dev@bracits.com', 'xlsx')).status}`)
console.log(`  pm   -> ${(await get('pm@bracits.com', 'xlsx')).status}`)

console.log('\nat 100% coverage:')
for (const f of ['xlsx', 'docx']) {
  const { status, type, res } = await get('ba@bracits.com', f)
  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`  ${f} -> HTTP ${status}, ${buf.length} bytes, ${type.split(';')[0]}`)
  if (status === 200) await writeFile(`/tmp/setu-run${RUN}.${f}`, buf)
}

// Break coverage deliberately — an untested gate is decoration.
console.log('\nnow dismissing every story on one requirement:')
const [victim] = await sql<any[]>`
  SELECT r.id, r.ref FROM requirements r WHERE r.run_id=${RUN} ORDER BY r.order_index DESC LIMIT 1`
await sql`UPDATE stories SET status='dismissed' WHERE requirement_id=${victim.id}`
const broken = await coverageFor(RUN)
console.log(`  coverage now ${(broken.percent * 100).toFixed(0)}% — unmapped: ${broken.unmapped.map((u) => u.ref + ' (' + u.missing + ')').join(', ')}`)
const blocked = await get('ba@bracits.com', 'xlsx')
console.log(`  xlsx -> HTTP ${blocked.status}`)
console.log(`  ${(await blocked.res.text()).slice(0, 180)}`)
const stillOk = await get('ba@bracits.com', 'docx')
console.log(`  docx -> HTTP ${stillOk.status} (question sheet is pre-sign-off, not gated)`)

await sql`UPDATE stories SET status='proposed' WHERE requirement_id=${victim.id}`
console.log(`\nrestored — coverage ${((await coverageFor(RUN)).percent * 100).toFixed(0)}%`)
await sql.end()
