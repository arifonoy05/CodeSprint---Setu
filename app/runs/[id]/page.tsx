import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { DemoBanner } from '@/app/demo-banner.tsx'
import { Finding, type FindingView } from './finding.tsx'
import { Gate } from './gate.tsx'
import { RequirementText } from './requirement.tsx'
import { gateState } from '@/lib/actions/run.ts'

export const dynamic = 'force-dynamic'

export default async function Run({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const runId = Number((await params).id)

  const [run] = await sql<any[]>`
    SELECT r.*, d.filename FROM runs r JOIN documents d ON d.id = r.document_id WHERE r.id = ${runId}`
  if (!run) notFound()

  const inFlight = ['extracting', 'indexing', 'analyzing'].includes(run.status)
  const reqs = await sql<any[]>`
    SELECT id, ref, classification, ai_original, edited_text
    FROM requirements WHERE run_id = ${runId} ORDER BY order_index`

  const findings = await sql<(FindingView & { requirement_id: number })[]>`
    SELECT f.id, f.requirement_id, f.gap_class, f.merged_classes, f.severity,
           f.ai_original, f.edited_text, f.question, f.status, f.ba_verdict, f.resolution_note,
           u.name AS decided_by_name, f.decided_at,
           coalesce(json_agg(json_build_object('id', c.id, 'ref', c.source_ref,
                                               'kind', c.kind, 'text', c.text))
                    FILTER (WHERE c.id IS NOT NULL), '[]') AS evidence
    FROM findings f
    LEFT JOIN users u ON u.id = f.decided_by
    LEFT JOIN finding_evidence fe ON fe.finding_id = f.id
    LEFT JOIN chunks c ON c.id = fe.chunk_id
    WHERE f.run_id = ${runId} AND f.merged_into_id IS NULL
    GROUP BY f.id, u.name
    ORDER BY CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, f.id`

  const [stats] = await sql<any[]>`
    SELECT
      (SELECT count(*)::int FROM suppressed s WHERE s.run_id = ${runId})              AS suppressed,
      (SELECT count(*)::int FROM findings f WHERE f.run_id = ${runId})                AS produced,
      (SELECT count(*)::int FROM findings f WHERE f.run_id = ${runId}
         AND f.merged_into_id IS NULL AND f.status = 'proposed')                      AS undecided,
      (SELECT count(*)::int FROM findings f WHERE f.run_id = ${runId} AND f.ba_verdict = 'valid')   AS valid,
      (SELECT count(*)::int FROM findings f WHERE f.run_id = ${runId} AND f.ba_verdict = 'invalid') AS invalid`

  const gate = await gateState(runId)
  const [approver] = await sql<any[]>`SELECT name FROM users WHERE id = ${run.approved_by}`
  const judged = stats.valid + stats.invalid
  const elapsed = Math.round((Date.parse(run.finished_at ?? new Date().toISOString()) -
                              Date.parse(run.started_at)) / 60000)
  const suppressionRate = stats.produced + stats.suppressed > 0
    ? stats.suppressed / (stats.produced + stats.suppressed) : 0

  return (
    <main>
      {inFlight && <meta httpEquiv="refresh" content="4" />}
      {run.is_demo && <DemoBanner />}
      <p><Link href="/runs">← Runs</Link></p>
      <h1 style={{ marginBottom: '.2rem' }}>Run #{run.id}</h1>
      <p style={{ color: '#666', marginTop: 0 }}>{run.filename} · {run.llm_model}</p>

      {run.status === 'failed' && (
        <p role="alert" style={{ color: '#b00' }}><strong>Failed.</strong> {run.error}</p>
      )}

      {inFlight ? (
        <section style={{ padding: '1rem', background: '#f6f6f6', borderRadius: 6 }}>
          <strong>{run.stage ?? run.status}…</strong>
          {run.progress_total > 0 && (
            <div style={{ height: 8, background: '#ddd', borderRadius: 4, margin: '.6rem 0' }}>
              <div style={{ height: 8, width: `${(run.progress_done / run.progress_total) * 100}%`,
                            background: '#06c', borderRadius: 4 }} />
            </div>
          )}
          <p style={{ color: '#666', marginBottom: 0 }}>
            {run.progress_done} of {run.progress_total} checks · closing this tab is safe.
          </p>
        </section>
      ) : (
        <dl style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', padding: '.8rem 1rem',
                     background: '#f6f6f6', borderRadius: 6, margin: 0 }}>
          <Stat label="Requirements" value={String(reqs.length)} />
          <Stat label="Findings" value={String(findings.length)} />
          <Stat label="Undecided" value={String(stats.undecided)} />
          {/* D19: a non-zero suppression rate is the evidence the citation filter works. */}
          <Stat label="Suppressed" value={`${stats.suppressed} (${(suppressionRate * 100).toFixed(0)}%)`}
                hint="cited evidence outside what was retrieved, so never shown" />
          {/* D24: precision comes from ba_verdict alone, never from dismissals. */}
          <Stat label="Signal quality"
                value={judged ? `${((stats.valid / judged) * 100).toFixed(0)}%` : '—'}
                hint={judged ? `${stats.valid} of ${judged} judged worth asking` : 'not yet judged'} />
          {/* D27: elapsed wall clock, not BA-only time. */}
          <Stat label="Elapsed" value={`${elapsed} min`} hint="wall clock since upload" />
        </dl>
      )}

      {!inFlight && run.status !== 'failed' && (
        <Gate runId={runId} undecided={gate.undecided} approved={gate.approved}
              approvedBy={approver?.name ?? null}
              approvedAt={run.approved_at ? String(run.approved_at) : null}
              canApprove={can(user.role, 'srs:approve')} />
      )}

      {reqs.map((r) => {
        const fs = findings.filter((f) => f.requirement_id === r.id)
        return (
          <section key={r.id} style={{ borderTop: '1px solid #ddd', paddingTop: '.9rem', marginTop: '1.2rem' }}>
            <h3 style={{ margin: 0 }}>
              {r.ref}{' '}
              <span style={{ fontWeight: 400, color: '#888', fontSize: '.75em' }}>
                {r.classification.replace('_', ' ')}
              </span>
            </h3>
            <RequirementText id={r.id} aiOriginal={r.ai_original} editedText={r.edited_text}
                             locked={gate.approved} />
            {fs.length === 0
              ? <p style={{ color: '#888', fontSize: '.9em' }}>No gaps found.</p>
              : fs.map((f) => (
                  <Finding key={f.id} f={f} canDismiss={can(user.role, 'finding:dismiss')}
                           locked={gate.approved} />
                ))}
          </section>
        )
      })}
    </main>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt style={{ fontSize: '.8em', color: '#666' }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: '1.3em', fontWeight: 600 }}>{value}</dd>
      {hint && <div style={{ fontSize: '.72em', color: '#888', maxWidth: 190 }}>{hint}</div>}
    </div>
  )
}
