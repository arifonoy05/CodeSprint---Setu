'use server'

import { revalidatePath } from 'next/cache'
import { sql } from '../db/client.ts'
import { requireUser } from '../auth/session.ts'
import { can } from '../auth/roles.ts'
import { audit } from '../auth/audit.ts'
import { enqueueGenerate } from '../queue.ts'
import { modelBlocker } from '../model/config.ts'

export async function startGeneration(runId: number) {
  const user = await requireUser()
  if (!can(user.role, 'srs:approve')) throw new Error(`${user.role} may not generate the backlog`)
  const blocked = await modelBlocker()
  if (blocked) throw new Error(`${blocked.reason}. ${blocked.detail}`)
  const [run] = await sql<any[]>`SELECT approved_at FROM runs WHERE id = ${runId}`
  if (!run?.approved_at) throw new Error('nothing is generated before sign-off')

  await sql`UPDATE runs SET stage = 'queued', error = NULL WHERE id = ${runId}`
  await enqueueGenerate({ runId })
  await audit({ actorId: user.id, action: 'backlog:generate', entityType: 'run', entityId: runId })
  revalidatePath(`/runs/${runId}/backlog`)
}

type Kind = 'stories' | 'tasks' | 'test_scenarios'
const TABLE: Record<Kind, string> = { stories: 'stories', tasks: 'tasks', test_scenarios: 'test_scenarios' }

/** D14: same immutable-original shape as findings, for every generated artifact. */
export async function decideArtifact(kind: Kind, id: number, patch: {
  status?: 'accepted' | 'edited' | 'dismissed'
  editedText?: string | null
}) {
  const user = await requireUser()
  const t = TABLE[kind]
  const [before] = await sql.unsafe(
    `SELECT id, run_id, status, edited_text FROM ${t} WHERE id = $1`, [id]) as any[]
  if (!before) throw new Error('not found')

  await sql.unsafe(
    `UPDATE ${t} SET status = $1, edited_text = $2, decided_by = $3, decided_at = now() WHERE id = $4`,
    [patch.status ?? before.status,
     patch.editedText === undefined ? before.edited_text : patch.editedText,
     user.id, id])

  await audit({ actorId: user.id, action: `${kind}:decide`, entityType: kind, entityId: id,
                before: { status: before.status, edited_text: before.edited_text },
                after: { status: patch.status ?? before.status, edited_text: patch.editedText } })
  revalidatePath(`/runs/${before.run_id}/backlog`)
}

/** D27: the interval that matters ends here, not at SRS sign-off. */
export async function approveBacklog(runId: number) {
  const user = await requireUser()
  if (!can(user.role, 'backlog:approve')) throw new Error(`${user.role} may not approve the backlog`)

  const [pending] = await sql<any[]>`
    SELECT (SELECT count(*)::int FROM stories WHERE run_id=${runId} AND status='proposed')
         + (SELECT count(*)::int FROM tasks WHERE run_id=${runId} AND status='proposed')
         + (SELECT count(*)::int FROM test_scenarios WHERE run_id=${runId} AND status='proposed') AS n`
  if (pending!.n > 0) throw new Error(`${pending!.n} backlog item(s) still need a decision`)

  await sql`UPDATE runs SET backlog_approved_at = now(), backlog_approved_by = ${user.id}
            WHERE id = ${runId} AND backlog_approved_at IS NULL`
  await audit({ actorId: user.id, action: 'backlog:approve', entityType: 'run', entityId: runId })
  revalidatePath(`/runs/${runId}/backlog`)
}
