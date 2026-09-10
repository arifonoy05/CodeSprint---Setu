import { sql } from '@/lib/db/client.ts'
import { llmReachable } from '@/lib/ai/client.ts'
import { env } from '@/lib/env.ts'

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
    <main>
      <h1>Health</h1>
      <table cellPadding={8} style={{ borderCollapse: 'collapse' }}>
        <tbody>
          {rows.map(([name, ok, detail]) => (
            <tr key={name} style={{ borderTop: '1px solid #ddd' }}>
              <td>{ok ? '✅' : '❌'}</td>
              <td><strong>{name}</strong></td>
              <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: '.9em' }}>{detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
