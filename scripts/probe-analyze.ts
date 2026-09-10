import { analyzeRun } from '../lib/pipeline/analyze.ts'
import { sql } from '../lib/db/client.ts'

const runId = Number(process.argv[2] ?? 0) || (
  await sql<{ id: number }[]>`SELECT id FROM runs ORDER BY id DESC LIMIT 1`)[0]!.id
const classes = (process.argv[3] ?? 'failure_path').split(',') as any

await sql`DELETE FROM finding_evidence WHERE finding_id IN (SELECT id FROM findings WHERE run_id=${runId})`
await sql`DELETE FROM findings WHERE run_id = ${runId}`
await sql`DELETE FROM suppressed WHERE run_id = ${runId}`

const r = await analyzeRun(runId, classes)
console.log(`\nrun ${r.runId}  [${classes.join(', ')}]`)
console.log(`  proposed by model  ${r.proposed}`)
console.log(`  suppressed         ${r.suppressed}   (${((r.suppressed / Math.max(r.proposed, 1)) * 100).toFixed(0)}% of proposed)`)
console.log(`  merged away        ${r.merged}`)
console.log(`  shown to the BA    ${r.kept}`)
console.log(`  ${r.seconds.toFixed(1)}s`)

const rows = await sql<any[]>`
  SELECT f.id, r.ref, f.severity, f.question,
         array_agg(fe.chunk_id ORDER BY fe.chunk_id) AS evidence
  FROM findings f
  JOIN requirements r ON r.id = f.requirement_id
  LEFT JOIN finding_evidence fe ON fe.finding_id = f.id
  WHERE f.run_id = ${runId} AND f.merged_into_id IS NULL
  GROUP BY f.id, r.ref, f.severity, f.question ORDER BY r.ref LIMIT 6`
console.log('\nsample findings:')
for (const f of rows)
  console.log(`  ${f.ref} [${f.severity}] ${f.evidence.join(', ')}\n      ${f.question.slice(0, 110)}`)

const sup = await sql<any[]>`SELECT reason, count(*) n FROM suppressed WHERE run_id=${runId} GROUP BY reason`
if (sup.length) console.log('\nsuppressed by reason:'), sup.forEach((s) => console.log(`  ${s.reason}: ${s.n}`))
await sql.end()
