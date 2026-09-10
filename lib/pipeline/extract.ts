import { sql } from '../db/client.ts'
import { env } from '../env.ts'
import { extractRequirements } from '../ai/extract.ts'
import { upsertChunks } from '../rag/store.ts'
import { requirementId, type SourceChunk } from '../rag/ids.ts'

/**
 * Create a run for a document, extract its requirements, and index them as evidence.
 *
 * D3: requirements are citable evidence, so the missing_ac check has something legitimate
 * to cite and the closed-set filter needs no special case.
 * D23: they are scoped to their run — chunk ids are stable across runs, so without
 * run_id one document's check could retrieve and cite another document's requirements.
 */
export async function extractRun(
  documentId: number,
  existingRunId?: number,
): Promise<{ runId: number; count: number }> {
  const [doc] = await sql<{ text: string }[]>`SELECT text FROM documents WHERE id = ${documentId}`
  if (!doc) throw new Error(`document ${documentId} not found`)

  const runId = existingRunId ?? (
    await sql<{ id: number }[]>`
      INSERT INTO runs (document_id, status, llm_model, embed_model)
      VALUES (${documentId}, 'extracting', ${env.llmModel}, ${env.embedModel})
      RETURNING id`)[0]!.id

  try {
    const reqs = await extractRequirements(doc.text)

    for (const [i, r] of reqs.entries()) {
      await sql`
        INSERT INTO requirements (run_id, ref, classification, ai_original, order_index)
        VALUES (${runId}, ${r.ref}, ${r.classification}, ${r.text}, ${i})`
    }

    // Chunk ids must be unique per run — REQ-001 exists in every run (D23).
    const chunks: SourceChunk[] = reqs.map((r) => ({
      id: `${requirementId(r.ref)}@${runId}`,
      kind: 'requirement',
      sourceRef: r.ref,
      text: r.text,
    }))
    await upsertChunks(chunks, runId)

    await sql`UPDATE runs SET status = 'review' WHERE id = ${runId}`
    return { runId, count: reqs.length }
  } catch (err) {
    await sql`UPDATE runs SET status = 'failed', error = ${(err as Error).message} WHERE id = ${runId}`
    throw err
  }
}
