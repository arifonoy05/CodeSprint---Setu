import { readFile } from 'node:fs/promises'
import { readDocument } from '../lib/ingest/read.ts'
import { extractRun } from '../lib/pipeline/extract.ts'
import { retrieve } from '../lib/rag/store.ts'
import { CHECKS } from '../lib/rag/checks.ts'
import { sql } from '../lib/db/client.ts'

const text = await readDocument('srs_draft.docx', await readFile('fixtures/srs_draft.docx'))
const [ba] = await sql<{ id: number }[]>`SELECT id FROM users WHERE email='ba@bracits.com'`

const ids: number[] = []
for (const name of ['srs_draft.docx', 'srs_draft_copy.docx']) {
  const [d] = await sql<{ id: number }[]>`
    INSERT INTO documents (filename, mime, text, uploaded_by)
    VALUES (${name}, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ${text}, ${ba!.id}) RETURNING id`
  const { runId, count } = await extractRun(d!.id)
  console.log(`run ${runId}: ${count} requirements from ${name}`)
  ids.push(runId)
}

console.log('\nD23 — does a check ever reach another run\'s requirements?')
for (const runId of ids) {
  const got = await retrieve({
    query: 'The system shall record each disbursement with a ledger reference.',
    quotas: CHECKS.missing_ac.quotas,
    runId,
  })
  const foreign = got.filter((r) => !r.id.endsWith(`@${runId}`))
  console.log(`  run ${runId}: retrieved ${got.map((r) => r.id).join(', ')}`)
  console.log(`            foreign chunks: ${foreign.length === 0 ? 'none ✓' : foreign.map((f) => f.id).join(', ') + ' ✗'}`)
}

const [{ n }] = await sql<{ n: string }[]>`SELECT count(*) AS n FROM chunks WHERE kind='requirement'`
console.log(`\nrequirement chunks in db across all runs: ${n}`)
await sql.end()
