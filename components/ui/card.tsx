import * as React from 'react'
import { cn } from '@/lib/utils.ts'

const make = (tag: 'div' | 'h3' | 'p', base: string) =>
  React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ className, ...props }, ref) =>
    React.createElement(tag, { ref, className: cn(base, className), ...props }))

export const Card = make('div',
  'rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-base-100)] shadow-sm')
export const CardHeader = make('div', 'flex flex-col space-y-1.5 p-5')
export const CardTitle = make('h3', 'text-lg font-semibold leading-none tracking-tight')
export const CardDescription = make('p', 'text-sm opacity-70')
export const CardContent = make('div', 'p-5 pt-0')
export const CardFooter = make('div', 'flex items-center p-5 pt-0')
Card.displayName = 'Card'
