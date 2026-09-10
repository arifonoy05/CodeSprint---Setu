# Fixture assumptions — for BA review

This is a synthetic loan-disbursement module. Setu's quality scores are measured against gaps
deliberately planted in it, and **every planted gap rests on one of the assumptions below**
(D35). If an assumption is wrong, only the gaps tagged with it are affected — so please judge
each one independently.

You do not need to read any code. About five minutes.

**How to answer:** for each, write `OK` or `NO — actually …`. A `NO` is useful, not a problem.

---

### A1 — Reversal and write-off are Finance-side, not disbursement-side
Once money has moved, reversing it is done by Finance in the core banking system. The loan module
has no reversal path of its own and is not notified when a reversal happens.

*If wrong:* the module should own reversal, and RCA-1052 describes a bug rather than a boundary.

**Your answer:**

---

### A2 — The holiday calendar should be consulted when the repayment schedule is generated
Due dates are fixed at schedule generation time, so business-day adjustment belongs there. The
alternative is that schedules keep raw calendar dates and the collections or auto-debit layer skips
non-working days at execution time.

*If wrong:* RCA-1047's gap belongs to collections, not to this module.

**Your answer:**

---

### A3 — RCA documents look roughly like this
Identifier `RCA-nnnn`, a stated root cause rather than only a symptom, severity, raised and closed
dates, and a preventive action that is often still open.

*If wrong:* tell us the real identifier format and sections. Pasting one real RCA with names and
figures removed answers this completely.

**Your answer:**

---

### A4 — Eligibility is checked at disbursement time, not only at approval
Credit policy is re-evaluated at the moment of disbursement, because circumstances change between
sanction and release.

*If wrong:* RCA-1078 is not a gap — bypassing the gate would be correct behaviour.

**Your answer:**

---

### A5 — Partial disbursement in tranches is a real product feature
Construction and education loans release funds against milestones, so multiple disbursement
transactions per loan are legitimate. This is why no simple unique constraint prevents RCA-1041.

*If wrong:* one loan means one disbursement, and the duplicate-payment gap has a much simpler fix.

**Your answer:**

---

### A6 — The core banking ledger is an external synchronous call that cannot be rolled back
Disbursement calls a gateway over HTTP. Once it returns success, money has moved and no local
database rollback can undo it.

*If wrong:* if posting is asynchronous or transactional with the module, RCA-1071 changes shape.

---

## Not being asked

Whether the TypeScript is idiomatic, whether the schema is normalised, or whether the code is good.
It is deliberately flawed — the flaws are the test data.
