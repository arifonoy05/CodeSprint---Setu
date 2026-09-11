import Link from 'next/link'
import { Suspense } from 'react'
import { FileSearch } from 'lucide-react'
import { ThemeSwitcher } from './theme-switcher.tsx'
import { TopNav, MobileNav, RunNav } from './nav.tsx'
import { pendingFor } from '@/lib/pending.ts'
import { sql } from '@/lib/db/client.ts'
import { Badge } from './ui/badge.tsx'
import { logout } from '@/lib/auth/actions.ts'
import type { SessionUser } from '@/lib/auth/session.ts'

export async function AppShell({ user, runId, children }: {
  user?: SessionUser | null
  /** When inside a run, the shell also renders the per-run view tabs. */
  runId?: number
  children: React.ReactNode
}) {
  const inRun = user && runId !== undefined
  const pending = inRun ? await pendingFor(runId) : undefined
  // The backlog views exist before sign-off but produce nothing, so the nav shows them gated.
  const approved = inRun
    ? (await sql<{ ok: boolean }[]>`SELECT approved_at IS NOT NULL AS ok FROM runs WHERE id = ${runId}`)[0]?.ok
    : undefined

  return (
    <div className="min-h-screen bg-[var(--color-base-200)]">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-base-100)]">
        <div className="navbar mx-auto w-full max-w-6xl gap-2 px-4">
          {user && <MobileNav role={user.role} runId={runId} />}
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <FileSearch className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
            Setu
          </Link>
          {user && <TopNav role={user.role} />}
          <div className="ml-auto flex flex-none items-center gap-3">
            <ThemeSwitcher />
            {user && (
              <>
                <span className="hidden items-center gap-2 text-sm md:flex">
                  {user.name}
                  <Badge variant="secondary">{user.role}</Badge>
                </span>
                <form action={logout}>
                  <button className="btn btn-ghost btn-sm" type="submit">Sign out</button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {/* useSearchParams needs a boundary during static prerender. */}
        {user && runId !== undefined && (
          <Suspense fallback={<div className="mb-4 h-10" />}>
            <RunNav runId={runId} role={user.role} pending={pending} approved={approved} />
          </Suspense>
        )}
        {children}
      </main>
    </div>
  )
}
