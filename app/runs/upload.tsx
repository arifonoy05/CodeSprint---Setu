'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Upload as UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'
import { Card, CardContent } from '@/components/ui/card.tsx'

export function Upload() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  return (
    <Card className="border-dashed">
      <CardContent className="pt-5">
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true); setError(undefined)
            const body = new FormData(e.currentTarget)
            const res = await fetch('/api/documents', { method: 'POST', body })
            setBusy(false)
            if (!res.ok) { setError(((await res.json()) as any).error ?? 'upload failed'); return }
            router.refresh()
          }}
        >
          <div className="mr-auto">
            <div className="flex items-center gap-2 font-medium">
              <UploadIcon className="h-4 w-4 opacity-70" aria-hidden /> Upload a draft SRS
            </div>
            <p className="text-sm opacity-60">
              DOCX or PDF. Analysis runs in the background — closing this tab is safe.
            </p>
          </div>
          <input type="file" name="file" accept=".docx,.pdf,.md,.txt" required
                 className="file-input file-input-sm file-input-bordered max-w-xs" />
          <Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Analyse'}</Button>
        </form>
        {error && <p role="alert" className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
      </CardContent>
    </Card>
  )
}
