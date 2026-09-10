'use client'
import { useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { Badge } from '@/components/ui/badge.tsx'

/** D15: the dry run is the demonstrable path — it contacts nothing. */
export function JiraDryRun({ runId }: { runId: number }) {
  const [payload, setPayload] = useState<any>()
  const [busy, setBusy] = useState(false)

  return (
    <div className="mt-3">
      <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
        setBusy(true)
        const res = await fetch(`/api/runs/${runId}/push?dryRun=true`, { method: 'POST' })
        setPayload(await res.json()); setBusy(false)
      }}>
        <Send className="h-3.5 w-3.5" aria-hidden /> {busy ? 'Building…' : 'Preview Jira push (dry run)'}
      </Button>

      {payload && (
        <div className="mt-3">
          <p className="mb-2 text-sm">
            {payload.issueCount} issue{payload.issueCount === 1 ? '' : 's'} would be created in{' '}
            <code className="font-mono">{payload.project}</code> at{' '}
            <code className="font-mono">{payload.target}</code>{' '}
            {payload.enabled
              ? <Badge variant="warning">push ENABLED</Badge>
              : <Badge variant="secondary">push disabled — nothing was contacted</Badge>}
          </p>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-[var(--radius)] bg-[var(--color-base-200)] p-3 text-xs">
            {JSON.stringify(payload.issues?.slice(0, 2), null, 2)}
          </pre>
          {payload.issueCount > 2 && (
            <p className="mt-1 text-xs opacity-60">Showing the first 2 of {payload.issueCount}.</p>
          )}
        </div>
      )}
    </div>
  )
}
