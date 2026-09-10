import { chunkFixtureCorpus } from '../lib/rag/ids.ts'
import { llm } from '../lib/ai/client.ts'
import { env } from '../lib/env.ts'

const chunks = await chunkFixtureCorpus('fixtures/loan_disbursement')
const texts = chunks.map((c) => c.text)

const b = await llm.embeddings.create({ model: env.embedModel, input: texts, encoding_format: 'float' })
const dims = [...new Set(b.data.map((d) => d.embedding.length))]
console.log(`batch of ${texts.length}, encoding_format=float -> ${b.data.length} vectors, dims: ${dims.join(', ')}`)

const t0 = Date.now()
for (const t of texts) await llm.embeddings.create({ model: env.embedModel, input: t, encoding_format: 'float' })
console.log(`one-at-a-time: ${texts.length} chunks in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
