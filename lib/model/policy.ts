import { sql } from '../db/client.ts'

export const ALLOW_EXTERNAL = 'allow_external_llm' as const

export type Policy = {
  allowExternal: boolean
  reason: string | null
  setByName: string | null
  setAt: Date | null
}

/** Default is closed: internal models only, as the BRD requires. */
export async function getPolicy(): Promise<Policy> {
  const [row] = await sql<any[]>`
    SELECT s.value, s.reason, s.set_at, u.name AS set_by_name
    FROM app_settings s LEFT JOIN users u ON u.id = s.set_by
    WHERE s.key = ${ALLOW_EXTERNAL}`
  return {
    allowExternal: row?.value === true,
    reason: row?.reason ?? null,
    setByName: row?.set_by_name ?? null,
    setAt: row?.set_at ?? null,
  }
}
