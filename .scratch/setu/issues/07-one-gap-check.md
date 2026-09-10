# 07 — One gap check, end to end

**What to build:** The tracer bullet. For every requirement, retrieve the relevant past failures, ask the model what failure paths the requirement leaves unspecified, and keep only findings that cite evidence actually shown to it. One check, all the way through — because the deterministic machinery around the model is where a silent bug would corrupt every number this project reports, and it is worth getting right once before fanning out to four.

**Blocked by:** 05, 06

**Status:** done

- [x] Reasoning tokens are disabled on every model call — measured 30x on wall clock
- [x] The model sees only retrieved evidence, each labelled, and is told to cite only those
- [x] Cited identifiers are normalised on both sides before comparison
- [x] A finding citing anything outside what was retrieved is dropped, never shown
- [x] A finding citing nothing is dropped
- [x] Dropped findings are recorded with their raw citation text, for diagnosis
- [x] Near-duplicate findings on one requirement merge, keeping the more severe
- [x] Merging preserves what the model originally proposed for every merged finding
- [x] Surviving findings are stored so that a citation cannot point at missing evidence
- [x] Unit tests cover normalisation, filtering, merging and run scoping against fixed inputs

---

## Verified

`failure_path` across 16 requirements, end to end:

```
proposed by model  33
suppressed          1   (3% of proposed)
merged away         0   (single check — dedup matters at ticket 08)
shown to the BA    32
98.7s

severity spread   19 high / 5 medium / 1 low
uncited findings  0
```

18/18 unit tests on the deterministic machinery: normalisation, the closed-set filter, run
scoping, canonicalisation, and union-find dedup including the non-transitivity case.

### The suppression log paid for itself immediately

First run suppressed 19%. Five of six were the model echoing the whole rendered evidence line —
`"[R-1092] (RCA-1092)"` — because the prompt renders evidence as `[ID] (sourceRef)`. Stripping
brackets left the trailing `(RCA-1092)`, so **valid findings were being thrown away as ungrounded**.

Taking the bracketed id, else the leading token: suppression **19% -> 3%**, findings shown
25 -> 32. The one that remains is genuinely correct — the model cited `REQ-014`, a real chunk, but
not one retrieved for a failure-path check.

Without the raw citation string in the log this would have looked like "the model hallucinates
citations" and been mis-fixed by loosening the filter — which would have broken the guarantee the
whole product rests on.

### Timing is worse than DESIGN estimated

99s for one check over 16 requirements is ~6s/call, not the ~3s measured on a bare probe — real
evidence blocks are much larger. Four checks projects to **6-7 minutes**, not 3. Recorded in
DESIGN rather than left as a stale optimistic figure.

### Sample output

```
REQ-001 [high] R-1041
  If a disbursement request is submitted and then the client network times out before
  receiving a confirmation, ...
REQ-001 [high] R-1071
  If the external ledger call succeeds but the internal system transaction record or
  status update fails, ...
```
