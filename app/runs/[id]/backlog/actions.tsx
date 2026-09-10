'use client'
import { useTransition, useState } from 'react'
import { startGeneration, approveBacklog } from '@/lib/actions/backlog.ts'

export function GenerateButton({ runId, label }: { runId: number; label: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  return (
    <>
      <button disabled={pending} style={{ padding: '.45rem .9rem', cursor: 'pointer' }}
              onClick={() => start(async () => {
                try { await startGeneration(runId) } catch (e) { setError((e as Error).message) }
              })}>{pending ? 'Starting…' : label}</button>
      {error && <p role="alert" style={{ color: '#b00' }}>{error}</p>}
    </>
  )
}

export function ApproveBacklog({ runId, pendingCount }: { runId: number; pendingCount: number }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string>()
  return (
    <>
      <button disabled={pending || pendingCount > 0}
              title={pendingCount > 0 ? 'Every item needs a decision first' : undefined}
              style={{ padding: '.45rem .9rem' }}
              onClick={() => start(async () => {
                try { await approveBacklog(runId) } catch (e) { setError((e as Error).message) }
              })}>Approve backlog</button>
      {pendingCount > 0 && <span style={{ marginLeft: '.5rem', color: '#666', fontSize: '.9em' }}>
        {pendingCount} item{pendingCount === 1 ? '' : 's'} undecided</span>}
      {error && <p role="alert" style={{ color: '#b00' }}>{error}</p>}
    </>
  )
}
