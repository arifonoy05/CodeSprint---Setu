import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normaliseId, filterToRetrieved, canonicalise, dedupe,
  type Candidate,
} from '../lib/pipeline/postprocess.ts'

const c = (over: Partial<Candidate> = {}): Candidate => ({
  requirementRef: 'REQ-001',
  gapClass: 'failure_path',
  gap: 'a gap',
  severity: 'medium',
  question: 'a question',
  evidence_ids: ['R-1041'],
  ...over,
})

// --- normalisation: the model returns bracketed ids on both runtimes (D17) ---
test('normalisation strips the wrappers models actually emit', () => {
  assert.equal(normaliseId('[R-1041]'), 'R-1041')
  assert.equal(normaliseId('`R-1041`'), 'R-1041')
  assert.equal(normaliseId(' R-1041 '), 'R-1041')
  assert.equal(normaliseId('"R-1041"'), 'R-1041')
  assert.equal(normaliseId('RCA-1041'), 'R-1041', 'RCA- and R- name the same ticket')
  assert.equal(normaliseId('rca-1041'), 'R-1041')
})

test('the model echoing back the whole evidence line still resolves', () => {
  // The prompt renders evidence as "[ID] (sourceRef)". Models echo the line verbatim.
  // Measured: this was 5 of 6 suppressions on the first real run — valid findings
  // discarded as ungrounded because of formatting.
  assert.equal(normaliseId('[R-1092] (RCA-1092)'), 'R-1092')
  assert.equal(normaliseId('[T-loan] (table loan)'), 'T-loan'.toUpperCase())
  assert.equal(
    normaliseId('[C-disbursement_service.disburse] (disbursement_service.ts:17-41)'),
    'C-DISBURSEMENT_SERVICE.DISBURSE',
  )
  const { kept } = filterToRetrieved([c({ evidence_ids: ['[R-1092] (RCA-1092)'] })], ['R-1092'])
  assert.equal(kept.length, 1, 'formatting must not be mistaken for hallucination')
})

test('a genuinely wrong id is still suppressed after the fix', () => {
  const { suppressed } = filterToRetrieved([c({ evidence_ids: ['[R-9999] (RCA-9999)'] })], ['R-1092'])
  assert.equal(suppressed[0]!.reason, 'out_of_set', 'the filter must not become permissive')
})

test('normalisation is case-insensitive but keeps ids distinct', () => {
  assert.equal(normaliseId('c-disbursement_service.disburse'), normaliseId('C-Disbursement_Service.Disburse'))
  assert.notEqual(normaliseId('C-a.disburse'), normaliseId('C-a.disburseTranche'))
})

// --- the citation guarantee (D3) ------------------------------------------
test('a finding citing nothing is suppressed', () => {
  const { kept, suppressed } = filterToRetrieved([c({ evidence_ids: [] })], ['R-1041'])
  assert.equal(kept.length, 0)
  assert.equal(suppressed[0]!.reason, 'no_evidence')
})

test('a finding citing outside the retrieved set is suppressed', () => {
  const { kept, suppressed } = filterToRetrieved([c({ evidence_ids: ['R-9999'] })], ['R-1041'])
  assert.equal(kept.length, 0)
  assert.equal(suppressed[0]!.reason, 'out_of_set')
})

test('one bad citation suppresses the whole finding', () => {
  const { kept } = filterToRetrieved([c({ evidence_ids: ['R-1041', 'R-9999'] })], ['R-1041'])
  assert.equal(kept.length, 0, 'partially grounded is not grounded')
})

test('bracketed citations survive the filter', () => {
  const { kept } = filterToRetrieved([c({ evidence_ids: ['[R-1041]'] })], ['R-1041'])
  assert.equal(kept.length, 1, 'formatting must not be mistaken for hallucination')
})

test('suppressed findings keep their raw citation text for diagnosis', () => {
  const { suppressed } = filterToRetrieved([c({ evidence_ids: ['[R-9999]'] })], ['R-1041'])
  assert.match(suppressed[0]!.rawEvidence, /R-9999/)
})

test('canonicalise maps a normalised citation back to the real chunk id', () => {
  assert.deepEqual(canonicalise(c({ evidence_ids: ['[rca-1041]'] }), ['R-1041']), ['R-1041'])
})

// --- run scoping (D23) ----------------------------------------------------
test('another run\'s requirement chunk is out of set', () => {
  const { kept, suppressed } = filterToRetrieved(
    [c({ gapClass: 'missing_ac', evidence_ids: ['REQ-007@2'] })], ['REQ-007@1'])
  assert.equal(kept.length, 0, 'a real id from the wrong run must not pass')
  assert.equal(suppressed[0]!.reason, 'out_of_set')
})

// --- dedup (D20) ----------------------------------------------------------
const withEv = (over: Partial<Candidate> & { evidenceIds: string[] }) =>
  ({ ...c(over), ...over })

test('findings sharing evidence on one requirement merge', () => {
  const out = dedupe([
    withEv({ gapClass: 'failure_path', severity: 'medium', evidenceIds: ['R-1041'] }),
    withEv({ gapClass: 'contradiction', severity: 'high', evidenceIds: ['R-1041'] }),
  ])
  const survivors = out.filter((o) => o.mergedIntoIndex === null)
  assert.equal(survivors.length, 1)
  assert.equal(survivors[0]!.severity, 'high', 'highest severity survives')
  assert.deepEqual(survivors[0]!.mergedClasses.sort(), ['contradiction', 'failure_path'])
})

test('merging discards nothing — losers are kept and point at the survivor', () => {
  const out = dedupe([
    withEv({ severity: 'low', gap: 'the loser', evidenceIds: ['R-1041'] }),
    withEv({ severity: 'high', gap: 'the survivor', evidenceIds: ['R-1041'] }),
  ])
  assert.equal(out.length, 2, 'D14: what the AI proposed is immutable, including the merged-away')
  const loser = out.find((o) => o.mergedIntoIndex !== null)!
  assert.equal(loser.gap, 'the loser')
  assert.equal(out[loser.mergedIntoIndex!]!.gap, 'the survivor')
})

test('overlap is not transitive — a chain still forms ONE group', () => {
  // A∩B={x}, B∩C={y}, A∩C=∅. "Group by overlap" is undefined here; components are not.
  const out = dedupe([
    withEv({ gap: 'A', evidenceIds: ['x'] }),
    withEv({ gap: 'B', evidenceIds: ['x', 'y'] }),
    withEv({ gap: 'C', evidenceIds: ['y'] }),
  ])
  assert.equal(out.filter((o) => o.mergedIntoIndex === null).length, 1)
})

test('findings on different requirements never merge', () => {
  const out = dedupe([
    withEv({ requirementRef: 'REQ-001', evidenceIds: ['R-1041'] }),
    withEv({ requirementRef: 'REQ-002', evidenceIds: ['R-1041'] }),
  ])
  assert.equal(out.filter((o) => o.mergedIntoIndex === null).length, 2)
})

test('findings with no shared evidence stay separate', () => {
  const out = dedupe([
    withEv({ evidenceIds: ['R-1041'] }),
    withEv({ evidenceIds: ['R-1047'] }),
  ])
  assert.equal(out.filter((o) => o.mergedIntoIndex === null).length, 2)
})

test('the survivor carries the union of all merged evidence', () => {
  const out = dedupe([
    withEv({ severity: 'high', evidenceIds: ['R-1041'] }),
    withEv({ severity: 'low', evidenceIds: ['R-1041', 'T-loan'] }),
  ])
  const s = out.find((o) => o.mergedIntoIndex === null)!
  assert.deepEqual(s.evidenceIds.sort(), ['R-1041', 'T-loan'])
})

test('dedup is stable when severities tie', () => {
  const a = dedupe([withEv({ gap: 'first', evidenceIds: ['x'] }), withEv({ gap: 'second', evidenceIds: ['x'] })])
  const b = dedupe([withEv({ gap: 'first', evidenceIds: ['x'] }), withEv({ gap: 'second', evidenceIds: ['x'] })])
  assert.deepEqual(a.map((o) => o.mergedIntoIndex), b.map((o) => o.mergedIntoIndex))
})
