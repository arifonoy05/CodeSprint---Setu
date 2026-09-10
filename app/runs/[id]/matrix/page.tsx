import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { DemoBanner } from '@/app/demo-banner.tsx'
import { coverageFor } from '@/lib/export/coverage.ts'
import { JiraDryRun } from './push.tsx'

export const dynamic = 'force-dynamic'

export default async function Matrix({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const runId = Number((await params).id)
  const [run] = await sql<any[]>`
    SELECT r.id, r.is_demo, d.filename FROM runs r JOIN documents d ON d.id = r.document_id WHERE r.id = ${runId}`
  if (!run) notFound()

  const cov = await coverageFor(runId)
  const rows = await sql<any[]>`
    SELECT r.ref, coalesce(r.edited_text, r.ai_original) AS requirement,
           coalesce(s.edited_text, s.ai_original) AS story, s.status AS s_status,
           coalesce(ts.edited_text, ts.ai_original) AS test, ts.kind, ts.status AS t_status,
           ts.from_finding_id IS NOT NULL AS from_gap
    FROM trace_links tl
    JOIN requirements r ON r.id = tl.requirement_id
    LEFT JOIN stories s ON s.id = tl.story_id
    LEFT JOIN test_scenarios ts ON ts.id = tl.test_id
    WHERE tl.run_id = ${runId} ORDER BY r.order_index, s.id, ts.id`

  const full = cov.percent >= 1
  const canExport = can(user.role, 'artifact:export')

  return (
    <main>
      {run.is_demo && <DemoBanner />}
      <p><Link href={`/runs/${runId}`}>← Findings</Link> · <Link href={`/runs/${runId}/backlog`}>Backlog</Link></p>
      <h1 style={{ marginBottom: '.2rem' }}>Traceability — run #{runId}</h1>
      <p style={{ color: '#666', marginTop: 0 }}>{run.filename}</p>

      <section style={{ padding: '.9rem 1rem', borderRadius: 6,
                        background: full ? '#eef7ee' : '#fff8e6',
                        border: `1px solid ${full ? '#cde3cd' : '#eadfc0'}` }}>
        <strong>Coverage {(cov.percent * 100).toFixed(0)}%</strong> — {cov.complete} of {cov.total} requirements
        map to at least one story and one test.
        {!full && (
          <>
            <p style={{ margin: '.4rem 0 .2rem', color: '#654' }}>
              Export is blocked until every approved requirement is covered:
            </p>
            <ul style={{ margin: 0 }}>
              {cov.unmapped.map((u) => <li key={u.ref}><strong>{u.ref}</strong> — {u.missing}</li>)}
            </ul>
          </>
        )}
        {canExport && (
          <p style={{ margin: '.7rem 0 0' }}>
            <a href={`/api/runs/${runId}/export?format=xlsx`}
               style={{ pointerEvents: full ? 'auto' : 'none', opacity: full ? 1 : 0.45 }}>
              Download backlog (XLSX)
            </a>
            {' · '}
            <a href={`/api/runs/${runId}/export?format=docx`}>Download client question sheet (DOCX)</a>
          </p>
        )}
        {can(user.role, 'artifact:push') && <JiraDryRun runId={runId} />}
      </section>

      <table cellPadding={7} style={{ borderCollapse: 'collapse', width: '100%', marginTop: '1rem', fontSize: '.92em' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
          <th style={{ width: 90 }}>Requirement</th><th>Story</th><th>Test scenario</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => {
            const first = i === 0 || rows[i - 1]!.ref !== r.ref
            return (
              <tr key={i} style={{ borderTop: first ? '1px solid #ccc' : '1px solid #f2f2f2' }}>
                <td style={{ verticalAlign: 'top' }}>
                  {first && <><strong>{r.ref}</strong>
                    <div style={{ color: '#888', fontSize: '.85em' }}>{r.requirement.slice(0, 70)}…</div></>}
                </td>
                <td style={{ verticalAlign: 'top', opacity: r.s_status === 'dismissed' ? 0.45 : 1 }}>
                  {r.story ?? <em style={{ color: '#b60' }}>no story</em>}
                </td>
                <td style={{ verticalAlign: 'top', opacity: r.t_status === 'dismissed' ? 0.45 : 1 }}>
                  {r.test ?? <em style={{ color: '#b60' }}>no test</em>}
                  {r.kind === 'negative' && <span style={{ color: '#b60', fontSize: '.85em' }}> · negative</span>}
                  {r.from_gap && <span style={{ color: '#04569c', fontSize: '.82em' }}> · covers a reviewed gap</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </main>
  )
}
