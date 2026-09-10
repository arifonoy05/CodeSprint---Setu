import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { sql } from '../db/client.ts'

/**
 * D15: the client question sheet — the artifact the BA physically carries into the
 * meeting. Dismissed findings are left out: they were decided, not asked.
 */
export async function buildQuestionSheet(runId: number): Promise<Buffer> {
  const [run] = await sql<any[]>`
    SELECT r.id, d.filename, r.approved_at FROM runs r
    JOIN documents d ON d.id = r.document_id WHERE r.id = ${runId}`

  const rows = await sql<any[]>`
    SELECT q.ref, q.text AS requirement, f.severity, f.question,
           coalesce(f.edited_text, f.ai_original) AS gap,
           f.resolution_note,
           coalesce(string_agg(c.source_ref, ', ' ORDER BY c.source_ref), '') AS evidence
    FROM findings f
    JOIN (SELECT id, ref, coalesce(edited_text, ai_original) AS text, order_index
          FROM requirements) q ON q.id = f.requirement_id
    LEFT JOIN finding_evidence fe ON fe.finding_id = f.id
    LEFT JOIN chunks c ON c.id = fe.chunk_id
    WHERE f.run_id = ${runId} AND f.merged_into_id IS NULL AND f.status <> 'dismissed'
    GROUP BY q.ref, q.text, q.order_index, f.id, f.severity, f.question, f.edited_text, f.ai_original, f.resolution_note
    ORDER BY q.order_index,
             CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`

  const children: Paragraph[] = [
    new Paragraph({ text: 'Questions for the client', heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [
      new TextRun({ text: `${run!.filename} · ${rows.length} open question${rows.length === 1 ? '' : 's'}`, italics: true }),
    ] }),
    new Paragraph({ text: '' }),
    new Paragraph({ children: [new TextRun({
      text: 'Each question below was raised by checking the requirement against the existing ' +
            'system. The evidence column names the file, table or incident it came from.',
      italics: true, size: 20,
    }) ] }),
  ]

  let currentRef = ''
  for (const r of rows) {
    if (r.ref !== currentRef) {
      currentRef = r.ref
      children.push(new Paragraph({ text: '' }))
      children.push(new Paragraph({ text: `${r.ref} — ${r.requirement}`, heading: HeadingLevel.HEADING_2 }))
    }
    children.push(new Paragraph({ children: [
      new TextRun({ text: `[${String(r.severity).toUpperCase()}] `, bold: true }),
      new TextRun({ text: r.question }),
    ] }))
    children.push(new Paragraph({ children: [
      new TextRun({ text: 'Why we are asking: ', bold: true, size: 20 }),
      new TextRun({ text: r.gap, size: 20 }),
    ] }))
    if (r.evidence) {
      children.push(new Paragraph({ children: [
        new TextRun({ text: `Evidence: ${r.evidence}`, italics: true, size: 18 }),
      ] }))
    }
    children.push(new Paragraph({ children: [
      new TextRun({ text: r.resolution_note ? `Client said: ${r.resolution_note}` : 'Client response: ______________________', size: 20 }),
    ] }))
  }

  return Buffer.from(await Packer.toBuffer(new Document({ sections: [{ children }] })))
}
