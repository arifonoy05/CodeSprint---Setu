import { sql } from '../db/client.ts'
import { embed, toVector } from '../ai/embed.ts'
import type { ChunkKind, SourceChunk } from './ids.ts'

export type Retrieved = {
  id: string
  kind: ChunkKind
  sourceRef: string
  text: string
  score: number
}

/** Idempotent: re-indexing updates in place rather than duplicating. */
export async function upsertChunks(chunks: SourceChunk[], runId: number | null = null) {
  if (chunks.length === 0) return 0
  const vectors = await embed(chunks.map((c) => c.text))

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!
    await sql`
      INSERT INTO chunks (id, kind, run_id, source_ref, text, embedding)
      VALUES (${c.id}, ${c.kind}, ${runId}, ${c.sourceRef}, ${c.text}, ${toVector(vectors[i]!)}::vector)
      ON CONFLICT (id) DO UPDATE SET
        kind = EXCLUDED.kind, run_id = EXCLUDED.run_id,
        source_ref = EXCLUDED.source_ref, text = EXCLUDED.text,
        embedding = EXCLUDED.embedding`
  }
  return chunks.length
}

async function topK(vec: string, kind: ChunkKind, k: number, runId: number | null) {
  const rows = await sql<
    { id: string; kind: ChunkKind; source_ref: string; text: string; score: number }[]
  >`
    SELECT id, kind, source_ref, text,
           1 - (embedding <=> ${vec}::vector) AS score
    FROM chunks
    WHERE kind = ${kind}
      AND (run_id IS NULL OR run_id = ${runId})
    ORDER BY embedding <=> ${vec}::vector
    LIMIT ${k}`
  return rows.map((r) => ({
    id: r.id, kind: r.kind, sourceRef: r.source_ref, text: r.text, score: Number(r.score),
  }))
}

/**
 * D8: each gap check retrieves its own evidence, with a quota per kind.
 *
 * One query per kind rather than one ranked list across kinds. Prose RCAs otherwise
 * out-score source code against a prose requirement and crowd it out entirely — measured,
 * that dropped retrieval@k from 0.82 to 0.73. Quotas guarantee each kind its slots.
 *
 * D23: run scoping is not optional — a check must never reach another run's requirements.
 */
export async function retrieve(opts: {
  query: string
  quotas: Partial<Record<ChunkKind, number>>
  runId: number | null
}): Promise<Retrieved[]> {
  const [vec] = await embed([opts.query])
  const v = toVector(vec!)
  const groups = await Promise.all(
    Object.entries(opts.quotas).map(([kind, k]) => topK(v, kind as ChunkKind, k!, opts.runId)),
  )
  return groups.flat().sort((a, b) => b.score - a.score)
}
