import { readFile, writeFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { chunkFixtureCorpus } from '../lib/rag/ids.ts'

/** A page a BA can check without reading code — one row per citation, plain English. */
const truth = parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as any
const chunks = new Map((await chunkFixtureCorpus('fixtures/loan_disbursement')).map((c) => [c.id, c]))
const reqs = new Map<string, any>(truth.requirements.map((r: any) => [r.ref, r]))

const describe = (id: string) => {
  if (reqs.has(id)) return `requirement — "${reqs.get(id).text.slice(0, 70)}…"`
  const c = chunks.get(id)
  if (!c) return '(missing)'
  return c.kind === 'ddl' ? `the ${c.sourceRef}`
    : c.kind === 'rca' ? `incident ${c.sourceRef}`
    : `the function ${id.replace(/^C-[^.]+\./, '')}() in ${c.sourceRef.split(':')[0]}`
}

let md = `# Evidence review — for the BA

We measure Setu by planting gaps in a fake system and checking it finds them. A gap counts as
found only if Setu **cites evidence we agreed counts** for that gap.

That list was originally one or two items per gap and turned out too narrow: Setu was finding the
right problems but pointing at different, arguably equally valid, evidence. We widened it by one
rule — *the incident that documents the gap, the function that exhibits it, and the table whose
structure permits it*.

**We need you to check that rule produced sensible lists.** For each gap: would you accept each
item as showing that problem? Mark anything you would not.

Nothing here requires reading code. About fifteen minutes.

---

`
for (const cls of ['missing_ac', 'failure_path', 'contradiction', 'dependency']) {
  md += `## ${cls.replace('_', ' ')}\n\n`
  for (const g of truth.gaps.filter((x: any) => x.gap_class === cls)) {
    md += `### ${g.id} — ${g.req}\n\n**The gap:** ${g.note}\n\n`
    for (const e of g.evidence) {
      const core = (g.evidence_core ?? []).includes(e)
      md += `- [ ] ${describe(e)}${core ? '  *(original)*' : ''}\n`
    }
    md += `\nAnything you would not accept? \n\n`
  }
}
await writeFile('fixtures/EVIDENCE-REVIEW.md', md)
console.log(`wrote fixtures/EVIDENCE-REVIEW.md — ${truth.gaps.length} gaps, ${truth.gaps.reduce((n: number, g: any) => n + g.evidence.length, 0)} citations to check`)
