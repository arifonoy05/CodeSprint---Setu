import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { chunkFixtureCorpus } from '../lib/rag/ids.ts'

/**
 * The fixtures are the measuring instrument. If a planted gap cites evidence that does
 * not exist, every quality number computed from it is quietly wrong — and the eval will
 * still print a confident figure. So this fails loudly, and CI runs it.
 */

const ROOT = 'fixtures/loan_disbursement'
const GAP_CLASSES = ['missing_ac', 'failure_path', 'contradiction', 'dependency'] as const
const MIN_PER_CLASS = 6 // D18: fewer and recall moves in jumps too large to tune against

type Gap = {
  id: string
  req: string
  gap_class: (typeof GAP_CLASSES)[number]
  evidence: string[]        // every chunk a BA would accept — what the eval matches on
  evidence_core: string[]   // the originally authored one or two, kept for audit
  assumes: string
  note: string
}
type Requirement = { ref: string; text: string; classification: string }

const errors: string[] = []
const fail = (m: string) => errors.push(m)

const truth = parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as {
  requirements: Requirement[]
  gaps: Gap[]
}
const assumptionsDoc = await readFile(`${ROOT}/ASSUMPTIONS.md`, 'utf8')
const srs = await readFile('fixtures/srs_draft.md', 'utf8')

const corpusIds = new Set((await chunkFixtureCorpus(ROOT)).map((c) => c.id))
const reqIds = new Set(truth.requirements.map((r) => r.ref))
const assumptionIds = new Set([...assumptionsDoc.matchAll(/^### (A\d+)\b/gm)].map((m) => m[1]!))

// The SRS must not be pre-numbered, or extraction is a regex and proves nothing (D11).
if (/\bREQ-\d+/.test(srs)) fail('srs_draft.md contains requirement numbering — extraction becomes trivial')

// Every citation must resolve. This is the closed set findings will be filtered against (D3).
for (const g of truth.gaps) {
  if (!reqIds.has(g.req)) fail(`${g.id}: unknown requirement ${g.req}`)
  if (!GAP_CLASSES.includes(g.gap_class)) fail(`${g.id}: unknown gap class ${g.gap_class}`)
  if (!assumptionIds.has(g.assumes)) fail(`${g.id}: assumption ${g.assumes} is not in ASSUMPTIONS.md`)
  if (g.evidence.length === 0) fail(`${g.id}: cites no evidence`)
  if (!g.evidence_core?.length) fail(`${g.id}: has no evidence_core — the audit trail for widening`)
  for (const e of [...g.evidence, ...(g.evidence_core ?? [])]) {
    if (!corpusIds.has(e) && !reqIds.has(e)) fail(`${g.id}: cites ${e}, which does not exist`)
  }
  // Widening may only ADD. Dropping a core citation would be quietly moving the goalposts.
  for (const e of g.evidence_core ?? []) {
    if (!g.evidence.includes(e)) fail(`${g.id}: evidence_core ${e} was dropped from evidence — widening must only add`)
  }
  // missing_ac cites requirements (D3); the other three must cite the system itself.
  if (g.gap_class !== 'missing_ac' && g.evidence.every((e) => reqIds.has(e)))
    fail(`${g.id}: ${g.gap_class} cites only requirements, never the system`)
}

const dupes = truth.gaps.map((g) => g.id).filter((id, i, a) => a.indexOf(id) !== i)
if (dupes.length) fail(`duplicate gap ids: ${dupes.join(', ')}`)

for (const cls of GAP_CLASSES) {
  const n = truth.gaps.filter((g) => g.gap_class === cls).length
  if (n < MIN_PER_CLASS) fail(`only ${n} ${cls} gaps — need at least ${MIN_PER_CLASS} (D18)`)
}

// --- report ---------------------------------------------------------------
console.log(`corpus       ${corpusIds.size} chunks`)
console.log(`requirements ${truth.requirements.length}`)
console.log(`gaps         ${truth.gaps.length}\n`)
for (const cls of GAP_CLASSES) {
  console.log(`  ${cls.padEnd(15)} ${truth.gaps.filter((g) => g.gap_class === cls).length}`)
}
const widened = truth.gaps.reduce((n, g) => n + g.evidence.length - (g.evidence_core?.length ?? 0), 0)
console.log(`evidence     ${truth.gaps.reduce((n, g) => n + (g.evidence_core?.length ?? 0), 0)} core + ${widened} widened`)

console.log('\nby assumption (blast radius if a BA overturns one):')
for (const a of [...assumptionIds].sort()) {
  const n = truth.gaps.filter((g) => g.assumes === a).length
  console.log(`  ${a}  ${String(n).padStart(2)} gap${n === 1 ? '' : 's'}`)
}
const unused = [...assumptionIds].filter((a) => !truth.gaps.some((g) => g.assumes === a))
if (unused.length) console.log(`\nnote: ${unused.join(', ')} carry no planted gaps`)

if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s):`)
  errors.forEach((e) => console.error(`  - ${e}`))
  process.exit(1)
}
console.log('\n✓ fixtures valid')
