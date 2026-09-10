import { getLoan, markDisbursed, updateLoanStatus } from './loan_repository.ts'
import { postToLedger } from './ledger_client.ts'
import { buildSchedule } from './repayment_schedule.ts'
import { checkEligibility } from './eligibility_rules.ts'

export type DisbursementRequest = {
  loanId: number
  amount: number
  officerId: number
}

/**
 * Disburse an approved loan to the borrower's account.
 *
 * Called by the officer-facing screen and by the bulk disbursement batch.
 */
export async function disburse(req: DisbursementRequest) {
  const loan = await getLoan(req.loanId)
  if (!loan) throw new Error(`loan ${req.loanId} not found`)
  if (loan.status !== 'APPROVED') throw new Error(`loan ${req.loanId} is ${loan.status}, not APPROVED`)

  const eligibility = await checkEligibility(loan)
  if (!eligibility.ok) throw new Error(eligibility.reason)

  const txn = await createDisbursementTxn(loan.id, req.amount, req.officerId)
  const ledgerRef = await postToLedger({
    account: loan.borrowerAccount,
    amount: req.amount,
    narrative: `Disbursement for loan ${loan.id}`,
  })

  await attachLedgerRef(txn.id, ledgerRef)
  await buildSchedule(loan.id, loan.tenorMonths, new Date())
  await markDisbursed(loan.id, req.amount)
  return txn
}

/**
 * Partial disbursement — used for construction and education loans where funds are
 * released in tranches against milestones.
 */
export async function disburseTranche(req: DisbursementRequest & { trancheNo: number }) {
  const loan = await getLoan(req.loanId)
  if (!loan) throw new Error(`loan ${req.loanId} not found`)

  const released = await totalReleased(loan.id)
  if (released + req.amount > loan.principal) {
    throw new Error('tranche would exceed sanctioned principal')
  }

  const txn = await createDisbursementTxn(loan.id, req.amount, req.officerId)
  const ledgerRef = await postToLedger({
    account: loan.borrowerAccount,
    amount: req.amount,
    narrative: `Tranche ${req.trancheNo} for loan ${loan.id}`,
  })
  await attachLedgerRef(txn.id, ledgerRef)

  if (released + req.amount === loan.principal) {
    await updateLoanStatus(loan.id, 'DISBURSED')
    await buildSchedule(loan.id, loan.tenorMonths, new Date())
  }
  return txn
}

export async function createDisbursementTxn(loanId: number, amount: number, officerId: number) {
  return db.insert('disbursement_txn', {
    loan_id: loanId,
    amount,
    created_by: officerId,
    created_at: new Date(),
  })
}

async function attachLedgerRef(txnId: number, ledgerRef: string) {
  return db.update('disbursement_txn', txnId, { ledger_ref: ledgerRef })
}

export async function totalReleased(loanId: number): Promise<number> {
  const rows = await db.query('disbursement_txn', { loan_id: loanId })
  return rows.reduce((sum: number, r: { amount: number }) => sum + r.amount, 0)
}

declare const db: {
  insert(t: string, v: Record<string, unknown>): Promise<{ id: number }>
  update(t: string, id: number, v: Record<string, unknown>): Promise<void>
  query(t: string, where: Record<string, unknown>): Promise<Array<{ amount: number }>>
}
