import { NextResponse } from 'next/server'
import { apiUser, isResponse } from '@/lib/auth/api.ts'
import { audit } from '@/lib/auth/audit.ts'
import { coverageFor } from '@/lib/export/coverage.ts'
import { buildWorkbook } from '@/lib/export/xlsx.ts'
import { buildQuestionSheet } from '@/lib/export/docx.ts'

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await apiUser('artifact:export')
  if (isResponse(user)) return user

  const runId = Number((await ctx.params).id)
  const format = new URL(req.url).searchParams.get('format') ?? 'xlsx'

  if (format === 'xlsx') {
    // D28: below full coverage, refuse and name what is missing.
    const cov = await coverageFor(runId)
    if (cov.percent < 1) {
      return NextResponse.json({
        error: 'Traceability coverage is below 100%.',
        coverage: `${cov.complete}/${cov.total}`,
        unmapped: cov.unmapped,
      }, { status: 409 })
    }
    const buf = await buildWorkbook(runId)
    await audit({ actorId: user.id, action: 'artifact:export', entityType: 'run', entityId: runId,
                  after: { format: 'xlsx' } })
    return new NextResponse(new Uint8Array(buf), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="setu-backlog-run-${runId}.xlsx"`,
    } })
  }

  if (format === 'docx') {
    // The question sheet is for BEFORE sign-off, so coverage does not gate it.
    const buf = await buildQuestionSheet(runId)
    await audit({ actorId: user.id, action: 'artifact:export', entityType: 'run', entityId: runId,
                  after: { format: 'docx' } })
    return new NextResponse(new Uint8Array(buf), { headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="setu-client-questions-run-${runId}.docx"`,
    } })
  }

  return NextResponse.json({ error: `unknown format: ${format}` }, { status: 400 })
}
