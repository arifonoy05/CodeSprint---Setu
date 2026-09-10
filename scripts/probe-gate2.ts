import { sql } from '../lib/db/client.ts'
import { audit } from '../lib/auth/audit.ts'
const RUN = 9

// Mirrors approveRun's guards exactly — server actions are not callable over raw HTTP.
const approve = async (email: string) => {
  const [u] = await sql<any[]>`SELECT id, role FROM users WHERE email=${email}`
  const gates: Record<string, string[]> = { 'srs:approve': ['ba', 'superadmin'] }
  if (!gates['srs:approve']!.includes(u.role)) return `REFUSED — ${u.role} may not approve`
  const [g] = await sql<any[]>`
    SELECT count(*)::int AS undecided FROM findings
    WHERE run_id=${RUN} AND merged_into_id IS NULL AND status='proposed'`
  if (g.undecided > 0) return `REFUSED — ${g.undecided} findings undecided`
  const [r] = await sql<any[]>`SELECT approved_at FROM runs WHERE id=${RUN}`
  if (r.approved_at) return 'REFUSED — already approved'
  await sql`UPDATE runs SET status='approved', approved_at=now(), approved_by=${u.id}
            WHERE id=${RUN} AND approved_at IS NULL`
  await audit({ actorId: u.id, action: 'srs:approve', entityType: 'run', entityId: RUN, after: { approved: true } })
  return 'APPROVED'
}

console.log('QA tries to approve: ', await approve('qa@bracits.com'))
console.log('PM tries to approve: ', await approve('pm@bracits.com'))
console.log('BA approves:         ', await approve('ba@bracits.com'))
console.log('BA approves again:   ', await approve('ba@bracits.com'))

const [r] = await sql<any[]>`
  SELECT r.status, u.name AS approver, r.approved_at IS NOT NULL AS stamped
  FROM runs r LEFT JOIN users u ON u.id=r.approved_by WHERE r.id=${RUN}`
console.log(`\nrun ${RUN}: status=${r.status} approved_by=${r.approver} timestamped=${r.stamped}`)

console.log('\nafter approval, are inputs frozen?')
const [run] = await sql<any[]>`SELECT approved_at FROM runs WHERE id=${RUN}`
console.log(`  assertNotApproved would throw: ${run.approved_at ? 'YES — edits refused' : 'no'}`)

const [a] = await sql<any[]>`
  SELECT count(*)::int AS n FROM audit_log WHERE action='srs:approve' AND entity_id=${RUN}`
console.log(`  audit rows for this approval: ${a.n}`)
await sql.end()
