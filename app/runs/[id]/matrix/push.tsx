'use client'
import { useState } from 'react'

/** D15: the dry run is the demonstrable path — it contacts nothing. */
export function JiraDryRun({ runId }: { runId: number }) {
  const [payload, setPayload] = useState<any>()
  const [busy, setBusy] = useState(false)

  return (
    <div style={{ marginTop: '.7rem' }}>
      <button disabled={busy} onClick={async () => {
        setBusy(true)
        const res = await fetch(`/api/runs/${runId}/push?dryRun=true`, { method: 'POST' })
        setPayload(await res.json()); setBusy(false)
      }}>{busy ? 'Building…' : 'Preview Jira push (dry run)'}</button>

      {payload && (
        <div style={{ marginTop: '.6rem' }}>
          <p style={{ margin: '.2rem 0', fontSize: '.9em' }}>
            {payload.issueCount} issue{payload.issueCount === 1 ? '' : 's'} would be created in{' '}
            <strong>{payload.project}</strong> at <strong>{payload.target}</strong>.{' '}
            {payload.enabled
              ? <span style={{ color: '#b60' }}>Push is ENABLED.</span>
              : <span style={{ color: '#666' }}>Push is disabled — nothing was contacted.</span>}
          </p>
          <pre style={{ background: '#f6f6f6', padding: '.7rem', borderRadius: 4, maxHeight: 360,
                        overflow: 'auto', fontSize: '.8em', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(payload.issues?.slice(0, 2), null, 2)}
          </pre>
          {payload.issueCount > 2 && (
            <p style={{ fontSize: '.85em', color: '#666' }}>
              Showing the first 2 of {payload.issueCount}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
