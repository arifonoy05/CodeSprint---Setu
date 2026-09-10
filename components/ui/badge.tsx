import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils.ts'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]',
        secondary: 'border-transparent bg-[var(--color-base-200)] text-[var(--color-base-content)]',
        destructive: 'border-transparent bg-[var(--color-error)] text-[var(--color-error-content)]',
        warning: 'border-transparent bg-[var(--color-warning)] text-[var(--color-warning-content)]',
        success: 'border-transparent bg-[var(--color-success)] text-[var(--color-success-content)]',
        info: 'border-transparent bg-[var(--color-info)] text-[var(--color-info-content)]',
        outline: 'text-[var(--color-base-content)] border-[var(--color-border)]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Badge({ className, variant, ...props }:
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { badgeVariants }
