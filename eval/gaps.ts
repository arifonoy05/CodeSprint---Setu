import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { sql } from '../lib/db/client.ts'
import { migrate } from '../lib/db/migrate.ts'
import { upsertChunks } from '../lib/rag/store.ts'
import { retrieve } from '../lib/rag/store.ts'
import { analyzeRun } from '../lib/pipeline/analyze.ts'
import { CHECKS, GAP_CLASSES, type GapClass } from '../lib/rag/checks.ts'
import { normaliseId } from '../lib/pipeline/postprocess.ts'
import { env } from '../lib/env.ts'

/**
 * D11/D12: gap quality, scored against the answer key's own requirement list.
 *
 * The frozen set is the answer key's `requirements`, never a live extraction — a captured
 * run renumbers and rephrases, so gap entries keyed to REQ-007 would point at a different
 * requirement and this would still print a confident number.
 */
type Gap = { id: string; req: string; gap_class: GapClass; evidence: string[]; assumes: string; note: string }

const truth = parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as {
  requirements: { ref: string; text: string; classification: string }[]
  gaps: Gap[]
}

await migrate()

// --- a dedicated eval run holding the frozen requirement set ---------------
const [doc] = await sql<{ id: number }[]>`
  INSERT INTO documents (filename, mime, text)
  VALUES ('ground_truth.frozen', 'text/plain', ${truth.requirements.map((r) => r.text).join('\n')})
  RETURNING id`
const [run] = await sql<{ id: number }[]>`
  INSERT INTO runs (document_id, status, llm_model, embed_model)
  VALUES (${doc!.id}, 'analyzing', ${env.llmModel}, ${env.embedModel}) RETURNING id`
const runId = run!.id

for (const [i, r] of truth.requirements.entries()) {
  await sql`INSERT INTO requirements (run_id, ref, classification, ai_original, order_index)
            VALUES (${runId}, ${r.ref}, ${r.classification}, ${r.text}, ${i})`
}
await upsertChunks(
  truth.requirements.map((r) => ({
    id: `${r.ref}@${runId}`, kind: 'requirement' as const, sourceRef: r.ref, text: r.text,
  })),
  runId,
)

console.log(`eval run ${runId} — ${truth.requirements.length} frozen requirements, ${truth.gaps.length} planted gaps\n`)

// --- retrieval@k, before any reasoning -------------------------------------
const retrievalHit: Record<string, [number, number]> = {}
for (const g of truth.gaps) {
  const got = await retrieve({ query: truth.requirements.find((r) => r.ref === g.req)!.text,
                               quotas: CHECKS[g.gap_class].quotas, runId })
  const ids = new Set(got.map((r) => normaliseId(r.id.replace(/@\d+$/, ''))))
  const want = g.evidence.map((e) => normaliseId(e))
  const ok = want.some((w) => ids.has(w))
  retrievalHit[g.gap_class] ??= [0, 0]
  retrievalHit[g.gap_class]![1]++
  if (ok) retrievalHit[g.gap_class]![0]++
}

// --- the run ---------------------------------------------------------------
const report = await analyzeRun(runId, [...GAP_CLASSES])
console.log(`analysed in ${report.seconds.toFixed(0)}s — proposed ${report.proposed}, ` +
            `suppressed ${report.suppressed}, merged ${report.merged}, shown ${report.kept}\n`)

// --- match findings against planted gaps (D12 strict) ----------------------
const found = await sql<{ ref: string; gap_class: string; merged_classes: string[]; evidence: string[] }[]>`
  SELECT r.ref, f.gap_class, f.merged_classes,
         coalesce(array_agg(fe.chunk_id) FILTER (WHERE fe.chunk_id IS NOT NULL), '{}') AS evidence
  FROM findings f
  JOIN requirements r ON r.id = f.requirement_id
  LEFT JOIN finding_evidence fe ON fe.finding_id = f.id
  WHERE f.run_id = ${runId} AND f.merged_into_id IS NULL
  GROUP BY f.id, r.ref, f.gap_class, f.merged_classes`

const norm = (ids: string[]) => new Set(ids.map((e) => normaliseId(e.replace(/@\d+$/, ''))))

const matchedGaps = new Set<string>()
const looseGaps = new Set<string>()
const usedFindings = new Set<number>()

for (const g of truth.gaps) {
  const want = norm(g.evidence)
  found.forEach((f, i) => {
    const classes = new Set([f.gap_class, ...(f.merged_classes ?? [])])
    if (f.ref !== g.req || !classes.has(g.gap_class)) return
    looseGaps.add(g.id)
    if ([...norm(f.evidence)].some((e) => want.has(e))) {
      matchedGaps.add(g.id)
      usedFindings.add(i)
    }
  })
}

// --- report ----------------------------------------------------------------
console.log('per check — strict recall, and whether retrieval was the limiting factor:\n')
console.log('  check           planted  strict  loose  retrieval@k')
for (const cls of GAP_CLASSES) {
  const planted = truth.gaps.filter((g) => g.gap_class === cls)
  const strict = planted.filter((g) => matchedGaps.has(g.id)).length
  const loose = planted.filter((g) => looseGaps.has(g.id)).length
  const [rh, rt] = retrievalHit[cls] ?? [0, 0]
  const degenerate = cls === 'missing_ac' ? '  (degenerate by construction)' : ''
  console.log(`  ${cls.padEnd(15)} ${String(planted.length).padStart(4)}` +
    `${(strict / planted.length).toFixed(2).padStart(9)}${(loose / planted.length).toFixed(2).padStart(7)}` +
    `${rt ? (rh / rt).toFixed(2).padStart(12) : '-'.padStart(12)}${degenerate}`)
}

const strictRecall = matchedGaps.size / truth.gaps.length
const looseRecall = looseGaps.size / truth.gaps.length
const suppressionRate = report.suppressed / Math.max(report.proposed, 1)
const unplanted = found.length - usedFindings.size

console.log(`\n  strict recall      ${strictRecall.toFixed(2)}   ${strictRecall >= 0.6 ? 'PASS' : 'FAIL'}  (target >= 0.60, headline)`)
console.log(`  loose recall       ${looseRecall.toFixed(2)}         (diagnostic — right gap, wrong evidence)`)
console.log(`  suppression rate   ${suppressionRate.toFixed(2)}         (D19 — evidence the citation filter works)`)
console.log(`  unplanted findings ${unplanted}            (counted, never scored as errors — D12)`)
console.log(`\n  precision is NOT computed here — it comes from ba_verdict in review sessions (D24).`)

const missed = truth.gaps.filter((g) => !matchedGaps.has(g.id))
if (missed.length) {
  console.log(`\nmissed (${missed.length}):`)
  for (const g of missed)
    console.log(`  ${g.id} ${g.req} ${g.gap_class.padEnd(14)} [${g.assumes}] ${g.note.slice(0, 70)}`)
}

await sql.end()
