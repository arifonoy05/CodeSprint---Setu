import Link from 'next/link'
import { FileSearch } from 'lucide-react'
import { ThemeSwitcher } from './theme-switcher.tsx'
import { Badge } from './ui/badge.tsx'
import { logout } from '@/lib/auth/actions.ts'
import type { SessionUser } from '@/lib/auth/session.ts'

export function AppShell({ user, children }: { user?: SessionUser | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-base-200)]">
      <header className="navbar sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-base-100)] px-4">
        <div className="flex-1 items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            <FileSearch className="h-5 w-5 text-[var(--color-primary)]" aria-hidden />
            Setu
          </Link>
          <span className="hidden text-xs opacity-60 sm:inline">SRS to sprint-ready backlog</span>
        </div>
        <div className="flex flex-none items-center gap-3">
          <ThemeSwitcher />
          {user && (
            <>
              <span className="hidden items-center gap-2 text-sm sm:flex">
                {user.name}
                <Badge variant="secondary">{user.role}</Badge>
              </span>
              <form action={logout}>
                <button className="btn btn-ghost btn-sm" type="submit">Sign out</button>
              </form>
            </>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  )
}
