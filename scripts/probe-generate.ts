import { generateBacklog } from '../lib/pipeline/generate.ts'
import { sql } from '../lib/db/client.ts'

const RUN = Number(process.argv[2] ?? 9)

console.log('gate check — an unapproved run must refuse:')
const [unapproved] = await sql<any[]>`SELECT id FROM runs WHERE approved_at IS NULL ORDER BY id DESC LIMIT 1`
if (unapproved) {
  try { await generateBacklog(unapproved.id); console.log('  ✗ GENERATED — gate broken') }
  catch (e) { console.log(`  ✓ refused: ${(e as Error).message}`) }
}

const t0 = Date.now()
await generateBacklog(RUN)
console.log(`\ngenerated in ${((Date.now() - t0) / 1000).toFixed(0)}s`)

const [c] = await sql<any[]>`
  SELECT (SELECT count(*)::int FROM stories WHERE run_id=${RUN}) AS stories,
         (SELECT count(*)::int FROM tasks WHERE run_id=${RUN}) AS tasks,
         (SELECT count(*)::int FROM test_scenarios WHERE run_id=${RUN}) AS tests,
         (SELECT count(*)::int FROM test_scenarios WHERE run_id=${RUN} AND kind='negative') AS negative,
         (SELECT count(*)::int FROM test_scenarios WHERE run_id=${RUN} AND from_finding_id IS NOT NULL) AS from_gap,
         (SELECT count(*)::int FROM trace_links WHERE run_id=${RUN}) AS links`
console.log(`  stories ${c.stories} · tasks ${c.tasks} · tests ${c.tests} (${c.negative} negative, ${c.from_gap} seeded from a reviewed gap) · trace links ${c.links}`)

const [cov] = await sql<any[]>`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM trace_links t WHERE t.requirement_id=r.id AND t.story_id IS NOT NULL))::int AS with_story,
         count(*) FILTER (WHERE EXISTS (SELECT 1 FROM trace_links t WHERE t.requirement_id=r.id AND t.test_id IS NOT NULL))::int AS with_test
  FROM requirements r WHERE r.run_id=${RUN}`
console.log(`  coverage: ${cov.with_story}/${cov.total} have a story, ${cov.with_test}/${cov.total} have a test`)

const sample = await sql<any[]>`
  SELECT s.title, s.criteria,
         (SELECT json_agg(json_build_object('t', t.ai_original, 'm', t.modules, 'tb', t.tables))
          FROM tasks t WHERE t.story_id=s.id) AS tasks
  FROM stories s WHERE s.run_id=${RUN} ORDER BY s.id LIMIT 1`
const s = sample[0]!
console.log(`\nsample story:\n  ${s.title}`)
for (const c2 of s.criteria.slice(0, 2)) console.log(`    Given ${c2.given}\n    When ${c2.when}\n    Then ${c2.then}`)
console.log('  tasks:')
for (const t of (s.tasks ?? []).slice(0, 3))
  console.log(`    - ${t.t}\n        modules=[${t.m}] tables=[${t.tb}]`)
await sql.end()
