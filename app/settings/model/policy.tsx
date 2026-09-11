'use client'
import { useState, useTransition } from 'react'
import { Globe, ShieldCheck } from 'lucide-react'
import { setExternalPolicy } from '@/lib/actions/policy.ts'
import { Button } from '@/components/ui/button.tsx'
import { Textarea } from '@/components/ui/textarea.tsx'
import { Badge } from '@/components/ui/badge.tsx'

export function NetworkPolicy({ allowExternal, reason, setByName, setAt }: {
  allowExternal: boolean; reason: string | null; setByName: string | null; setAt: string | null
}) {
  const [pending, start] = useTransition()
  const [opening, setOpening] = useState(false)
  const [why, setWhy] = useState('')
  const [error, setError] = useState<string>()

  const apply = (allow: boolean, r: string) =>
    start(async () => {
      try { await setExternalPolicy(allow, r); setError(undefined); setOpening(false); setWhy('') }
      catch (e) { setError((e as Error).message) }
    })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {allowExternal
          ? <Globe className="h-5 w-5 text-[var(--color-warning)]" aria-hidden />
          : <ShieldCheck className="h-5 w-5 text-[var(--color-success)]" aria-hidden />}
        <div className="mr-auto">
          <div className="font-medium">
            {allowExternal ? 'External models are permitted' : 'Internal models only'}
          </div>
          <p className="text-sm opacity-70">
            {allowExternal
              ? 'Endpoints outside your network, and gateways that forward to third-party providers, may be used.'
              : 'Only endpoints inside your network may be used. Gateways that resell third-party models count as outside.'}
          </p>
        </div>
        <Badge variant={allowExternal ? 'warning' : 'success'}>
          {allowExternal ? 'external allowed' : 'internal only'}
        </Badge>
      </div>

      {allowExternal && reason && (
        <div className="rounded-[var(--radius)] bg-[var(--color-base-200)] p-3 text-sm">
          <div className="opacity-70">Reason given</div>
          <p className="mt-1">{reason}</p>
          <div className="mt-1 text-xs opacity-60">
            {setByName && `Set by ${setByName}`}{setAt && ` · ${new Date(setAt).toLocaleString()}`}
          </div>
        </div>
      )}

      {allowExternal ? (
        <div>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => apply(false, '')}>
            Restrict to internal models
          </Button>
        </div>
      ) : opening ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-warning)] p-3">
          <p className="text-sm">
            Requirement text, source code and incident history will be sent outside your network.
            This contradicts the stated requirement that client business logic stays internal, so the
            reason is recorded against your name and shown on the health page.
          </p>
          <Textarea className="mt-2" rows={2} value={why} onChange={(e) => setWhy(e.target.value)}
                    placeholder="Why is this necessary? e.g. no internal GPU capacity until Q3." />
          <div className="mt-2 flex gap-2">
            <Button size="sm" disabled={pending || why.trim().length < 10}
                    onClick={() => apply(true, why)}>Allow external models</Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpening(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="outline" size="sm" onClick={() => setOpening(true)}>
            Allow models outside the network…
          </Button>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  )
}
