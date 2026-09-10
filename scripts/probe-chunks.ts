import { chunkFixtureCorpus } from '../lib/rag/ids.ts'
const c = await chunkFixtureCorpus('fixtures/loan_disbursement')
console.log('total chunks:', c.length)
for (const k of ['ddl', 'code', 'rca'] as const) {
  const g = c.filter((x) => x.kind === k)
  console.log(`\n[${k}] ${g.length}`)
  g.forEach((x) => console.log('  ', x.id.padEnd(46), x.sourceRef))
}
