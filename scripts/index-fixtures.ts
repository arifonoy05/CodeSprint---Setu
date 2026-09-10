import { chunkFixtureCorpus } from '../lib/rag/ids.ts'
import { upsertChunks } from '../lib/rag/store.ts'
import { migrate } from '../lib/db/migrate.ts'
import { sql } from '../lib/db/client.ts'

await migrate()
const chunks = await chunkFixtureCorpus('fixtures/loan_disbursement')
const t0 = Date.now()
const n = await upsertChunks(chunks, null) // KB chunks are corpus-scoped (D23)
console.log(`indexed ${n} chunks in ${((Date.now() - t0) / 1000).toFixed(1)}s`)

const [{ count }] = await sql<{ count: string }[]>`SELECT count(*) FROM chunks`
const byKind = await sql<{ kind: string; n: string }[]>`
  SELECT kind, count(*) AS n FROM chunks GROUP BY kind ORDER BY kind`
console.log(`total in db: ${count}`)
byKind.forEach((r) => console.log(`  ${r.kind.padEnd(12)} ${r.n}`))
await sql.end()
