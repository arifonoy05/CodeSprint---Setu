import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { modelBlocker } from '@/lib/model/config.ts'
import { can, type Role } from '@/lib/auth/roles.ts'
import { Card, CardContent } from './ui/card.tsx'

/**
 * Nothing that needs the model runs until a connection test has passed.
 *
 * An analysis makes dozens of calls; starting one against an endpoint that has never
 * answered wastes minutes and fails halfway through, leaving a half-built run behind.
 */
export async function ModelGate({ role, children }: { role: Role; children: React.ReactNode }) {
  const blocker = await modelBlocker()
  if (!blocker) return <>{children}</>

  const mayFix = can(role, 'model:configure')
  return (
    <Card className="border-[var(--color-error)]">
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-[var(--color-error)]" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold">{blocker.reason}</h2>
            <p className="mt-1 opacity-80">{blocker.detail}</p>
            <p className="mt-3 text-sm opacity-70">
              Setu cannot extract requirements, check them against the system, or draft a backlog
              without a working model endpoint.
            </p>
            {mayFix ? (
              <Link href="/settings/model" className="btn btn-primary btn-sm mt-4">Configure the model</Link>
            ) : (
              <p className="mt-4 text-sm opacity-70">Ask an administrator to configure the model endpoint.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
