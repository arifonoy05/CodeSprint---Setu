import { writeFile } from 'node:fs/promises'
import { sql } from '../lib/db/client.ts'

/** Capture a finished run as a fixture. Run deliberately; the file is committed. */
const RUN = Number(process.argv[2] ?? 9)

const q = async (text: string) => sql.unsafe(text.replace(/:run/g, String(RUN))) as unknown as any[]

const snapshot = {
  capturedFrom: RUN,
  capturedAt: new Date().toISOString(),
  document: (await q(`SELECT filename, mime, text FROM documents
                      WHERE id = (SELECT document_id FROM runs WHERE id = :run)`))[0],
  run: (await q(`SELECT status, llm_model, embed_model, started_at, finished_at,
                        approved_at, backlog_approved_at, progress_done, progress_total
                 FROM runs WHERE id = :run`))[0],
  requirements: await q(`SELECT id, ref, classification, ai_original, edited_text, order_index
                         FROM requirements WHERE run_id = :run ORDER BY order_index`),
  // Embeddings travel with the snapshot. Looking them up at seed time only works on the
  // machine that produced the run; on a clean install the source chunk does not exist.
  chunks: await q(`SELECT id, kind, source_ref, text, embedding::text AS embedding
                   FROM chunks WHERE run_id = :run`),
  findings: await q(`SELECT id, requirement_id, gap_class, merged_classes, merged_into_id, severity,
                            ai_original, edited_text, question, status, ba_verdict, resolution_note
                     FROM findings WHERE run_id = :run ORDER BY id`),
  evidence: await q(`SELECT fe.finding_id, fe.chunk_id FROM finding_evidence fe
                     JOIN findings f ON f.id = fe.finding_id WHERE f.run_id = :run`),
  suppressed: await q(`SELECT requirement_ref, gap_class, raw_evidence, reason, gap
                       FROM suppressed WHERE run_id = :run`),
  stories: await q(`SELECT id, requirement_id, title, criteria, ai_original, edited_text, status
                    FROM stories WHERE run_id = :run ORDER BY id`),
  tasks: await q(`SELECT id, story_id, modules, tables, ai_original, edited_text, status
                  FROM tasks WHERE run_id = :run ORDER BY id`),
  tests: await q(`SELECT id, story_id, kind, from_finding_id, ai_original, edited_text, status
                  FROM test_scenarios WHERE run_id = :run ORDER BY id`),
  links: await q(`SELECT requirement_id, story_id, test_id FROM trace_links WHERE run_id = :run`),
}

await writeFile('fixtures/demo-run.json', JSON.stringify(snapshot, null, 1) + '\n')
console.log(`captured run ${RUN}: ${snapshot.requirements.length} requirements, ` +
            `${snapshot.findings.length} findings, ${snapshot.stories.length} stories, ` +
            `${snapshot.tests.length} tests`)
await sql.end()
