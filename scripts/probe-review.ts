import { sql } from '../lib/db/client.ts'
import { audit } from '../lib/auth/audit.ts'

/** Exercise the decision layer directly — server actions are not callable over raw HTTP. */
const RUN = Number(process.argv[2] ?? 9)
const [ba] = await sql<any[]>`SELECT id FROM users WHERE email='ba@bracits.com'`
const fs = await sql<any[]>`
  SELECT id, ai_original FROM findings WHERE run_id=${RUN} AND merged_into_id IS NULL ORDER BY id LIMIT 4`

const apply = async (id: number, patch: Record<string, unknown>) => {
  const [before] = await sql<any[]>`SELECT status, ba_verdict, edited_text FROM findings WHERE id=${id}`
  await sql`UPDATE findings SET
      status = ${(patch.status as string) ?? before.status},
      edited_text = ${patch.edited_text === undefined ? before.edited_text : (patch.edited_text as string)},
      ba_verdict = ${patch.ba_verdict === undefined ? before.ba_verdict : (patch.ba_verdict as string)},
      resolution_note = coalesce(${(patch.resolution_note as string) ?? null}, resolution_note),
      decided_by=${ba!.id}, decided_at=now() WHERE id=${id}`
  await audit({ actorId: ba!.id, action: 'finding:decide', entityType: 'finding', entityId: id,
                before, after: patch })
}

await apply(fs[0]!.id, { status: 'accepted', ba_verdict: 'valid' })
await apply(fs[1]!.id, { status: 'edited', edited_text: 'BA rewrote this in their own words.', ba_verdict: 'valid' })
// D24's whole point: dismissed but still worth asking.
await apply(fs[2]!.id, { status: 'dismissed', ba_verdict: 'valid', resolution_note: 'Client confirmed; already covered by CR-88.' })
await apply(fs[3]!.id, { status: 'dismissed', ba_verdict: 'invalid' })

const rows = await sql<any[]>`
  SELECT id, status, ba_verdict, (edited_text IS NOT NULL) AS edited,
         (ai_original IS NOT NULL) AS original_kept, resolution_note IS NOT NULL AS has_note
  FROM findings WHERE id = ANY(${fs.map((f) => f.id)}) ORDER BY id`
console.log('after review:')
for (const r of rows)
  console.log(`  #${r.id} status=${r.status.padEnd(9)} verdict=${String(r.ba_verdict).padEnd(7)} edited=${r.edited} original_kept=${r.original_kept} note=${r.has_note}`)

const [p] = await sql<any[]>`
  SELECT count(*) FILTER (WHERE ba_verdict='valid')::int AS valid,
         count(*) FILTER (WHERE ba_verdict='invalid')::int AS invalid,
         count(*) FILTER (WHERE status='dismissed')::int AS dismissed
  FROM findings WHERE run_id=${RUN}`
console.log(`\nD24 check — precision from ba_verdict, NOT from dismissals:`)
console.log(`  valid ${p.valid}, invalid ${p.invalid}  ->  precision ${(p.valid / (p.valid + p.invalid)).toFixed(2)}`)
console.log(`  dismissed ${p.dismissed} — of which ${rows.filter((r) => r.status === 'dismissed' && r.ba_verdict === 'valid').length} were still judged worth asking`)
console.log(`  had precision been derived from status it would read ${(1 - p.dismissed / rows.length).toFixed(2)} — wrong`)
await sql.end()
