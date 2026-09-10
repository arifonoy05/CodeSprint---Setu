import { readFile } from 'node:fs/promises'
import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

const manifest = JSON.parse(await readFile('/tmp/srm.json', 'utf8')).node as Record<string, any>
const idFor = (n: string) => Object.entries(manifest).find(([, v]) => v.exportedName === n)![0]
const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
}
const invoke = async (n: string, args: unknown[], as = 'ba@bracits.com') =>
  (await fetch('http://127.0.0.1:3000/runs', {
    method: 'POST',
    headers: { 'Next-Action': idFor(n), 'Content-Type': 'text/plain;charset=UTF-8', cookie: await cookieFor(as) },
    body: JSON.stringify(args), redirect: 'manual',
  })).status

const [run] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
const [f] = await sql<any[]>`SELECT id FROM findings WHERE run_id=${run.id} AND merged_into_id IS NULL ORDER BY id LIMIT 1`
const [q] = await sql<any[]>`SELECT id FROM requirements WHERE run_id=${run.id} ORDER BY order_index LIMIT 1`

const snap = async () => (await sql<any[]>`
  SELECT (SELECT status FROM findings WHERE id=${f.id}) AS f_status,
         (SELECT edited_text FROM requirements WHERE id=${q.id}) AS q_text`)[0]

console.log('refused operations must change NOTHING:\n')

let before = await snap()
await invoke('decideFinding', [{ findingId: f.id, status: 'dismissed' }], 'qa@bracits.com')
let after = await snap()
console.log(`  QA dismiss:        status ${before.f_status} -> ${after.f_status}  ${before.f_status === after.f_status ? '✓ unchanged' : '✗ MUTATED'}`)

before = await snap()
await invoke('editRequirement', [q.id, 'THIS MUST NOT LAND'], 'ba@bracits.com')
after = await snap()
console.log(`  edit post-approval: text unchanged ${before.q_text === after.q_text ? '✓' : '✗ MUTATED'}`)
console.log(`                      (still "${String(after.q_text).slice(0, 45)}…")`)

const beforeApprovers = (await sql<any[]>`SELECT approved_by FROM runs WHERE id=${run.id}`)[0]
await invoke('approveRun', [run.id], 'pm@bracits.com')
const afterApprovers = (await sql<any[]>`SELECT approved_by FROM runs WHERE id=${run.id}`)[0]
console.log(`  PM approve:         approved_by unchanged ${beforeApprovers.approved_by === afterApprovers.approved_by ? '✓' : '✗ MUTATED'}`)

// Put the stored demo run back the way a demo expects to find it.
await sql`UPDATE findings SET status='accepted', ba_verdict='valid' WHERE run_id=${run.id} AND status='proposed'`
await sql`UPDATE requirements SET edited_text=NULL WHERE id=${q.id}`
console.log('\n  demo run restored')
await sql.end()
