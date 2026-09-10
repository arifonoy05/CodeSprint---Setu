import * as React from 'react'
import { cn } from '@/lib/utils.ts'

export const Table = ({ className, ...p }: React.HTMLAttributes<HTMLTableElement>) => (
  <div className="relative w-full overflow-x-auto">
    <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
  </div>
)
export const TableHeader = (p: React.HTMLAttributes<HTMLTableSectionElement>) =>
  <thead className="[&_tr]:border-b [&_tr]:border-[var(--color-border)]" {...p} />
export const TableBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) =>
  <tbody className="[&_tr:last-child]:border-0" {...p} />
export const TableRow = ({ className, ...p }: React.HTMLAttributes<HTMLTableRowElement>) =>
  <tr className={cn('border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-base-200)]/50', className)} {...p} />
export const TableHead = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) =>
  <th className={cn('h-10 px-3 text-left align-middle text-xs font-medium uppercase tracking-wide opacity-60', className)} {...p} />
export const TableCell = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) =>
  <td className={cn('p-3 align-top', className)} {...p} />
