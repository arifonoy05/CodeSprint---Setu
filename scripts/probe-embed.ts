import { chunkFixtureCorpus } from '../lib/rag/ids.ts'
import { llm } from '../lib/ai/client.ts'
import { env } from '../lib/env.ts'

const chunks = await chunkFixtureCorpus('fixtures/loan_disbursement')
console.log('individually:')
let n768 = 0
for (const c of chunks) {
  const r = await llm.embeddings.create({ model: env.embedModel, input: c.text })
  const d = r.data[0]!.embedding.length
  if (d === 768) n768++
  else console.log(`  ${c.id.padEnd(45)} ${String(c.text.length).padStart(5)} chars -> ${d} dims`)
}
console.log(`  ${n768}/${chunks.length} returned 768`)
