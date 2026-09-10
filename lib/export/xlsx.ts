import ExcelJS from 'exceljs'
import { sql } from '../db/client.ts'

/** D15: one workbook a delivery lead can open in Excel immediately. */
export async function buildWorkbook(runId: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Setu'
  wb.created = new Date()

  const head = (ws: ExcelJS.Worksheet, cols: [string, number][]) => {
    ws.columns = cols.map(([header, width]) => ({ header, width }))
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const stories = await sql<any[]>`
    SELECT r.ref, coalesce(s.edited_text, s.ai_original) AS title, s.criteria, s.status
    FROM stories s JOIN requirements r ON r.id = s.requirement_id
    WHERE s.run_id = ${runId} ORDER BY r.order_index, s.id`
  const ws1 = wb.addWorksheet('Stories')
  head(ws1, [['Requirement', 14], ['Story', 60], ['Acceptance criteria', 90], ['Status', 12]])
  for (const s of stories) {
    ws1.addRow([s.ref, s.title,
      (s.criteria as any[]).map((c) => `Given ${c.given}\nWhen ${c.when}\nThen ${c.then}`).join('\n\n'),
      s.status])
  }
  ws1.getColumn(3).alignment = { wrapText: true, vertical: 'top' }
  ws1.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const tasks = await sql<any[]>`
    SELECT r.ref, coalesce(s.edited_text, s.ai_original) AS story,
           coalesce(t.edited_text, t.ai_original) AS task, t.modules, t.tables, t.status
    FROM tasks t JOIN stories s ON s.id = t.story_id
    JOIN requirements r ON r.id = s.requirement_id
    WHERE t.run_id = ${runId} ORDER BY r.order_index, s.id, t.id`
  const ws2 = wb.addWorksheet('Tasks')
  head(ws2, [['Requirement', 14], ['Story', 45], ['Task', 70], ['Modules', 30], ['Tables', 30], ['Status', 12]])
  for (const t of tasks)
    ws2.addRow([t.ref, t.story, t.task, (t.modules ?? []).join(', '), (t.tables ?? []).join(', '), t.status])
  ws2.getColumn(3).alignment = { wrapText: true, vertical: 'top' }

  const tests = await sql<any[]>`
    SELECT r.ref, coalesce(s.edited_text, s.ai_original) AS story,
           coalesce(ts.edited_text, ts.ai_original) AS scenario, ts.kind, ts.status,
           f.question AS covers_gap
    FROM test_scenarios ts JOIN stories s ON s.id = ts.story_id
    JOIN requirements r ON r.id = s.requirement_id
    LEFT JOIN findings f ON f.id = ts.from_finding_id
    WHERE ts.run_id = ${runId} ORDER BY r.order_index, s.id, ts.id`
  const ws3 = wb.addWorksheet('Tests')
  head(ws3, [['Requirement', 14], ['Story', 40], ['Scenario', 80], ['Type', 10], ['Covers gap raised in review', 60], ['Status', 12]])
  for (const t of tests)
    ws3.addRow([t.ref, t.story, t.scenario, t.kind, t.covers_gap ?? '', t.status])
  ws3.getColumn(3).alignment = { wrapText: true, vertical: 'top' }

  const trace = await sql<any[]>`
    SELECT r.ref, coalesce(r.edited_text, r.ai_original) AS requirement,
           coalesce(s.edited_text, s.ai_original) AS story,
           coalesce(ts.edited_text, ts.ai_original) AS test
    FROM trace_links tl
    JOIN requirements r ON r.id = tl.requirement_id
    LEFT JOIN stories s ON s.id = tl.story_id
    LEFT JOIN test_scenarios ts ON ts.id = tl.test_id
    WHERE tl.run_id = ${runId} ORDER BY r.order_index, s.id, ts.id`
  const ws4 = wb.addWorksheet('Traceability')
  head(ws4, [['Requirement', 14], ['Requirement text', 60], ['Story', 50], ['Test scenario', 70]])
  for (const t of trace) ws4.addRow([t.ref, t.requirement, t.story ?? '—', t.test ?? '—'])

  return Buffer.from(await wb.xlsx.writeBuffer())
}
