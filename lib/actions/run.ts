'use server'

import { revalidatePath } from 'next/cache'
import { sql } from '../db/client.ts'
import { requireUser } from '../auth/session.ts'
import { can } from '../auth/roles.ts'
import { audit } from '../auth/audit.ts'

/** Anything that changes a run's inputs is refused once it is approved. */
export async function assertNotApproved(runId: number) {
  const [run] = await sql<any[]>`SELECT approved_at FROM runs WHERE id = ${runId}`
  if (!run) throw new Error('run not found')
  if (run.approved_at) throw new Error('This run is approved. The requirement set is fixed.')
}

/**
 * D26: no document versioning. The BA revises the requirement in place and records what
 * the client said on the finding. `ai_original` is untouched, so the diff remains the
 * audit record (D14).
 */
export async function editRequirement(requirementId: number, text: string) {
  const user = await requireUser()
  const [before] = await sql<any[]>`
    SELECT id, run_id, ai_original, edited_text FROM requirements WHERE id = ${requirementId}`
  if (!before) throw new Error('requirement not found')
  await assertNotApproved(before.run_id)

  const next = text.trim() === before.ai_original.trim() ? null : text.trim()
  await sql`UPDATE requirements SET edited_text = ${next} WHERE id = ${requirementId}`
  await audit({ actorId: user.id, action: 'requirement:edit', entityType: 'requirement',
                entityId: requirementId,
                before: { edited_text: before.edited_text }, after: { edited_text: next } })
  revalidatePath(`/runs/${before.run_id}`)
}

export type GateState = { ready: boolean; undecided: number; approved: boolean }

export async function gateState(runId: number): Promise<GateState> {
  const [row] = await sql<any[]>`
    SELECT (SELECT count(*)::int FROM findings f
            WHERE f.run_id = ${runId} AND f.merged_into_id IS NULL AND f.status = 'proposed') AS undecided,
           (SELECT approved_at IS NOT NULL FROM runs WHERE id = ${runId}) AS approved`
  return { undecided: row!.undecided, approved: row!.approved, ready: row!.undecided === 0 }
}

/**
 * The human gate. Nothing is generated, exported or pushed before this (BRD section 4).
 *
 * Approval fixes the requirement set: `assertNotApproved` refuses every later edit, so
 * what the backlog is generated from is exactly what was signed off.
 */
export async function approveRun(runId: number) {
  const user = await requireUser()
  if (!can(user.role, 'srs:approve')) {
    throw new Error(`${user.role} is not permitted to approve the requirements`)
  }

  const state = await gateState(runId)
  if (state.approved) throw new Error('already approved')
  if (!state.ready) {
    throw new Error(`${state.undecided} finding(s) still undecided — every finding must be accepted, edited or dismissed first.`)
  }

  await sql`UPDATE runs SET status = 'approved', approved_at = now(), approved_by = ${user.id}
            WHERE id = ${runId} AND approved_at IS NULL`
  await audit({ actorId: user.id, action: 'srs:approve', entityType: 'run', entityId: runId,
                after: { approved: true } })
  revalidatePath(`/runs/${runId}`)
}
