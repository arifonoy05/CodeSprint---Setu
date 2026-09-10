import { readFile } from 'node:fs/promises'
import { sealData } from 'iron-session'
import { sql } from '../lib/db/client.ts'
import { env } from '../lib/env.ts'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000'

const [ba] = await sql<any[]>`SELECT id, email, name, role FROM users WHERE email='ba@bracits.com'`
const [qa] = await sql<any[]>`SELECT id, email, name, role FROM users WHERE email='qa@bracits.com'`
const cookieFor = async (u: any) =>
  `setu_session=${await sealData({ user: u }, { password: env.sessionSecret, ttl: 0 })}`

const upload = async (u: any, filename: string, bytes: Buffer) => {
  const body = new FormData()
  body.set('file', new File([new Uint8Array(bytes)], filename))
  const res = await fetch(`${BASE}/api/documents`, {
    method: 'POST', headers: { cookie: await cookieFor(u) }, body,
  })
  return { status: res.status, body: await res.text() }
}

const docx = await readFile('fixtures/srs_draft.docx')

console.log('QA uploads (must be refused by RBAC):')
const asQa = await upload(qa, 'srs_draft.docx', docx)
console.log(`  HTTP ${asQa.status}\n`)

console.log('BA uploads an unsupported file type:')
console.log(`  HTTP ${(await upload(ba, 'notes.rtf', Buffer.from('x'.repeat(500)))).status}\n`)

console.log('BA uploads a document with almost no text:')
console.log(`  HTTP ${(await upload(ba, 'tiny.txt', Buffer.from('too short'))).status}\n`)

console.log('BA uploads the real SRS:')
const ok = await upload(ba, 'srs_draft.docx', docx)
console.log(`  HTTP ${ok.status}  ${ok.body}`)
await sql.end()
