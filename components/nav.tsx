'use client'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ClipboardList, Code2, TestTube2, Network, ListChecks, Settings, Activity } from 'lucide-react'
import { cn } from '@/lib/utils.ts'
import type { Role } from '@/lib/auth/roles.ts'

export type NavItem = {
  href: string
  label: string
  role?: Role            // whose view this is, when it belongs to one
  icon: React.ComponentType<{ className?: string }>
  match: (path: string, view: string | null) => boolean
}

/**
 * D10: reading is open to every signed-in user, and roles only choose a default landing
 * page. So the navigation offers every role's view to everyone — a QA can look at the
 * developer tasks, a BA can see what the delivery lead sees. Only the three gated actions
 * depend on role, and those are enforced where they happen.
 */
export function runNav(runId: number): NavItem[] {
  return [
    { href: `/runs/${runId}`, label: 'Findings', role: 'ba', icon: ClipboardList,
      match: (p) => /\/runs\/\d+$/.test(p) },
    { href: `/runs/${runId}/backlog`, label: 'Stories', role: 'ba', icon: ListChecks,
      match: (p, v) => p.endsWith('/backlog') && (v === null || v === 'all') },
    { href: `/runs/${runId}/backlog?view=tasks`, label: 'Tasks', role: 'dev', icon: Code2,
      match: (p, v) => p.endsWith('/backlog') && v === 'tasks' },
    { href: `/runs/${runId}/backlog?view=tests`, label: 'Tests', role: 'qa', icon: TestTube2,
      match: (p, v) => p.endsWith('/backlog') && v === 'tests' },
    { href: `/runs/${runId}/matrix`, label: 'Traceability', role: 'pm', icon: Network,
      match: (p) => p.endsWith('/matrix') },
  ]
}

export function RunNav({ runId, role }: { runId: number; role: Role }) {
  const path = usePathname()
  const view = useSearchParams().get('view')
  const items = runNav(runId)

  return (
    <nav aria-label="Run views" className="mb-4 overflow-x-auto">
      <ul className="tabs tabs-box w-max">
        {items.map((it) => {
          const active = it.match(path, view)
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? 'page' : undefined}
                    className={cn('tab gap-1.5', active && 'tab-active')}>
                <it.icon className="h-4 w-4" />
                {it.label}
                {it.role === role && (
                  <span className="badge badge-xs badge-primary" title={`Your role's default view`}>you</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function TopNav({ role }: { role: Role }) {
  const path = usePathname()
  const links = [
    { href: '/runs', label: 'Runs', icon: ClipboardList, on: path === '/runs' },
    { href: '/health', label: 'Health', icon: Activity, on: path === '/health' },
    ...(role === 'superadmin'
      ? [{ href: '/settings/model', label: 'Model', icon: Settings, on: path.startsWith('/settings') }]
      : []),
  ]
  return (
    <nav aria-label="Main" className="hidden sm:block">
      <ul className="menu menu-horizontal gap-1 px-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} aria-current={l.on ? 'page' : undefined}
                  className={cn('gap-1.5', l.on && 'menu-active font-medium')}>
              <l.icon className="h-4 w-4" /> {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function MobileNav({ role, runId }: { role: Role; runId?: number }) {
  const items = [
    { href: '/runs', label: 'Runs' },
    ...(runId ? runNav(runId).map((i) => ({ href: i.href, label: i.label })) : []),
    { href: '/health', label: 'Health' },
    ...(role === 'superadmin' ? [{ href: '/settings/model', label: 'Model settings' }] : []),
  ]
  return (
    <div className="dropdown sm:hidden">
      <button className="btn btn-ghost btn-sm" aria-label="Menu">☰</button>
      <ul className="menu dropdown-content z-40 w-56 rounded-box bg-[var(--color-base-100)] p-2 shadow">
        {items.map((i) => <li key={i.href}><Link href={i.href}>{i.label}</Link></li>)}
      </ul>
    </div>
  )
}
