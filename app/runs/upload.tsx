'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function Upload() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  return (
    <form
      style={{ marginTop: '1rem', padding: '1rem', border: '1px dashed #bbb', borderRadius: 6 }}
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
      <strong>Upload a draft SRS</strong>
      <p style={{ color: '#666', margin: '.25rem 0 .75rem' }}>
        DOCX or PDF. Analysis runs in the background — you can close this tab.
      </p>
      <input type="file" name="file" accept=".docx,.pdf,.md,.txt" required />
      <button type="submit" disabled={busy} style={{ marginLeft: '.5rem', padding: '.4rem .8rem', cursor: 'pointer' }}>
        {busy ? 'Uploading…' : 'Analyse'}
      </button>
      {error && <p role="alert" style={{ color: '#b00' }}>{error}</p>}
    </form>
  )
}
