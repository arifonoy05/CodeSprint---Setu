import { readFile } from 'node:fs/promises'
import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

/**
 * Invoke the REAL server actions over HTTP — the code path every button in the demo uses.
 * Everything else has been validated by re-implementing the logic in SQL, which proves
 * the intent but not the wiring.
 */
const manifest = JSON.parse(await readFile('/tmp/srm.json', 'utf8')).node as Record<string, any>
const idFor = (name: string) =>
  Object.entries(manifest).find(([, v]) => v.exportedName === name)![0]

const cookieFor = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id,email,name,role FROM users WHERE email=${email}`
  return `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`
}

async function invoke(name: string, args: unknown[], as = 'ba@bracits.com', page = '/runs') {
  const res = await fetch(`http://127.0.0.1:3000${page}`, {
    method: 'POST',
    headers: {
      'Next-Action': idFor(name),
      'Content-Type': 'text/plain;charset=UTF-8',
      cookie: await cookieFor(as),
    },
    body: JSON.stringify(args),
    redirect: 'manual',
  })
  const text = await res.text()
  const err = /"digest":"([^"]*)"/.exec(text)?.[1]
             ?? /Error: ([^\\"\n]{5,90})/.exec(text)?.[1]
  return { status: res.status, err }
}

const [demo] = await sql<any[]>`SELECT id FROM runs WHERE is_demo ORDER BY id DESC LIMIT 1`
const runId = demo.id
// The demo run is already approved; make a working copy that is not.
await sql`UPDATE runs SET approved_at = NULL, approved_by = NULL, backlog_approved_at = NULL WHERE id = ${runId}`
const [f] = await sql<any[]>`
  SELECT id FROM findings WHERE run_id = ${runId} AND merged_into_id IS NULL ORDER BY id LIMIT 1`
const [q] = await sql<any[]>`SELECT id FROM requirements WHERE run_id = ${runId} ORDER BY order_index LIMIT 1`

console.log('invoking the real server actions:\n')

const r1 = await invoke('decideFinding', [{ findingId: f.id, status: 'accepted', baVerdict: 'valid' }])
const [after1] = await sql<any[]>`SELECT status, ba_verdict, decided_by FROM findings WHERE id=${f.id}`
console.log(`  decideFinding      HTTP ${r1.status}  -> status=${after1.status} verdict=${after1.ba_verdict} decided_by=${after1.decided_by ? 'set' : 'NULL'}`)

const r2 = await invoke('editRequirement', [q.id, 'Revised by the BA after the client meeting.'])
const [after2] = await sql<any[]>`SELECT edited_text, ai_original FROM requirements WHERE id=${q.id}`
console.log(`  editRequirement    HTTP ${r2.status}  -> edited=${after2.edited_text ? 'yes' : 'no'} original_intact=${after2.ai_original ? 'yes' : 'no'}`)

const r3 = await invoke('decideFinding', [{ findingId: f.id, status: 'dismissed' }], 'qa@bracits.com')
console.log(`  dismiss as QA      HTTP ${r3.status}  -> ${r3.err ?? 'no error surfaced'}`)

const r4 = await invoke('approveRun', [runId], 'qa@bracits.com')
console.log(`  approveRun as QA   HTTP ${r4.status}  -> ${r4.err ?? 'no error surfaced'}`)

const r5 = await invoke('approveRun', [runId])
const [after5] = await sql<any[]>`SELECT approved_at IS NOT NULL AS ok FROM runs WHERE id=${runId}`
console.log(`  approveRun as BA   HTTP ${r5.status}  -> approved=${after5.ok} ${r5.err ?? ''}`)

const r6 = await invoke('editRequirement', [q.id, 'trying to edit after approval'])
console.log(`  edit after approve HTTP ${r6.status}  -> ${r6.err ?? 'NO ERROR — gate leaked'}`)

const [st] = await sql<any[]>`SELECT id FROM stories WHERE run_id=${runId} ORDER BY id LIMIT 1`
const r7 = await invoke('decideArtifact', ['stories', st.id, { status: 'accepted' }])
const [after7] = await sql<any[]>`SELECT status FROM stories WHERE id=${st.id}`
console.log(`  decideArtifact     HTTP ${r7.status}  -> story status=${after7.status}`)

const [audits] = await sql<any[]>`
  SELECT count(*)::int AS n FROM audit_log WHERE at > now() - interval '2 minutes'`
console.log(`\n  audit rows written by these actions: ${audits.n}`)
await sql.end()
