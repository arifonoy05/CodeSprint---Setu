'use client'
import { useState, useTransition } from 'react'
import { approveRun } from '@/lib/actions/run.ts'

export function Gate({ runId, undecided, approved, approvedBy, approvedAt, canApprove }: {
  runId: number; undecided: number; approved: boolean
  approvedBy: string | null; approvedAt: string | null; canApprove: boolean
}) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string>()

  if (approved) {
    return (
      <section style={{ padding: '.9rem 1rem', background: '#eef7ee', border: '1px solid #cde3cd',
                        borderRadius: 6, margin: '1rem 0' }}>
        <strong>Requirements approved</strong>
        {approvedBy && <> by {approvedBy}</>}
        {approvedAt && <> on {new Date(approvedAt).toLocaleString()}</>}
        <p style={{ margin: '.3rem 0 0', color: '#456', fontSize: '.9em' }}>
          The requirement set is fixed. Findings and requirement text can no longer be changed —
          the backlog is generated from exactly what was signed off.
        </p>
      </section>
    )
  }

  const blocked = undecided > 0 || !canApprove
  return (
    <section style={{ padding: '.9rem 1rem', background: '#fff8e6', border: '1px solid #eadfc0',
                      borderRadius: 6, margin: '1rem 0' }}>
      <strong>Awaiting sign-off</strong>
      <p style={{ margin: '.3rem 0 .6rem', color: '#654', fontSize: '.9em' }}>
        Nothing is generated, exported or pushed until the requirements are approved.
        {undecided > 0 && <> <strong>{undecided}</strong> finding{undecided === 1 ? '' : 's'} still
          need{undecided === 1 ? 's' : ''} a decision.</>}
        {!canApprove && <> Only a BA can approve.</>}
      </p>

      {confirming ? (
        <>
          <p style={{ margin: '.3rem 0', fontWeight: 600 }}>
            Approve these requirements? This fixes the requirement set and cannot be undone here.
          </p>
          <button disabled={pending} onClick={() =>
            start(async () => {
              try { await approveRun(runId); setError(undefined) }
              catch (e) { setError((e as Error).message); setConfirming(false) }
            })}>Yes, approve</button>{' '}
          <button disabled={pending} onClick={() => setConfirming(false)}>Cancel</button>
        </>
      ) : (
        <button disabled={blocked} title={blocked ? 'Every finding must be decided first' : undefined}
                onClick={() => setConfirming(true)}
                style={{ padding: '.45rem .9rem', cursor: blocked ? 'not-allowed' : 'pointer' }}>
          Approve requirements
        </button>
      )}
      {error && <p role="alert" style={{ color: '#b00', fontSize: '.85em' }}>{error}</p>}
    </section>
  )
}
