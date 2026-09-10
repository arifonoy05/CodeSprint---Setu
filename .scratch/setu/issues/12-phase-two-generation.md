# 12 — Generate the backlog

**What to build:** From the approved requirements, what each role actually needs: user stories with acceptance criteria in Given/When/Then form, a development task breakdown naming the modules and tables each one touches, and test scenarios covering the failure paths raised during review. Each links back to the requirement it came from — a fact known at the moment of generation, so no matching is needed to recover it. Everything is reviewed and approved by a person before it counts.

**Blocked by:** 11

**Status:** done

- [x] Stories carry acceptance criteria in Given/When/Then form
- [x] Development tasks name the modules and tables they touch, drawn from gathered evidence
- [x] Test scenarios include negative paths, seeded from findings raised in review
- [x] Links between requirement, story and test are recorded as they are generated
- [x] No extra model call is spent rediscovering links already known
- [x] Every generated artifact is editable and separately approvable
- [x] What the model proposed stays visible after a human edits it
- [x] Backlog approval is timestamped, so time-to-backlog can be measured

---

## Verified

```
stories 19 · tasks 91 · tests 175 (135 negative, 61 seeded from a reviewed gap)
trace links 175 · coverage 18/18 have a story, 18/18 have a test · 670s
```

Role views render as D10 specifies:

```
ba   criteria:y tasks:y tests:y gap-linked:y approve:y
dev  criteria:n tasks:y tests:n gap-linked:n approve:n
qa   criteria:y tasks:n tests:y gap-linked:y approve:n
```

An unapproved run refuses to generate: *"run is not approved — nothing is generated before sign-off"*.

## Three defects found by looking at the output, not by testing that it ran

### 1. Tasks invented modules and tables that do not exist

First generation produced `disbursement_requests`, `loan_terms`, `loan_ledgers`, `accounts`,
`PaymentProcessing` — **none of which are in the fixture**. The prompt said "use only names that
appear below, do not invent names". The model ignored it.

Same lesson as D3: an instruction is not a guarantee. Names are now filtered against the real
corpus. Every name in the final backlog is real:

```
tables:  loan 54 · loan_schedule 43 · disbursement_txn 38 · repayment 36 · borrower 19 · holiday_calendar 14
modules: disbursement_service 63 · eligibility_rules 23 · loan_repository 21 · repayment_schedule 4
```

### 2. Zero tests were linked to the gaps they cover

`132 tests, 84 negative, 0 seeded from a reviewed gap` — the BRD's "test scenarios covering the
failure paths flagged in Phase 1" silently did not exist, because the link depended on the model
echoing back a `GAP-id` it had been shown, and it never did.

Gap scenarios are now generated one per gap, index-aligned, so the link is structural — the same
reasoning as D30. **0 -> 61 seeded.**

### 3. The task vocabulary came from the wrong question

After filtering, every task came back with empty modules and tables. The vocabulary was derived from
what a requirement's *findings cited* — but REQ-001's four findings all cite incident reports and no
code or schema at all.

"Which modules and tables does this touch" is a **retrieval** question about the requirement.
Findings cite evidence *for a gap*, which is a different question. Deriving the vocabulary from
retrieval fixed it, and the closed-set filter still guards the result.

**All three would have passed a test that only checked generation completed.**
