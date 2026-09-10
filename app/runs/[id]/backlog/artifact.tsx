'use client'
import { useState, useTransition } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { decideArtifact } from '@/lib/actions/backlog.ts'
import { Button } from '@/components/ui/button.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { cn } from '@/lib/utils.ts'

type Kind = 'stories' | 'tasks' | 'test_scenarios'

export function Artifact({ kind, id, text, aiOriginal, status, meta, className }: {
  kind: Kind; id: number; text: string; aiOriginal: string
  status: string; meta?: React.ReactNode; className?: string
}) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text)
  const edited = text !== aiOriginal
  const act = (p: Parameters<typeof decideArtifact>[2]) =>
    start(async () => { await decideArtifact(kind, id, p) })

  if (editing) {
    return (
      <div className="py-1">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} />
        <div className="mt-2 flex gap-2">
          <Button size="sm" disabled={pending}
                  onClick={() => { act({ status: 'edited', editedText: draft }); setEditing(false) }}>Save</Button>
          <Button size="sm" variant="ghost" disabled={pending}
                  onClick={() => { setDraft(text); setEditing(false) }}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('group flex flex-wrap items-start gap-2 py-1.5', status === 'dismissed' && 'opacity-50', className)}>
      <div className="min-w-0 flex-1">
        <span>{text}</span> {meta}
        {status !== 'proposed' && <Badge variant="outline" className="ml-2">{status}</Badge>}
        {edited && (
          <details className="mt-1 text-xs opacity-70">
            <summary className="cursor-pointer">What the AI originally proposed</summary>
            <p className="mt-1">{aiOriginal}</p>
          </details>
        )}
      </div>
      <div className="flex shrink-0 gap-1 opacity-40 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Accept" disabled={pending}
                onClick={() => act({ status: 'accepted' })}><Check className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" disabled={pending}
                onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" title="Drop" disabled={pending}
                onClick={() => act({ status: 'dismissed' })}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  )
}
