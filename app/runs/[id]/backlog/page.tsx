import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { DemoBanner } from '@/app/demo-banner.tsx'
import { Artifact } from './artifact.tsx'
import { GenerateButton, ApproveBacklog } from './actions.tsx'

export const dynamic = 'force-dynamic'

export default async function Backlog({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const runId = Number((await params).id)
  const [run] = await sql<any[]>`
    SELECT r.*, d.filename, u.name AS backlog_approver
    FROM runs r JOIN documents d ON d.id = r.document_id
    LEFT JOIN users u ON u.id = r.backlog_approved_by WHERE r.id = ${runId}`
  if (!run) notFound()

  const generating = run.status === 'generating' || run.stage === 'queued'

  const rows = await sql<any[]>`
    SELECT r.id AS req_id, r.ref, coalesce(r.edited_text, r.ai_original) AS req_text,
           s.id AS story_id, s.title, s.criteria, s.ai_original AS s_orig,
           s.edited_text AS s_edit, s.status AS s_status
    FROM requirements r
    LEFT JOIN stories s ON s.requirement_id = r.id
    WHERE r.run_id = ${runId} ORDER BY r.order_index, s.id`

  const tasks = await sql<any[]>`SELECT * FROM tasks WHERE run_id = ${runId} ORDER BY id`
  const tests = await sql<any[]>`
    SELECT t.*, f.question AS gap_question FROM test_scenarios t
    LEFT JOIN findings f ON f.id = t.from_finding_id
    WHERE t.run_id = ${runId} ORDER BY t.id`
  const [pend] = await sql<any[]>`
    SELECT (SELECT count(*)::int FROM stories WHERE run_id=${runId} AND status='proposed')
         + (SELECT count(*)::int FROM tasks WHERE run_id=${runId} AND status='proposed')
         + (SELECT count(*)::int FROM test_scenarios WHERE run_id=${runId} AND status='proposed') AS n`

  const view = user.role === 'dev' ? 'tasks' : user.role === 'qa' ? 'tests' : 'all'
  const elapsedMin = run.backlog_approved_at
    ? Math.round((Date.parse(run.backlog_approved_at) - Date.parse(run.started_at)) / 60000)
    : null

  return (
    <main>
      {run.is_demo && <DemoBanner />}
      <p><Link href={`/runs/${runId}`}>← Findings</Link> · <Link href={`/runs/${runId}/matrix`}>Matrix</Link></p>
      <h1 style={{ marginBottom: '.2rem' }}>Backlog — run #{runId}</h1>
      <p style={{ color: '#666', marginTop: 0 }}>{run.filename}</p>

      {!run.approved_at && (
        <p style={{ padding: '.8rem 1rem', background: '#fff8e6', borderRadius: 6 }}>
          The requirements are not approved yet. Nothing is generated before sign-off.
        </p>
      )}

      {run.approved_at && !rows.some((r) => r.story_id) && !generating && (
        <p><GenerateButton runId={runId} label="Generate backlog" /></p>
      )}

      {generating && (
        <>
          <meta httpEquiv="refresh" content="5" />
          <p style={{ padding: '.8rem 1rem', background: '#f6f6f6', borderRadius: 6 }}>
            Drafting the backlog… {run.progress_done}/{run.progress_total} requirements
          </p>
        </>
      )}

      {run.backlog_approved_at ? (
        <p style={{ padding: '.8rem 1rem', background: '#eef7ee', border: '1px solid #cde3cd', borderRadius: 6 }}>
          <strong>Backlog approved</strong> by {run.backlog_approver}
          {/* D27: the interval that matters runs to HERE, not to SRS sign-off. */}
          {elapsedMin !== null && <> — {elapsedMin} min from upload to approved backlog</>}
        </p>
      ) : rows.some((r) => r.story_id) && can(user.role, 'backlog:approve') ? (
        <p><ApproveBacklog runId={runId} pendingCount={pend!.n} /></p>
      ) : null}

      {rows.filter((r) => r.story_id).map((r) => {
        const st = tasks.filter((t) => t.story_id === r.story_id)
        const sc = tests.filter((t) => t.story_id === r.story_id)
        return (
          <section key={r.story_id} style={{ borderTop: '1px solid #ddd', paddingTop: '.8rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '.8em', color: '#888' }}>{r.ref} — {r.req_text}</div>
            <h3 style={{ margin: '.3rem 0' }}>
              <Artifact kind="stories" id={r.story_id} text={r.s_edit ?? r.s_orig}
                        aiOriginal={r.s_orig} status={r.s_status} />
            </h3>

            {view !== 'tasks' && (r.criteria ?? []).length > 0 && (
              <ul style={{ margin: '.2rem 0 .6rem', color: '#333' }}>
                {(r.criteria as any[]).map((c, i) => (
                  <li key={i}><strong>Given</strong> {c.given} <strong>when</strong> {c.when} <strong>then</strong> {c.then}</li>
                ))}
              </ul>
            )}

            {view !== 'tests' && st.length > 0 && (
              <>
                <h4 style={{ margin: '.4rem 0 .1rem', fontSize: '.9em', color: '#555' }}>Development tasks</h4>
                {st.map((t) => (
                  <Artifact key={t.id} kind="tasks" id={t.id} text={t.edited_text ?? t.ai_original}
                            aiOriginal={t.ai_original} status={t.status}
                            meta={<span style={{ fontSize: '.78em', color: '#777' }}>
                              {[...(t.modules ?? []), ...(t.tables ?? [])].map((m: string) => (
                                <code key={m} style={{ background: '#eee', padding: '0 4px', borderRadius: 3, marginLeft: 4 }}>{m}</code>
                              ))}
                            </span>} />
                ))}
              </>
            )}

            {view !== 'tasks' && sc.length > 0 && (
              <>
                <h4 style={{ margin: '.5rem 0 .1rem', fontSize: '.9em', color: '#555' }}>Test scenarios</h4>
                {sc.map((t) => (
                  <Artifact key={t.id} kind="test_scenarios" id={t.id} text={t.edited_text ?? t.ai_original}
                            aiOriginal={t.ai_original} status={t.status}
                            meta={<>
                              <span style={{ fontSize: '.78em', color: t.kind === 'negative' ? '#b60' : '#777' }}>
                                {' '}{t.kind}
                              </span>
                              {t.from_finding_id && (
                                <span title={t.gap_question ?? ''} style={{ fontSize: '.75em', color: '#04569c',
                                      background: '#eef3fa', padding: '0 5px', borderRadius: 3, marginLeft: 4 }}>
                                  covers a gap raised in review
                                </span>
                              )}
                            </>} />
                ))}
              </>
            )}
          </section>
        )
      })}
    </main>
  )
}
