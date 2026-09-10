import { sql } from '../db/client.ts'

/**
 * D14: append-only. Nothing in the application updates or deletes a row here —
 * "what the AI proposed, what the human changed, who approved it and when" is only
 * true if the record cannot be rewritten afterwards.
 */
export async function audit(entry: {
  actorId: number | null
  action: string
  entityType: string
  entityId?: number | null
  before?: unknown
  after?: unknown
}) {
  await sql`
    INSERT INTO audit_log (actor_id, action, entity_type, entity_id, before, after)
    VALUES (${entry.actorId}, ${entry.action}, ${entry.entityType}, ${entry.entityId ?? null},
            ${entry.before === undefined ? null : sql.json(entry.before as never)},
            ${entry.after === undefined ? null : sql.json(entry.after as never)})`
}
