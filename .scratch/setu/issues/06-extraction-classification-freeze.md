# 06 — Requirement extraction and the frozen set

**What to build:** Prose in, discrete numbered requirements out, each classified as functional, non-functional, business rule or constraint. The requirements themselves become searchable evidence, scoped to the run that produced them, so one document can never cite another's. Plus the two things that make quality measurable: a deliberate command that freezes a reviewed requirement set for evaluation, and a score for how well segmentation matched the answer key.

**Blocked by:** 03, 05

**Status:** done

- [x] Extraction segments prose into atomic requirements, each with a classification
- [x] Requirements are indexed as evidence, scoped to their run
- [x] Retrieval never returns requirements belonging to a different run
- [x] ~~A freeze command regenerates the evaluation requirement set~~ — **removed by design, see below**
- [x] Freezing never happens automatically — there is nothing to freeze
- [x] Extraction is scored against the answer key's expected segmentation

---

## Verified

```
docx -> 3,069 chars -> 16-20 requirements, ~21s

  segmentation recall      0.94 - 1.00   (varies by run)
  segmentation precision   0.80 - 0.94
  classification accuracy  0.93 - 0.94
```

Run isolation (D23) proven: two runs over the same document produced 31 requirement chunks; each
run's retrieval returned only its own — zero foreign chunks. Chunk ids are `REQ-007@<runId>`,
because `REQ-007` exists in every run.

### The freeze command was removed, not implemented

Building it exposed why it cannot work. Gap entries in the answer key are keyed to *its* `REQ-007`.
A captured extraction run renumbers and rephrases, so its `REQ-007` is a different requirement —
every gap key would silently point at the wrong one, and `eval:gaps` would still print a confident
number. **The answer key's `requirements` list is the frozen set.** One file, no drift possible.

Measured extraction variance across four runs — 15, 16, 17, 20 requirements — is exactly what this
keeps out of the gap numbers.

### Match threshold calibrated, not guessed

0.88 rejected two true matches that were the model rephrasing ("Finance requires a daily
disbursement report" -> "The system shall provide a daily disbursement report"). The observed
distribution put every true match at 0.872-1.000, so the threshold is 0.85.
