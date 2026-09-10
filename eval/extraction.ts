import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { readDocument } from '../lib/ingest/read.ts'
import { extractRequirements, type ExtractedRequirement } from '../lib/ai/extract.ts'
import { embed } from '../lib/ai/embed.ts'

/**
 * D11: extraction is scored separately from gap quality.
 *
 * The two must not share a number. A bad segmentation run would otherwise silently drag
 * down recall on gap checks that were working fine, and nothing would say which failed.
 */
/**
 * Cosine threshold for "same requirement". Calibrated against the observed distribution,
 * not guessed: every true match scored 0.872-1.000, and the two that 0.88 rejected were
 * the model rephrasing ("Finance requires a daily disbursement report" ->
 * "The system shall provide a daily disbursement report"), not omissions.
 */
const MATCH = 0.85

const cos = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2 }
  return d / Math.sqrt(na * nb)
}

const truth = parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as {
  requirements: { ref: string; text: string; classification: string }[]
}

const text = await readDocument('srs_draft.docx', await readFile('fixtures/srs_draft.docx'))
const got: ExtractedRequirement[] = await extractRequirements(text)

const [truthVecs, gotVecs] = [
  await embed(truth.requirements.map((r) => r.text)),
  await embed(got.map((r) => r.text)),
]

// Greedy 1-1 assignment by descending similarity — one produced requirement may not
// stand in for two expected ones.
const pairs: { t: number; g: number; sim: number }[] = []
for (let t = 0; t < truthVecs.length; t++)
  for (let g = 0; g < gotVecs.length; g++)
    pairs.push({ t, g, sim: cos(truthVecs[t]!, gotVecs[g]!) })
pairs.sort((a, b) => b.sim - a.sim)

const tUsed = new Set<number>(), gUsed = new Set<number>()
const matched: typeof pairs = []
for (const p of pairs) {
  if (p.sim < MATCH || tUsed.has(p.t) || gUsed.has(p.g)) continue
  tUsed.add(p.t); gUsed.add(p.g); matched.push(p)
}

const recall = matched.length / truth.requirements.length
const precision = matched.length / got.length
const classOk = matched.filter(
  (p) => truth.requirements[p.t]!.classification === got[p.g]!.classification,
).length

console.log(`expected ${truth.requirements.length}   extracted ${got.length}   matched ${matched.length}\n`)
console.log(`  segmentation recall     ${recall.toFixed(2)}`)
console.log(`  segmentation precision  ${precision.toFixed(2)}`)
console.log(`  classification accuracy ${(classOk / matched.length).toFixed(2)}  (${classOk}/${matched.length} matched)`)

const missed = truth.requirements.filter((_, i) => !tUsed.has(i))
if (missed.length) {
  console.log(`\nnot extracted (${missed.length}):`)
  missed.forEach((r) => console.log(`  ${r.ref}  ${r.text.slice(0, 88)}`))
}
const spurious = got.filter((_, i) => !gUsed.has(i))
if (spurious.length) {
  console.log(`\nextracted but not expected (${spurious.length}):`)
  spurious.forEach((r) => console.log(`  ${r.ref}  ${r.text.slice(0, 88)}`))
}
const misclassified = matched.filter((p) => truth.requirements[p.t]!.classification !== got[p.g]!.classification)
if (misclassified.length) {
  console.log(`\nmisclassified (${misclassified.length}):`)
  misclassified.forEach((p) =>
    console.log(`  ${truth.requirements[p.t]!.ref}  expected ${truth.requirements[p.t]!.classification}, got ${got[p.g]!.classification}`))
}
