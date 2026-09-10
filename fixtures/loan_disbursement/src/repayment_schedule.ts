import { calculateEmi } from './eligibility_rules.ts'

export type ScheduleRow = {
  loanId: number
  installmentNo: number
  dueDate: Date
  installment: number
  paid: boolean
}

/**
 * Build the repayment schedule for a disbursed loan.
 * One row per month, first installment one month after disbursement.
 */
export async function buildSchedule(loanId: number, tenorMonths: number, startDate: Date) {
  const emi = await calculateEmi(loanId)
  const rows: ScheduleRow[] = []
  let due = startDate

  for (let i = 1; i <= tenorMonths; i++) {
    due = addMonths(due, 1)
    rows.push({ loanId, installmentNo: i, dueDate: due, installment: emi, paid: false })
  }

  await db.insertMany('loan_schedule', rows)
  return rows
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

/**
 * Regenerate the schedule after a restructure. Replaces all unpaid rows.
 */
export async function rebuildSchedule(loanId: number, newTenor: number) {
  await db.deleteWhere('loan_schedule', { loan_id: loanId, paid: false })
  const loan = await db.one('loan', loanId)
  return buildSchedule(loanId, newTenor, loan.disbursed_at)
}

declare const db: {
  insertMany(t: string, rows: unknown[]): Promise<void>
  deleteWhere(t: string, where: Record<string, unknown>): Promise<void>
  one(t: string, id: number): Promise<{ disbursed_at: Date }>
}
