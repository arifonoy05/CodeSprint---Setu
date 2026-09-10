export type LedgerPosting = {
  account: string
  amount: number
  narrative: string
}

/**
 * Post a credit to the core banking ledger.
 * Synchronous HTTP call to the core banking gateway; returns the ledger reference.
 */
export async function postToLedger(posting: LedgerPosting): Promise<string> {
  const res = await fetch(`${process.env.CORE_BANKING_URL}/postings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(posting),
  })
  if (!res.ok) throw new Error(`ledger posting failed: ${res.status}`)
  const body = (await res.json()) as { ledgerRef: string }
  return body.ledgerRef
}
