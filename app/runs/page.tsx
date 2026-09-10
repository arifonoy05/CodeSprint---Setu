import Link from 'next/link'
import { requireUser } from '@/lib/auth/session.ts'
import { can } from '@/lib/auth/roles.ts'
import { sql } from '@/lib/db/client.ts'
import { AppShell } from '@/components/app-shell.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { Card, CardContent } from '@/components/ui/card.tsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.tsx'
import { Upload } from './upload.tsx'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'> = {
  failed: 'destructive', review: 'info', approved: 'success', ready: 'success',
  extracting: 'warning', indexing: 'warning', analyzing: 'warning', generating: 'warning',
}

export default async function Runs() {
  const user = await requireUser()
  const runs = await sql<any[]>`
    SELECT r.id, r.status, r.stage, r.progress_done, r.progress_total, r.started_at, r.is_demo,
           d.filename,
           (SELECT count(*) FROM findings f WHERE f.run_id = r.id AND f.merged_into_id IS NULL) AS findings
    FROM runs r JOIN documents d ON d.id = r.document_id
    ORDER BY r.id DESC LIMIT 25`

  return (
    <AppShell user={user}>
      <h1 className="mb-4 text-2xl font-semibold">Runs</h1>
      {can(user.role, 'document:upload') && <div className="mb-6"><Upload /></div>}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Run</TableHead>
                <TableHead>Document</TableHead>
                <TableHead className="w-64">Status</TableHead>
                <TableHead className="w-24 text-right">Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/runs/${r.id}`} className="link link-primary font-medium">#{r.id}</Link>
                    {r.is_demo && <Badge variant="info" className="ml-2">stored</Badge>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.filename}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS[r.status] ?? 'secondary'}>{r.status}</Badge>
                    {r.stage && (
                      <div className="mt-1 text-xs opacity-60">
                        {r.stage}
                        {r.progress_total > 0 && ` — ${r.progress_done}/${r.progress_total}`}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {['review', 'approved', 'generating', 'ready'].includes(r.status) ? r.findings : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-8 text-center opacity-60">
                  No runs yet. Upload a draft SRS to begin.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  )
}
