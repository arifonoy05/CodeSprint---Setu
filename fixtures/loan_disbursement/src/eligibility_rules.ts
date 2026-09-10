export type Loan = {
  id: number
  borrowerId: number
  borrowerAccount: string
  principal: number
  tenorMonths: number
  interestRate: number
  status: 'DRAFT' | 'APPROVED' | 'DISBURSED' | 'CLOSED' | 'WRITTEN_OFF'
}

/**
 * Eligibility gate run immediately before disbursement.
 * Mirrors the credit policy in force at sanction time.
 */
export async function checkEligibility(loan: Loan): Promise<{ ok: boolean; reason: string }> {
  const borrower = await db.one('borrower', loan.borrowerId)

  if (borrower.kyc_status !== 'VERIFIED') {
    return { ok: false, reason: 'borrower KYC is not verified' }
  }
  if (borrower.is_blacklisted) {
    return { ok: false, reason: 'borrower is blacklisted' }
  }
  const exposure = await totalExposure(loan.borrowerId)
  if (exposure + loan.principal > SINGLE_BORROWER_LIMIT) {
    return { ok: false, reason: 'single borrower exposure limit exceeded' }
  }
  return { ok: true, reason: '' }
}

export const SINGLE_BORROWER_LIMIT = 5_000_000

export async function totalExposure(borrowerId: number): Promise<number> {
  const loans = await db.query('loan', { borrower_id: borrowerId, status: 'DISBURSED' })
  return loans.reduce((s: number, l: { principal: number }) => s + l.principal, 0)
}

export async function calculateEmi(loanId: number): Promise<number> {
  const loan = await db.one('loan', loanId)
  const r = loan.interest_rate / 12 / 100
  const n = loan.tenor_months
  return (loan.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

declare const db: {
  one(t: string, id: number): Promise<any>
  query(t: string, where: Record<string, unknown>): Promise<Array<{ principal: number }>>
}
