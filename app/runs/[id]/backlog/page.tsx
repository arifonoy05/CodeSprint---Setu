import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Network, CheckCircle2 } from 'lucide-react'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { AppShell } from '@/components/app-shell.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Card, CardContent } from '@/components/ui/card.tsx'
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
           s.id AS story_id, s.criteria, s.ai_original AS s_orig, s.edited_text AS s_edit, s.status AS s_status
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

  // D10: roles land on the artifact they care about.
  const view = user.role === 'dev' ? 'tasks' : user.role === 'qa' ? 'tests' : 'all'
  const elapsedMin = run.backlog_approved_at
    ? Math.round((Date.parse(run.backlog_approved_at) - Date.parse(run.started_at)) / 60000)
    : null
  const hasStories = rows.some((r) => r.story_id)

  return (
    <AppShell user={user}>
      {run.is_demo && <DemoBanner />}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href={`/runs/${runId}`} className="link flex items-center gap-1 text-sm opacity-70">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Findings
        </Link>
        <h1 className="text-2xl font-semibold">Backlog</h1>
        <span className="font-mono text-xs opacity-60">{run.filename}</span>
        {view !== 'all' && <Badge variant="info">{view} view · {user.role}</Badge>}
        <Link href={`/runs/${runId}/matrix`} className="link ml-auto flex items-center gap-1 text-sm">
          <Network className="h-4 w-4" aria-hidden /> Matrix
        </Link>
      </div>

      {!run.approved_at && (
        <div role="status" className="alert alert-warning mb-4">
          <span>The requirements are not approved yet. Nothing is generated before sign-off.</span>
        </div>
      )}

      {run.approved_at && !hasStories && !generating && (
        <div className="mb-4"><GenerateButton runId={runId} label="Generate backlog" /></div>
      )}

      {generating && (
        <>
          <meta httpEquiv="refresh" content="5" />
          <Card className="mb-4"><CardContent className="pt-5">
            <div className="mb-2 font-medium">Drafting the backlog…</div>
            <progress className="progress progress-primary w-full"
                      value={run.progress_done} max={run.progress_total || 1} />
            <p className="mt-2 text-sm opacity-60">{run.progress_done}/{run.progress_total} requirements</p>
          </CardContent></Card>
        </>
      )}

      {run.backlog_approved_at ? (
        <div role="status" className="alert alert-success mb-4">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          <span>
            <strong>Backlog approved</strong> by {run.backlog_approver}
            {/* D27: the interval that matters runs to HERE, not to SRS sign-off. */}
            {elapsedMin !== null && <> — {elapsedMin} min from upload to approved backlog</>}
          </span>
        </div>
      ) : hasStories && can(user.role, 'backlog:approve') ? (
        <div className="mb-4"><ApproveBacklog runId={runId} pendingCount={pend!.n} /></div>
      ) : null}

      <div className="grid gap-4">
        {rows.filter((r) => r.story_id).map((r) => {
          const st = tasks.filter((t) => t.story_id === r.story_id)
          const sc = tests.filter((t) => t.story_id === r.story_id)
          return (
            <Card key={r.story_id}>
              <CardContent className="pt-5">
                <div className="mb-1 text-xs opacity-60">{r.ref} — {r.req_text}</div>
                <Artifact kind="stories" id={r.story_id} text={r.s_edit ?? r.s_orig}
                          aiOriginal={r.s_orig} status={r.s_status} className="text-lg font-semibold" />

                {view !== 'tasks' && (r.criteria ?? []).length > 0 && (
                  <ul className="mt-2 grid gap-1 text-sm">
                    {(r.criteria as any[]).map((c, i) => (
                      <li key={i} className="rounded-[var(--radius)] bg-[var(--color-base-200)] px-3 py-2">
                        <b>Given</b> {c.given} <b>When</b> {c.when} <b>Then</b> {c.then}
                      </li>
                    ))}
                  </ul>
                )}

                {view !== 'tests' && st.length > 0 && (
                  <section className="mt-4">
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">Development tasks</h4>
                    <div className="divide-y divide-[var(--color-border)]">
                      {st.map((t) => (
                        <Artifact key={t.id} kind="tasks" id={t.id} text={t.edited_text ?? t.ai_original}
                                  aiOriginal={t.ai_original} status={t.status}
                                  meta={<span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                                    {[...(t.modules ?? []), ...(t.tables ?? [])].map((m: string) => (
                                      <code key={m} className="badge badge-ghost badge-sm font-mono">{m}</code>
                                    ))}
                                  </span>} />
                      ))}
                    </div>
                  </section>
                )}

                {view !== 'tasks' && sc.length > 0 && (
                  <section className="mt-4">
                    <h4 className="mb-1 text-xs font-medium uppercase tracking-wide opacity-60">Test scenarios</h4>
                    <div className="divide-y divide-[var(--color-border)]">
                      {sc.map((t) => (
                        <Artifact key={t.id} kind="test_scenarios" id={t.id} text={t.edited_text ?? t.ai_original}
                                  aiOriginal={t.ai_original} status={t.status}
                                  meta={<>
                                    <Badge variant={t.kind === 'negative' ? 'warning' : 'secondary'} className="ml-1">{t.kind}</Badge>
                                    {t.from_finding_id && (
                                      <Badge variant="info" className="ml-1" title={t.gap_question ?? ''}>
                                        covers a reviewed gap
                                      </Badge>
                                    )}
                                  </>} />
                      ))}
                    </div>
                  </section>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </AppShell>
  )
}
