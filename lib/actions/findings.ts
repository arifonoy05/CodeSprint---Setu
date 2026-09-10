'use server'

import { revalidatePath } from 'next/cache'
import { sql } from '../db/client.ts'
import { requireUser } from '../auth/session.ts'
import { can } from '../auth/roles.ts'
import { audit } from '../auth/audit.ts'
import { assertNotApproved } from './run.ts'

export type Decision = {
  findingId: number
  status?: 'accepted' | 'edited' | 'dismissed'
  editedText?: string | null
  /** D24: a separate question from the workflow action. Precision comes from this alone. */
  baVerdict?: 'valid' | 'invalid' | null
  resolutionNote?: string | null
}

/**
 * D14: `ai_original` is never touched. A human edit goes to `edited_text`, so the diff
 * between them IS the audit record — "what the AI proposed, what the human changed".
 */
export async function decideFinding(d: Decision) {
  const user = await requireUser()

  const [before] = await sql<any[]>`
    SELECT id, run_id, status, ba_verdict, edited_text, resolution_note, ai_original
    FROM findings WHERE id = ${d.findingId}`
  if (!before) throw new Error('finding not found')
  await assertNotApproved(before.run_id) // the gate fixes the run's inputs

  // Only dismissal gates (D10). Accepting, editing and judging are open to any reviewer.
  if (d.status === 'dismissed' && !can(user.role, 'finding:dismiss')) {
    throw new Error(`${user.role} is not permitted to dismiss a finding`)
  }

  const status = d.status ?? before.status
  const [after] = await sql<any[]>`
    UPDATE findings SET
      status          = ${status},
      edited_text     = ${d.editedText === undefined ? before.edited_text : d.editedText},
      ba_verdict      = ${d.baVerdict === undefined ? before.ba_verdict : d.baVerdict},
      resolution_note = ${d.resolutionNote === undefined ? before.resolution_note : d.resolutionNote},
      decided_by      = ${user.id},
      decided_at      = now()
    WHERE id = ${d.findingId}
    RETURNING id, status, ba_verdict, edited_text, resolution_note`

  await audit({
    actorId: user.id, action: 'finding:decide', entityType: 'finding', entityId: d.findingId,
    before: { status: before.status, ba_verdict: before.ba_verdict, edited_text: before.edited_text },
    after: { status: after!.status, ba_verdict: after!.ba_verdict, edited_text: after!.edited_text },
  })

  revalidatePath(`/runs/${before.run_id}`)
}
