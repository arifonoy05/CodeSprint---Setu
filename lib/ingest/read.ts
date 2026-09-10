import { extname } from 'node:path'

/**
 * D32: whole document, one extraction call. The fixture is ~16 requirements and fits.
 * ponytail: a real 50-page SRS needs section-wise extraction with overlap — add it when
 * a real SRS arrives, not before.
 */
export async function readDocument(filename: string, bytes: Buffer): Promise<string> {
  const ext = extname(filename).toLowerCase()
  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: bytes })
    return value.trim()
  }
  if (ext === '.pdf') {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const doc = await getDocumentProxy(new Uint8Array(bytes))
    const { text } = await extractText(doc, { mergePages: true })
    return String(text).trim()
  }
  if (ext === '.md' || ext === '.txt') return bytes.toString('utf8').trim()
  throw new Error(`unsupported document type: ${ext || filename}`)
}
