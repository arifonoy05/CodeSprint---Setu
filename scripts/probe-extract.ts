import { readFile } from 'node:fs/promises'
import { readDocument } from '../lib/ingest/read.ts'
import { extractRequirements } from '../lib/ai/extract.ts'

const bytes = await readFile('fixtures/srs_draft.docx')
const text = await readDocument('srs_draft.docx', bytes)
console.log(`docx -> ${text.length} chars\n`)

const t0 = Date.now()
const reqs = await extractRequirements(text)
console.log(`extracted ${reqs.length} requirements in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`)
for (const r of reqs) console.log(`  ${r.ref}  ${r.classification.padEnd(15)} ${r.text.slice(0, 90)}`)
