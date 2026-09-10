import { sql } from '@/lib/db/client.ts'
import { llmReachable } from '@/lib/ai/client.ts'
import { env } from '@/lib/env.ts'
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
  const [db, model] = await Promise.all([dbStatus(), llmReachable()])
  const rows: [string, boolean, string][] = [
    ['Database', db.ok, db.detail],
    ['Model endpoint', model.ok, model.ok ? env.llmBaseUrl : model.error ?? 'unreachable'],
    ['Chat model', !!model.models?.includes(env.llmModel), env.llmModel],
    ['Embedding model', !!model.models?.includes(env.embedModel), `${env.embedModel} (${env.embedDims}d)`],
    ['Egress policy', true, 'endpoint asserted private at boot (D31)'],
  ]

  return (
    <AppShell>
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
