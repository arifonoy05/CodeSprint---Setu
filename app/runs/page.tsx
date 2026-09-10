import Link from 'next/link'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { logout } from '@/lib/auth/actions.ts'
import { sql } from '@/lib/db/client.ts'
import { Upload } from './upload.tsx'

export const dynamic = 'force-dynamic'

export default async function Runs() {
  const user = await requireUser()
  const runs = await sql<any[]>`
    SELECT r.id, r.status, r.stage, r.progress_done, r.progress_total, r.started_at, r.is_demo, d.filename,
           (SELECT count(*) FROM findings f WHERE f.run_id = r.id AND f.merged_into_id IS NULL) AS findings
    FROM runs r JOIN documents d ON d.id = r.document_id
    ORDER BY r.id DESC LIMIT 25`

  return (
    <main>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: '1rem' }}>
        <h1 style={{ marginRight: 'auto' }}>Runs</h1>
        <span style={{ color: '#666' }}>{user.name} · {user.role}</span>
        <form action={logout}><button style={{ background: 'none', border: 0, color: '#06c', cursor: 'pointer' }}>Sign out</button></form>
      </header>

      {can(user.role, 'document:upload') && <Upload />}

      <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%', marginTop: '1.5rem' }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
          <th>Run</th><th>Document</th><th>Status</th><th>Findings</th>
        </tr></thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
              <td><Link href={`/runs/${r.id}`}>#{r.id}</Link>{r.is_demo && <span style={{ marginLeft: 6, fontSize: '.72em', background: '#eef3fa', color: '#04569c', padding: '1px 6px', borderRadius: 9 }}>stored</span>}</td>
              <td>{r.filename}</td>
              <td>
                {r.status === 'failed' ? <span style={{ color: '#b00' }}>failed</span> : r.status}
                {r.stage && <div style={{ color: '#666', fontSize: '.85em' }}>
                  {r.stage}{r.progress_total > 0 && ` — ${r.progress_done}/${r.progress_total}`}
                </div>}
              </td>
              <td>{r.status === 'review' || r.status === 'approved' ? r.findings : '—'}</td>
            </tr>
          ))}
          {runs.length === 0 && <tr><td colSpan={4} style={{ color: '#666' }}>No runs yet.</td></tr>}
        </tbody>
      </table>
    </main>
  )
}
