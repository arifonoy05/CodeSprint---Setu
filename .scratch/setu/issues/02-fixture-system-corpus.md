# 02 — Fixture system corpus

**What to build:** The pilot system Setu checks requirements against — a small loan-disbursement module a business analyst can read in a few minutes and judge as realistic. Source files, a database schema, and a handful of root-cause analysis tickets describing real past failures. Alongside it, a short page listing the domain assumptions baked in, so a BA can confirm or overturn each one without reading any code.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Source module covering disbursement, repayment scheduling and eligibility, in TypeScript
- [x] Schema file defining the loan, schedule, disbursement transaction and borrower tables
- [x] At least 8 RCA tickets, each naming a root cause rather than only a symptom
- [x] Failure paths present in the code that a careful reader would notice are unhandled
- [x] Assumptions page lists each domain assumption with a stable identifier (A1, A2, …)
- [x] A BA can read the assumptions page in about five minutes and answer yes or no to each

---

## Delivered

`fixtures/loan_disbursement/` — 5 TypeScript source files, `schema.ddl` (6 tables), 9 RCA tickets,
`ASSUMPTIONS.md` (A1–A6).

Unhandled failure paths present in the code, each traceable to an RCA: no idempotency key on
disbursement · holiday calendar table exists but schedule generation never reads it · no reversal
path · check-then-act race on tranche totals · no transaction boundary around an external ledger
call · eligibility gate enforced at one caller but not the batch · restructure deletes partially
paid rows · account status never revalidated · EMI rounding with no residual adjustment.

Assumptions raised from 3 to 6 during authoring — A4 (eligibility re-checked at disbursement),
A5 (tranches are a real product) and A6 (ledger is external and irreversible) each turned out to
carry planted gaps, so leaving them implicit would have hidden three domain calls from the BA.
