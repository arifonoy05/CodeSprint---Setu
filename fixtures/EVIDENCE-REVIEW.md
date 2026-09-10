# Evidence review — for the BA

We measure Setu by planting gaps in a fake system and checking it finds them. A gap counts as
found only if Setu **cites evidence we agreed counts** for that gap.

That list was originally one or two items per gap and turned out too narrow: Setu was finding the
right problems but pointing at different, arguably equally valid, evidence. We widened it by one
rule — *the incident that documents the gap, the function that exhibits it, and the table whose
structure permits it*.

**We need you to check that rule produced sensible lists.** For each gap: would you accept each
item as showing that problem? Mark anything you would not.

Nothing here requires reading code. About fifteen minutes.

---

## missing ac

### G01 — REQ-001

**The gap:** "single transaction" is never defined; no criteria for the ledger succeeding and the local write failing

- [ ] requirement — "A loan officer shall be able to disburse an approved loan to the borro…"  *(original)*
- [ ] requirement — "The system shall record each disbursement together with the reference …"
- [ ] requirement — "The system shall update the status of the loan to reflect that it has …"

Anything you would not accept? 

### G02 — REQ-004

**The gap:** what constitutes a milestone, who confirms it, and how many tranches are permitted are all unstated

- [ ] requirement — "The system shall support partial disbursement in tranches against proj…"  *(original)*
- [ ] requirement — "The total value released across all tranches must never exceed the san…"

Anything you would not accept? 

### G03 — REQ-008

**The gap:** no rounding convention and no rule for the residual on the final installment

- [ ] requirement — "Installments shall be calculated on a reducing balance basis using the…"  *(original)*
- [ ] requirement — "The first installment shall fall due one month after disbursement.…"

Anything you would not accept? 

### G04 — REQ-009

**The gap:** restructure behaviour for partially paid installments is undefined

- [ ] requirement — "Where a loan is restructured, the schedule shall be regenerated to ref…"  *(original)*
- [ ] requirement — "Once a loan has been disbursed the system shall generate the repayment…"
- [ ] requirement — "Installments shall be calculated on a reducing balance basis using the…"

Anything you would not accept? 

### G05 — REQ-013

**The gap:** no criteria for partial batch failure — whether the batch stops, skips or rolls back

- [ ] requirement — "The system shall provide a bulk disbursement facility so that an opera…"  *(original)*
- [ ] requirement — "The system shall verify borrower eligibility immediately before funds …"
- [ ] requirement — "A loan officer shall be able to disburse an approved loan to the borro…"

Anything you would not accept? 

### G06 — REQ-014

**The gap:** one sentence with no content, format, delivery mechanism or cut-off time

- [ ] requirement — "Finance requires a daily disbursement report.…"  *(original)*
- [ ] requirement — "The system shall record each disbursement together with the reference …"

Anything you would not accept? 

### G07 — REQ-015

**The gap:** "quickly" is unmeasurable — no target, no percentile, no load assumption

- [ ] requirement — "Disbursement should complete quickly so that officers are not left wai…"  *(original)*
- [ ] requirement — "A loan officer shall be able to disburse an approved loan to the borro…"

Anything you would not accept? 

### G08 — REQ-016

**The gap:** "auditable" without fields, retention period or who may read the trail

- [ ] requirement — "All actions performed in the module must be auditable.…"  *(original)*
- [ ] requirement — "The system shall record each disbursement together with the reference …"

Anything you would not accept? 

## failure path

### G09 — REQ-001

**The gap:** retry after timeout disburses twice; no idempotency key and no unique constraint

- [ ] incident RCA-1041  *(original)*
- [ ] the function disburse() in disbursement_service.ts  *(original)*
- [ ] the function createDisbursementTxn() in disbursement_service.ts
- [ ] the table disbursement_txn

Anything you would not accept? 

### G10 — REQ-001

**The gap:** crash after the ledger posting leaves money moved with no record of it

- [ ] incident RCA-1071  *(original)*
- [ ] the function disburse() in disbursement_service.ts  *(original)*
- [ ] the function postToLedger() in ledger_client.ts
- [ ] the function attachLedgerRef() in disbursement_service.ts
- [ ] the table disbursement_txn

Anything you would not accept? 

### G11 — REQ-002

**The gap:** ledger_ref is nullable and written after posting, so a null is indistinguishable from a failed post

- [ ] incident RCA-1071  *(original)*
- [ ] the table disbursement_txn  *(original)*
- [ ] the function attachLedgerRef() in disbursement_service.ts
- [ ] the function postToLedger() in ledger_client.ts

Anything you would not accept? 

### G12 — REQ-005

**The gap:** concurrent tranche releases both read the total before either writes

- [ ] incident RCA-1063  *(original)*
- [ ] the function totalReleased() in disbursement_service.ts  *(original)*
- [ ] the function disburseTranche() in disbursement_service.ts
- [ ] the table disbursement_txn

Anything you would not accept? 

### G13 — REQ-006

**The gap:** due dates land on holidays and weekends; auto-debit fails and performing loans are flagged

- [ ] incident RCA-1047  *(original)*
- [ ] the function buildSchedule() in repayment_schedule.ts  *(original)*
- [ ] the table holiday_calendar
- [ ] the function addMonths() in repayment_schedule.ts
- [ ] the table loan_schedule

Anything you would not accept? 

### G14 — REQ-009

**The gap:** regeneration deletes partially paid rows, orphaning repayment references

- [ ] incident RCA-1085  *(original)*
- [ ] the function rebuildSchedule() in repayment_schedule.ts  *(original)*
- [ ] the table loan_schedule
- [ ] the table repayment

Anything you would not accept? 

### G15 — REQ-010

**The gap:** borrower account may be closed between application and disbursement; a 2xx is treated as success

- [ ] incident RCA-1092  *(original)*
- [ ] the function postToLedger() in ledger_client.ts  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts
- [ ] the table loan
- [ ] the table borrower

Anything you would not accept? 

### G16 — REQ-008

**The gap:** rounding drift over long tenors leaves the final installment disputed

- [ ] incident RCA-1104  *(original)*
- [ ] the function calculateEmi() in eligibility_rules.ts  *(original)*
- [ ] the table loan_schedule
- [ ] the function buildSchedule() in repayment_schedule.ts

Anything you would not accept? 

## contradiction

### G17 — REQ-001

**The gap:** "a single transaction" contradicts tranche disbursement, which creates several

- [ ] requirement — "The system shall support partial disbursement in tranches against proj…"  *(original)*
- [ ] the function disburseTranche() in disbursement_service.ts  *(original)*
- [ ] the function disburse() in disbursement_service.ts
- [ ] the function totalReleased() in disbursement_service.ts
- [ ] the table disbursement_txn

Anything you would not accept? 

### G18 — REQ-003

**The gap:** status is only set to DISBURSED when the last tranche lands, so a part-disbursed loan reads as APPROVED

- [ ] the function disburseTranche() in disbursement_service.ts  *(original)*
- [ ] the function markDisbursed() in loan_repository.ts
- [ ] the function updateLoanStatus() in loan_repository.ts
- [ ] the table loan

Anything you would not accept? 

### G19 — REQ-011

**The gap:** the batch path writes transactions directly and never calls the eligibility gate

- [ ] incident RCA-1078  *(original)*
- [ ] the function createDisbursementTxn() in disbursement_service.ts  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts
- [ ] the function disburse() in disbursement_service.ts
- [ ] the table borrower

Anything you would not accept? 

### G20 — REQ-013

**The gap:** bulk disbursement as built bypasses the very check REQ-010 requires

- [ ] incident RCA-1078  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts  *(original)*
- [ ] the function createDisbursementTxn() in disbursement_service.ts
- [ ] the function disburse() in disbursement_service.ts

Anything you would not accept? 

### G21 — REQ-007

**The gap:** "one month after disbursement" is ambiguous for tranches; the code uses the date of the last one

- [ ] the function buildSchedule() in repayment_schedule.ts  *(original)*
- [ ] the function disburseTranche() in disbursement_service.ts  *(original)*
- [ ] the function addMonths() in repayment_schedule.ts
- [ ] the table loan_schedule

Anything you would not accept? 

### G22 — REQ-012

**The gap:** exposure counts only DISBURSED loans, so approved-but-undisbursed lending is invisible to the limit

- [ ] the function totalExposure() in eligibility_rules.ts  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts
- [ ] the table loan

Anything you would not accept? 

### G23 — REQ-006

**The gap:** schedule generation is skipped entirely for part-disbursed loans, contradicting "automatically"

- [ ] the function disburseTranche() in disbursement_service.ts  *(original)*
- [ ] the function buildSchedule() in repayment_schedule.ts  *(original)*
- [ ] the function disburse() in disbursement_service.ts
- [ ] the table loan_schedule

Anything you would not accept? 

## dependency

### G24 — REQ-006

**The gap:** a holiday calendar table exists and is maintained by Operations, but nothing reads it

- [ ] the table holiday_calendar  *(original)*
- [ ] the function buildSchedule() in repayment_schedule.ts
- [ ] the function addMonths() in repayment_schedule.ts
- [ ] incident RCA-1047

Anything you would not accept? 

### G25 — REQ-001

**The gap:** depends on the core banking gateway, whose availability window the SRS never states

- [ ] the function postToLedger() in ledger_client.ts  *(original)*
- [ ] the function disburse() in disbursement_service.ts
- [ ] incident RCA-1071
- [ ] the table disbursement_txn

Anything you would not accept? 

### G26 — REQ-003

**The gap:** Finance reverses disbursements outside this module and nothing notifies it, so status goes stale

- [ ] incident RCA-1052  *(original)*
- [ ] the function markDisbursed() in loan_repository.ts
- [ ] the table loan
- [ ] the table disbursement_txn

Anything you would not accept? 

### G27 — REQ-009

**The gap:** repayment rows reference schedule rows with no defined foreign key action on regeneration

- [ ] the table repayment  *(original)*
- [ ] the table loan_schedule  *(original)*
- [ ] the function rebuildSchedule() in repayment_schedule.ts
- [ ] incident RCA-1085

Anything you would not accept? 

### G28 — REQ-014

**The gap:** the report spans two tables whose reconciliation is already known to drift

- [ ] the table disbursement_txn  *(original)*
- [ ] the table loan  *(original)*
- [ ] incident RCA-1052
- [ ] the function createDisbursementTxn() in disbursement_service.ts

Anything you would not accept? 

### G29 — REQ-011

**The gap:** the blacklist flag lives on borrower and is set by Compliance after approval; no re-check is specified

- [ ] the table borrower  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts
- [ ] incident RCA-1078

Anything you would not accept? 

### G30 — REQ-012

**The gap:** the limit is enforced per borrower across loans, a relationship the requirement never mentions

- [ ] the table loan  *(original)*
- [ ] the function totalExposure() in eligibility_rules.ts  *(original)*
- [ ] the function checkEligibility() in eligibility_rules.ts
- [ ] the table borrower

Anything you would not accept? 

