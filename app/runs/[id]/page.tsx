import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ListChecks, Network } from 'lucide-react'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { gateState } from '@/lib/actions/run.ts'
import { AppShell } from '@/components/app-shell.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Card, CardContent } from '@/components/ui/card.tsx'
import { DemoBanner } from '@/app/demo-banner.tsx'
import { Finding, type FindingView } from './finding.tsx'
import { Gate } from './gate.tsx'
import { RequirementText } from './requirement.tsx'

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
    <AppShell user={user}>
      {inFlight && <meta httpEquiv="refresh" content="4" />}
      {run.is_demo && <DemoBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/runs" className="link flex items-center gap-1 text-sm opacity-70">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Runs
        </Link>
        <h1 className="text-2xl font-semibold">Run #{run.id}</h1>
        <span className="font-mono text-xs opacity-60">{run.filename} · {run.llm_model}</span>
        <div className="ml-auto flex gap-3 text-sm">
          <Link href={`/runs/${runId}/backlog`} className="link flex items-center gap-1">
            <ListChecks className="h-4 w-4" aria-hidden /> Backlog
          </Link>
          <Link href={`/runs/${runId}/matrix`} className="link flex items-center gap-1">
            <Network className="h-4 w-4" aria-hidden /> Matrix
          </Link>
        </div>
      </div>

      {run.status === 'failed' && (
        <div role="alert" className="alert alert-error mb-4"><span><strong>Failed.</strong> {run.error}</span></div>
      )}

      {inFlight ? (
        <Card className="mb-4">
          <CardContent className="pt-5">
            <div className="mb-2 font-medium">{run.stage ?? run.status}…</div>
            <progress className="progress progress-primary w-full"
                      value={run.progress_done} max={run.progress_total || 1} />
            <p className="mt-2 text-sm opacity-60">
              {run.progress_done} of {run.progress_total} checks · closing this tab is safe.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="stats stats-vertical mb-4 w-full border border-[var(--color-border)] bg-[var(--color-base-100)] sm:stats-horizontal">
          <Stat title="Requirements" value={String(reqs.length)} />
          <Stat title="Findings" value={String(findings.length)} desc={`${stats.undecided} undecided`} />
          {/* D19: a non-zero suppression rate is the evidence the citation filter works. */}
          <Stat title="Suppressed" value={`${stats.suppressed}`}
                desc={`${(suppressionRate * 100).toFixed(0)}% cited outside the retrieved set`} />
          {/* D24: precision comes from ba_verdict alone, never from dismissals. */}
          <Stat title="Signal quality" value={judged ? `${((stats.valid / judged) * 100).toFixed(0)}%` : '—'}
                desc={judged ? `${stats.valid} of ${judged} worth asking` : 'not yet judged'} />
          {/* D27: elapsed wall clock, not BA-only time. */}
          <Stat title="Elapsed" value={`${elapsed} min`} desc="wall clock since upload" />
        </div>
      )}

      {!inFlight && run.status !== 'failed' && (
        <Gate runId={runId} undecided={gate.undecided} approved={gate.approved}
              approvedBy={approver?.name ?? null}
              approvedAt={run.approved_at ? String(run.approved_at) : null}
              canApprove={can(user.role, 'srs:approve')} />
      )}

      <div className="grid gap-4">
        {reqs.map((r) => {
          const fs = findings.filter((f) => f.requirement_id === r.id)
          return (
            <Card key={r.id}>
              <CardContent className="pt-5">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="font-semibold">{r.ref}</h3>
                  <Badge variant="outline">{r.classification.replace('_', ' ')}</Badge>
                  {fs.length > 0 && <Badge variant="secondary">{fs.length} finding{fs.length === 1 ? '' : 's'}</Badge>}
                </div>
                <RequirementText id={r.id} aiOriginal={r.ai_original} editedText={r.edited_text}
                                 locked={gate.approved} />
                {fs.length === 0 ? (
                  <p className="text-sm opacity-50">No gaps found.</p>
                ) : (
                  <div className="grid gap-3">
                    {fs.map((f) => (
                      <Finding key={f.id} f={f} canDismiss={can(user.role, 'finding:dismiss')}
                               locked={gate.approved} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </AppShell>
  )
}

function Stat({ title, value, desc }: { title: string; value: string; desc?: string }) {
  return (
    <div className="stat">
      <div className="stat-title text-xs">{title}</div>
      <div className="stat-value text-2xl">{value}</div>
      {desc && <div className="stat-desc max-w-[15rem] whitespace-normal text-xs">{desc}</div>}
    </div>
  )
}
