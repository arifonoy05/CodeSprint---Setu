'use server'

import { revalidatePath } from 'next/cache'
import { sql } from '../db/client.ts'
import { requireUser } from '../auth/session.ts'
import { can } from '../auth/roles.ts'
import { audit } from '../auth/audit.ts'
import { ALLOW_EXTERNAL, getPolicy } from '../model/policy.ts'

/**
 * Allowing models outside the network contradicts the BRD's central requirement, so the
 * decision is attributed and reversible: who changed it, when, and why.
 */
export async function setExternalPolicy(allow: boolean, reason: string) {
  const user = await requireUser()
  if (!can(user.role, 'model:configure')) {
    throw new Error(`${user.role} is not permitted to change the network policy`)
  }
  if (allow && reason.trim().length < 10) {
    throw new Error('Give a reason — this is recorded against your name and shown on the health page.')
  }

  const before = await getPolicy()
  await sql`
    INSERT INTO app_settings (key, value, reason, set_by, set_at)
    VALUES (${ALLOW_EXTERNAL}, ${allow}, ${allow ? reason.trim() : null}, ${user.id}, now())
    ON CONFLICT (key) DO UPDATE SET
      value = EXCLUDED.value, reason = EXCLUDED.reason,
      set_by = EXCLUDED.set_by, set_at = EXCLUDED.set_at`

  await audit({
    actorId: user.id, action: allow ? 'policy:allow-external' : 'policy:deny-external',
    entityType: 'app_settings',
    before: { allowExternal: before.allowExternal, reason: before.reason },
    after: { allowExternal: allow, reason: allow ? reason.trim() : null },
  })
  revalidatePath('/settings/model')
  revalidatePath('/health')
}
