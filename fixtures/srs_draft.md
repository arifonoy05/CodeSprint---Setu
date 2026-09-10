# Software Requirements Specification

## Loan Disbursement Enhancement — Phase 2

**Client:** Meghna Bank PLC
**Prepared by:** Business Analysis Team
**Version:** 0.4 (draft, pending client sign-off)

---

## 1. Introduction

This document describes the enhancements agreed with the client for the loan disbursement module.
It covers the release of sanctioned funds to borrowers, the generation of repayment schedules, and
the controls applied at the point of disbursement. Recovery, collections and provisioning are out
of scope for this phase.

## 2. Background

The client currently releases funds through a manual process in which an officer raises a request
and a second officer authorises it in the core banking system. Loan records in the lending module
are updated afterwards by a nightly file. The client wishes to remove the nightly file and have the
lending module drive disbursement directly.

## 3. Functional Requirements

### 3.1 Disbursement

A loan officer shall be able to disburse an approved loan to the borrower in a single transaction.
The system shall record each disbursement together with the reference returned by the core banking
ledger, and shall update the status of the loan to reflect that it has been disbursed.

For construction and education products the client requires funds to be released in stages against
project milestones, so the system shall support partial disbursement in tranches. The total value
released across all tranches must never exceed the sanctioned principal.

### 3.2 Repayment schedule

Once a loan has been disbursed the system shall generate the repayment schedule automatically,
without officer intervention. The first installment shall fall due one month after disbursement.
Installments shall be calculated on a reducing balance basis using the interest rate agreed at
sanction.

Where a loan is restructured, the schedule shall be regenerated to reflect the revised tenor.

### 3.3 Eligibility and controls

The system shall verify borrower eligibility immediately before funds are released, and not rely
solely on checks performed at approval. Borrowers who have been blacklisted by the compliance team
must not receive funds under any circumstances. The system shall also enforce the single borrower
exposure limit set out in the credit policy.

### 3.4 Bulk disbursement

For payroll-backed loans the client processes several hundred disbursements at month end. The
system shall provide a bulk disbursement facility so that an operations user can release these
together rather than one at a time.

### 3.5 Reporting

Finance requires a daily disbursement report.

## 4. Non-Functional Requirements

Disbursement should complete quickly so that officers are not left waiting at the counter. All
actions performed in the module must be auditable.

## 5. Assumptions

Core banking connectivity is available during business hours. Reversal of a disbursement, where
required, continues to be handled by the Finance team in the core banking system.

## 6. Open Items

Holiday handling for installment due dates is to be confirmed with the client.
