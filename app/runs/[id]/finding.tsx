'use client'
import { useState, useTransition } from 'react'
import { decideFinding } from '@/lib/actions/findings.ts'

export type FindingView = {
  id: number
  gap_class: string
  merged_classes: string[]
  severity: 'high' | 'medium' | 'low'
  ai_original: string
  edited_text: string | null
  question: string
  status: 'proposed' | 'accepted' | 'edited' | 'dismissed'
  ba_verdict: 'valid' | 'invalid' | null
  resolution_note: string | null
  decided_by_name: string | null
  decided_at: string | null
  evidence: { id: string; ref: string; kind: string; text: string }[]
}

const COLOUR = { high: '#b00', medium: '#b60', low: '#777' }

export function Finding({ f, canDismiss, locked }: { f: FindingView; canDismiss: boolean; locked: boolean }) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(f.edited_text ?? f.ai_original)
  const [note, setNote] = useState(f.resolution_note ?? '')
  const [error, setError] = useState<string>()

  const act = (d: Parameters<typeof decideFinding>[0]) =>
    start(async () => {
      try { await decideFinding(d); setError(undefined) }
      catch (e) { setError((e as Error).message) }
    })

  const edited = f.edited_text !== null && f.edited_text !== f.ai_original
  const dim = f.status === 'dismissed'

  return (
    <div style={{
      borderLeft: `3px solid ${COLOUR[f.severity]}`, padding: '.5rem .9rem',
      marginBottom: '.9rem', opacity: dim ? 0.55 : 1, background: dim ? '#fafafa' : undefined,
    }}>
      <div style={{ display: 'flex', gap: '.6rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <strong style={{ color: COLOUR[f.severity] }}>{f.severity}</strong>
        <span style={{ color: '#666', fontSize: '.85em' }}>
          {(f.merged_classes?.length ? f.merged_classes : [f.gap_class]).join(' + ').replace(/_/g, ' ')}
        </span>
        {f.status !== 'proposed' && (
          <span style={{ fontSize: '.8em', background: '#eee', padding: '1px 7px', borderRadius: 9 }}>
            {f.status}{f.decided_by_name ? ` by ${f.decided_by_name}` : ''}
          </span>
        )}
      </div>

      {editing ? (
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                  style={{ width: '100%', margin: '.5rem 0', padding: '.4rem', fontFamily: 'inherit' }} />
      ) : (
        <p style={{ margin: '.4rem 0' }}>{f.edited_text ?? f.ai_original}</p>
      )}

      {/* D14: what the AI proposed stays visible after a human changes it. */}
      {edited && !editing && (
        <details style={{ fontSize: '.85em', color: '#666', marginBottom: '.4rem' }}>
          <summary style={{ cursor: 'pointer' }}>What the AI originally proposed</summary>
          <p style={{ margin: '.3rem 0 0' }}>{f.ai_original}</p>
        </details>
      )}

      <p style={{ margin: '.4rem 0', fontStyle: 'italic' }}>{f.question}</p>

      <div style={{ fontSize: '.85em', marginBottom: '.5rem' }}>
        {f.evidence.map((e) => (
          <details key={e.id} style={{ display: 'inline-block', marginRight: '.4rem' }}>
            <summary style={{ cursor: 'pointer', background: '#eef3fa', color: '#04569c',
                              padding: '1px 7px', borderRadius: 3, display: 'inline-block' }}>
              {e.ref}
            </summary>
            <pre style={{ background: '#f6f6f6', padding: '.6rem', borderRadius: 4, maxWidth: 720,
                          overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: '.95em' }}>{e.text}</pre>
          </details>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {locked ? (
          <span style={{ fontSize: '.85em', color: '#777' }}>
            Approved — decisions are fixed.
          </span>
        ) : editing ? (
          <>
            <button disabled={pending} onClick={() => { act({ findingId: f.id, status: 'edited', editedText: draft }); setEditing(false) }}>Save</button>
            <button disabled={pending} onClick={() => { setDraft(f.edited_text ?? f.ai_original); setEditing(false) }}>Cancel</button>
          </>
        ) : (
          <>
            <button disabled={pending} onClick={() => act({ findingId: f.id, status: 'accepted' })}>Accept</button>
            <button disabled={pending} onClick={() => setEditing(true)}>Edit</button>
            <button disabled={pending || !canDismiss}
                    title={canDismiss ? undefined : 'Only a BA can dismiss a finding'}
                    onClick={() => act({ findingId: f.id, status: 'dismissed' })}>Dismiss</button>
          </>
        )}

        {/* D24: asked separately, because dismissed does not mean invalid. */}
        <span style={{ marginLeft: 'auto', fontSize: '.85em', color: '#444' }}>
          Worth asking the client?{' '}
          <button disabled={pending} aria-pressed={f.ba_verdict === 'valid'}
                  style={{ fontWeight: f.ba_verdict === 'valid' ? 700 : 400 }}
                  onClick={() => act({ findingId: f.id, baVerdict: f.ba_verdict === 'valid' ? null : 'valid' })}>Yes</button>{' '}
          <button disabled={pending} aria-pressed={f.ba_verdict === 'invalid'}
                  style={{ fontWeight: f.ba_verdict === 'invalid' ? 700 : 400 }}
                  onClick={() => act({ findingId: f.id, baVerdict: f.ba_verdict === 'invalid' ? null : 'invalid' })}>No</button>
        </span>
      </div>

      <details style={{ marginTop: '.5rem', fontSize: '.85em' }}>
        <summary style={{ cursor: 'pointer', color: '#555' }}>
          What the client said{f.resolution_note ? ' ✓' : ''}
        </summary>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                  placeholder="Record the answer, then revise the requirement text above."
                  style={{ width: '100%', marginTop: '.3rem', padding: '.4rem', fontFamily: 'inherit' }} />
        <button disabled={pending} onClick={() => act({ findingId: f.id, resolutionNote: note })}>Save note</button>
      </details>

      {error && <p role="alert" style={{ color: '#b00', fontSize: '.85em' }}>{error}</p>}
    </div>
  )
}
