'use client'
import { useState, useTransition } from 'react'
import { editRequirement } from '@/lib/actions/run.ts'

/** D26: revisions are captured in place — no document versioning. */
export function RequirementText({ id, aiOriginal, editedText, locked }: {
  id: number; aiOriginal: string; editedText: string | null; locked: boolean
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(editedText ?? aiOriginal)
  const edited = editedText !== null && editedText !== aiOriginal

  if (editing) {
    return (
      <div style={{ margin: '.2rem 0 .8rem' }}>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                  style={{ width: '100%', padding: '.4rem', fontFamily: 'inherit' }} />
        <button disabled={pending} onClick={() =>
          start(async () => { await editRequirement(id, draft); setEditing(false) })}>Save</button>{' '}
        <button disabled={pending} onClick={() => { setDraft(editedText ?? aiOriginal); setEditing(false) }}>Cancel</button>
      </div>
    )
  }

  return (
    <div style={{ margin: '.2rem 0 .8rem' }}>
      <span>{editedText ?? aiOriginal}</span>{' '}
      {!locked && (
        <button onClick={() => setEditing(true)}
                style={{ background: 'none', border: 0, color: '#06c', cursor: 'pointer', fontSize: '.85em' }}>
          revise
        </button>
      )}
      {edited && (
        <details style={{ fontSize: '.82em', color: '#666', marginTop: '.2rem' }}>
          <summary style={{ cursor: 'pointer' }}>As extracted from the document</summary>
          <p style={{ margin: '.2rem 0 0' }}>{aiOriginal}</p>
        </details>
      )}
    </div>
  )
}
