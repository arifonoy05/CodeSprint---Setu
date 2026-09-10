import { sql } from '../lib/db/client.ts'
const RUN = 9

const state = async () => (await sql<any[]>`
  SELECT (SELECT count(*)::int FROM findings f WHERE f.run_id=${RUN} AND f.merged_into_id IS NULL AND f.status='proposed') AS undecided,
         (SELECT approved_at IS NOT NULL FROM runs WHERE id=${RUN}) AS approved`)[0]

console.log('before:', await state())
console.log('  -> gate must refuse while findings are undecided\n')

// Decide everything, the way a BA working through the list would.
await sql`UPDATE findings SET status='accepted', ba_verdict='valid', decided_at=now(),
          decided_by=(SELECT id FROM users WHERE email='ba@bracits.com')
          WHERE run_id=${RUN} AND merged_into_id IS NULL AND status='proposed'`
console.log('after deciding every finding:', await state())
await sql.end()
