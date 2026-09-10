'use client'
import { useState, useTransition } from 'react'
import { decideArtifact } from '@/lib/actions/backlog.ts'

type Kind = 'stories' | 'tasks' | 'test_scenarios'

export function Artifact({ kind, id, text, aiOriginal, status, meta }: {
  kind: Kind; id: number; text: string; aiOriginal: string
  status: string; meta?: React.ReactNode
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const edited = text !== aiOriginal
  const dim = status === 'dismissed'

  const act = (p: Parameters<typeof decideArtifact>[2]) =>
    start(async () => { await decideArtifact(kind, id, p) })

  return (
    <div style={{ padding: '.4rem 0', opacity: dim ? 0.5 : 1 }}>
      {editing ? (
        <>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
                    style={{ width: '100%', padding: '.4rem', fontFamily: 'inherit' }} />
          <button disabled={pending} onClick={() => { act({ status: 'edited', editedText: draft }); setEditing(false) }}>Save</button>{' '}
          <button disabled={pending} onClick={() => { setDraft(text); setEditing(false) }}>Cancel</button>
        </>
      ) : (
        <>
          <span>{text}</span> {meta}
          {status !== 'proposed' && (
            <span style={{ fontSize: '.75em', background: '#eee', padding: '1px 6px',
                           borderRadius: 9, marginLeft: '.4rem' }}>{status}</span>
          )}
          <span style={{ marginLeft: '.5rem', fontSize: '.8em' }}>
            <button disabled={pending} onClick={() => act({ status: 'accepted' })}>Accept</button>{' '}
            <button disabled={pending} onClick={() => setEditing(true)}>Edit</button>{' '}
            <button disabled={pending} onClick={() => act({ status: 'dismissed' })}>Drop</button>
          </span>
          {edited && (
            <details style={{ fontSize: '.8em', color: '#666' }}>
              <summary style={{ cursor: 'pointer' }}>What the AI originally proposed</summary>
              <p style={{ margin: '.2rem 0 0' }}>{aiOriginal}</p>
            </details>
          )}
        </>
      )}
    </div>
  )
}
