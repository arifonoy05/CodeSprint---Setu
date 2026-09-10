import type { Loan } from './eligibility_rules.ts'

export async function getLoan(id: number): Promise<Loan | null> {
  return db.one('loan', id)
}

export async function updateLoanStatus(id: number, status: Loan['status']) {
  return db.update('loan', id, { status })
}

export async function markDisbursed(id: number, amount: number) {
  return db.update('loan', id, {
    status: 'DISBURSED',
    disbursed_at: new Date(),
    disbursed_amount: amount,
  })
}

declare const db: {
  one(t: string, id: number): Promise<any>
  update(t: string, id: number, v: Record<string, unknown>): Promise<void>
}
