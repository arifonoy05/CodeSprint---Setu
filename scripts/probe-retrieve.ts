import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { retrieve } from '../lib/rag/store.ts'
import { sql } from '../lib/db/client.ts'
import { CHECKS } from '../lib/rag/checks.ts'

const truth = parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as {
  requirements: { ref: string; text: string }[]
  gaps: { id: string; req: string; gap_class: string; evidence: string[] }[]
}
const reqText = new Map(truth.requirements.map((r) => [r.ref, r.text]))
const reqRefs = new Set(truth.requirements.map((r) => r.ref))

let hit = 0, total = 0
const perCheck: Record<string, [number, number]> = {}

for (const g of truth.gaps) {
  const cfg = g.gap_class === 'missing_ac' ? null : CHECKS[g.gap_class as keyof typeof CHECKS]
  if (!cfg) continue // missing_ac retrieves requirements, which are not indexed yet (ticket 06)
  const wanted = g.evidence.filter((e) => !reqRefs.has(e))
  if (wanted.length === 0) continue

  const got = await retrieve({ query: reqText.get(g.req)!, quotas: cfg.quotas, runId: null })
  const ids = new Set(got.map((r) => r.id))
  const found = wanted.filter((w) => ids.has(w))
  const ok = found.length > 0

  total++; if (ok) hit++
  perCheck[g.gap_class] ??= [0, 0]
  perCheck[g.gap_class]![1]++; if (ok) perCheck[g.gap_class]![0]++

  if (!ok) console.log(`  MISS ${g.id} ${g.req} ${g.gap_class}\n       wanted ${wanted.join(', ')}\n       got    ${[...ids].join(', ')}`)
}

console.log('\nretrieval@k — did the planted evidence come back?')
for (const [c, [h, t]] of Object.entries(perCheck))
  console.log(`  ${c.padEnd(15)} ${h}/${t}  ${(h / t).toFixed(2)}`)
console.log(`  ${'OVERALL'.padEnd(15)} ${hit}/${total}  ${(hit / total).toFixed(2)}`)

console.log('\nsample — REQ-006 (generate schedule automatically), dependency quotas:')
for (const r of await retrieve({ query: reqText.get('REQ-006')!, quotas: CHECKS.dependency.quotas, runId: null }))
  console.log(`  ${r.score.toFixed(3)}  ${r.id.padEnd(10)} ${r.sourceRef}`)

await sql.end()
