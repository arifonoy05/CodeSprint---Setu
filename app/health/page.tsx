import { requireUser } from '@/lib/auth/session.ts'
import { sql } from '@/lib/db/client.ts'
import { llmReachable } from '@/lib/ai/client.ts'
import { getModelConfig, modelBlocker } from '@/lib/model/config.ts'
import { AppShell } from '@/components/app-shell.tsx'
import { Card, CardContent } from '@/components/ui/card.tsx'
import { CheckCircle2, XCircle } from 'lucide-react'

export const dynamic = 'force-dynamic'

async function dbStatus() {
  try {
    const [row] = await sql<{ v: string }[]>`SELECT extversion AS v FROM pg_extension WHERE extname='vector'`
    return { ok: !!row, detail: row ? `pgvector ${row.v}` : 'pgvector NOT installed' }
  } catch (err) {
    return { ok: false, detail: (err as Error).message }
  }
}

export default async function Health() {
  const user = await requireUser()
  const [db, model, cfg, blocker] = await Promise.all([
    dbStatus(), llmReachable(), getModelConfig(), modelBlocker(),
  ])
  const rows: [string, boolean, string][] = [
    ['Database', db.ok, db.detail],
    ['Model endpoint', model.ok, model.ok ? cfg.baseUrl : model.error ?? 'unreachable'],
    ['Chat model', !!model.models?.includes(cfg.chatModel), cfg.chatModel],
    ['Embedding model', !!model.models?.includes(cfg.embedModel),
      `${cfg.embedModel}${cfg.embedDims ? ` (${cfg.embedDims}d)` : ''}`],
    ['Network', cfg.isPrivate, cfg.isPrivate ? 'endpoint is inside your network'
      : cfg.egressAcknowledged ? 'PUBLIC endpoint, acknowledged' : 'PUBLIC endpoint, not acknowledged'],
    ['Ready to run', !blocker, blocker ? `${blocker.reason} — ${blocker.detail}` : 'verified'],
  ]

  return (
    <AppShell user={user}>
      <h1 className="mb-4 text-2xl font-semibold">Health</h1>
      <Card><CardContent className="p-0">
        <ul className="divide-y divide-[var(--color-border)]">
          {rows.map(([name, ok, detail]) => (
            <li key={name} className="flex items-center gap-3 p-4">
              {ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-success)]" aria-label="ok" />
                  : <XCircle className="h-5 w-5 shrink-0 text-[var(--color-error)]" aria-label="failing" />}
              <span className="w-40 font-medium">{name}</span>
              <span className="font-mono text-sm opacity-70">{detail}</span>
            </li>
          ))}
        </ul>
      </CardContent></Card>
    </AppShell>
  )
}
