import OpenAI from 'openai'

/**
 * Qualify a candidate model endpoint before committing to it. Checks the three things
 * Setu actually depends on, rather than assuming OpenAI-compatible means compatible.
 *
 *   npx tsx scripts/probe-endpoint.ts http://10.0.0.5:8080/v1 <apiKey>
 */
const baseURL = process.argv[2]
if (!baseURL) { console.error('usage: probe-endpoint.ts <baseURL> [apiKey] [chatModel] [embedModel]'); process.exit(1) }
const client = new OpenAI({ baseURL, apiKey: process.argv[3] || 'not-needed' })

const models = await client.models.list().catch((e) => { console.error(`models.list failed: ${e.message}`); process.exit(1) })
const ids = models.data.map((m) => m.id)
console.log(`reachable — ${ids.length} models\n  ${ids.slice(0, 12).join('\n  ')}${ids.length > 12 ? '\n  …' : ''}`)

const chat = process.argv[4] ?? ids[0]!
const embed = process.argv[5] ?? ids.find((i) => /embed/i.test(i))

const SCHEMA = {
  type: 'json_schema',
  json_schema: { name: 'f', strict: true, schema: { type: 'object',
    properties: { gap: { type: 'string' }, evidence_ids: { type: 'array', items: { type: 'string' } } },
    required: ['gap', 'evidence_ids'], additionalProperties: false } },
}
const ask = async (extra: Record<string, unknown>) => {
  const t0 = Date.now()
  const r = await client.chat.completions.create({
    model: chat,
    messages: [{ role: 'user', content: 'Evidence: [R-1041] retry causes double posting.\nRequirement: disburse in one transaction.\nName one unspecified failure path. Cite only ids shown.' }],
    response_format: SCHEMA as never, ...extra,
  })
  const m = r.choices[0]?.message as any
  return { s: (Date.now() - t0) / 1000, content: m?.content ?? '',
           reasoning: (m?.reasoning ?? m?.reasoning_content ?? '').length }
}

console.log(`\nchat model: ${chat}`)
try {
  const base = await ask({})
  const off = await ask({ reasoning_effort: 'none' })

  // Judge schema compliance on the call shape Setu actually uses — reasoning OFF.
  // Measured on LM Studio: with reasoning on, the model spends its budget thinking and
  // returns EMPTY content, so testing the baseline reports a false failure on an endpoint
  // that works perfectly.
  const parses = (t: string) => { try { JSON.parse(t); return true } catch { return false } }
  console.log(`  json_schema honoured:  ${parses(off.content) ? 'YES' : 'NO — findings will not parse'}`)
  console.log(`  baseline:              ${base.s.toFixed(1)}s, ${base.reasoning} reasoning chars` +
    `${base.content.length === 0 ? ', EMPTY content' : ''}`)
  console.log(`  reasoning_effort=none: ${off.s.toFixed(1)}s, ${off.reasoning} reasoning chars` +
    `  ${off.reasoning === 0 ? '(supported)' : '(IGNORED — runs will be slow)'}`)
  if (base.s > 0 && off.s > 0) console.log(`  speedup with it off:   ${(base.s / off.s).toFixed(1)}x`)
} catch (e) { console.log(`  chat failed: ${(e as Error).message.slice(0, 140)}`) }

if (embed) {
  try {
    const r = await client.embeddings.create({ model: embed, input: 'loan disbursement retry', encoding_format: 'float' })
    const d = r.data[0]!.embedding.length
    console.log(`\nembedding model: ${embed}\n  dimensions: ${d}  ${d === 768 ? '(matches the schema)' : '(MISMATCH — needs a migration and a full re-index)'}`)
  } catch (e) { console.log(`\nembeddings failed: ${(e as Error).message.slice(0, 140)}`) }
} else {
  console.log('\nno embedding model found — Setu needs one on the same endpoint')
}
