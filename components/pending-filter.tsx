'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Filter } from 'lucide-react'

/**
 * With forty items awaiting a decision, the useful question is not how many remain but
 * which. A linkable filter beats scrolling for the ones without a badge.
 */
export function PendingFilter({ pending, total, noun }: {
  pending: number; total: number; noun: string
}) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const on = params.get('pending') === '1'

  const toggle = () => {
    const next = new URLSearchParams(params)
    if (on) next.delete('pending')
    else next.set('pending', '1')
    router.push(`${path}${next.size ? `?${next}` : ''}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="opacity-70">
        {pending === 0
          ? `All ${total} ${noun} decided.`
          : `${pending} of ${total} ${noun} still need a decision.`}
      </span>
      {(pending > 0 || on) && (
        <button onClick={toggle}
                className={`btn btn-xs gap-1 ${on ? 'btn-warning' : 'btn-outline'}`}
                aria-pressed={on}>
          <Filter className="h-3 w-3" aria-hidden />
          {on ? 'Showing pending only' : 'Show pending only'}
        </button>
      )}
    </div>
  )
}
