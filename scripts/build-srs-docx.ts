import { readFile, writeFile } from 'node:fs/promises'
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'

/**
 * Build the fixture SRS as a real .docx, because that is what a BA uploads.
 * Markdown stays the editable source of truth; this is a derived artifact.
 */
const md = await readFile('fixtures/srs_draft.md', 'utf8')

const children = md.split('\n').flatMap((line): Paragraph[] => {
  if (line.trim() === '' || line.trim() === '---') return []
  const h = line.match(/^(#{1,3})\s+(.*)$/)
  if (h) {
    const level = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2][h[1]!.length - 1]!
    return [new Paragraph({ text: h[2]!, heading: level })]
  }
  const bold = line.match(/^\*\*(.+?):\*\*\s*(.*)$/)
  if (bold) {
    return [new Paragraph({ children: [
      new TextRun({ text: `${bold[1]}: `, bold: true }),
      new TextRun({ text: bold[2]! }),
    ] })]
  }
  return [new Paragraph({ text: line })]
})

const doc = new Document({ sections: [{ children }] })
await writeFile('fixtures/srs_draft.docx', await Packer.toBuffer(doc))
console.log(`wrote fixtures/srs_draft.docx (${children.length} paragraphs)`)
