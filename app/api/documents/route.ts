import { NextResponse } from 'next/server'
import { sql } from '@/lib/db/client.ts'
import { readDocument } from '@/lib/ingest/read.ts'
import { enqueueRun } from '@/lib/queue.ts'
import { apiUser, isResponse } from '@/lib/auth/api.ts'
import { audit } from '@/lib/auth/audit.ts'
import { env } from '@/lib/env.ts'
import { modelBlocker } from '@/lib/model/config.ts'

export async function POST(req: Request) {
  const user = await apiUser('document:upload')
  if (isResponse(user)) return user

  // The UI hides the upload when blocked; this is what actually enforces it. A run makes
  // dozens of model calls, so starting one against an unverified endpoint wastes minutes
  // and fails halfway, leaving a half-built run behind.
  const blocked = await modelBlocker()
  if (blocked) {
    return NextResponse.json({ error: `${blocked.reason}. ${blocked.detail}` }, { status: 503 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file supplied' }, { status: 400 })
  }

  let text: string
  try {
    text = await readDocument(file.name, Buffer.from(await file.arrayBuffer()))
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 415 })
  }
  if (text.length < 200) {
    return NextResponse.json({ error: 'document has too little text to analyse' }, { status: 422 })
  }

  const [doc] = await sql<{ id: number }[]>`
    INSERT INTO documents (filename, mime, text, uploaded_by)
    VALUES (${file.name}, ${file.type || 'application/octet-stream'}, ${text}, ${user.id})
    RETURNING id`
  const [run] = await sql<{ id: number }[]>`
    INSERT INTO runs (document_id, status, stage, llm_model, embed_model)
    VALUES (${doc!.id}, 'extracting', 'queued', ${env.llmModel}, ${env.embedModel})
    RETURNING id`

  await enqueueRun({ runId: run!.id, documentId: doc!.id })
  await audit({ actorId: user.id, action: 'document:upload', entityType: 'run', entityId: run!.id,
                after: { filename: file.name, chars: text.length } })

  return NextResponse.json({ runId: Number(run!.id) }, { status: 202 })
}
