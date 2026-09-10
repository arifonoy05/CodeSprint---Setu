import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { getModelConfig, modelBlocker } from '@/lib/model/config.ts'
import { AppShell } from '@/components/app-shell.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { ModelForm } from './form.tsx'

export const dynamic = 'force-dynamic'

export default async function ModelSettings() {
  const user = await requireUser()
  if (!can(user.role, 'model:configure')) redirect('/runs')

  const cfg = await getModelConfig()
  const blocker = await modelBlocker()

  return (
    <AppShell user={user}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Model</h1>
        {blocker
          ? <Badge variant="destructive">{blocker.reason}</Badge>
          : <Badge variant="success">verified {cfg.verifiedAt ? new Date(cfg.verifiedAt).toLocaleString() : ''}</Badge>}
        {cfg.fromEnv && <Badge variant="warning">not configured — showing environment defaults</Badge>}
      </div>

      {blocker && (
        <div role="alert" className="alert alert-error mb-4">
          <span><strong>{blocker.reason}.</strong> {blocker.detail}</span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Endpoint</CardTitle>
          <CardDescription>
            Setu sends requirement text, source code and incident history to this endpoint on every
            run. Nothing runs until a connection test passes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelForm
            hasStoredKey={Boolean(cfg.apiKey)}
            initial={{
              baseUrl: cfg.baseUrl, apiKey: '', chatModel: cfg.chatModel, embedModel: cfg.embedModel,
              reasoningEffort: cfg.reasoningEffort, egressAcknowledged: cfg.egressAcknowledged,
              verifiedAt: cfg.verifiedAt ? String(cfg.verifiedAt) : null, lastError: cfg.lastError,
            }}
          />
        </CardContent>
      </Card>
    </AppShell>
  )
}
