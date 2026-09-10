import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, ROLES, LANDING } from '../lib/auth/roles.ts'

test('the approval gate is restricted to BA and superadmin', () => {
  assert.equal(can('ba', 'srs:approve'), true)
  assert.equal(can('superadmin', 'srs:approve'), true)
  for (const r of ['dev', 'qa', 'pm'] as const) {
    assert.equal(can(r, 'srs:approve'), false, `${r} must not approve the SRS`)
    assert.equal(can(r, 'backlog:approve'), false, `${r} must not approve the backlog`)
  }
})

test('dismissing a finding is BA-only — it removes a question from the client sheet', () => {
  assert.equal(can('ba', 'finding:dismiss'), true)
  assert.equal(can('qa', 'finding:dismiss'), false)
  assert.equal(can('pm', 'finding:dismiss'), false)
})

test('export and push allow PM as well', () => {
  assert.equal(can('pm', 'artifact:export'), true)
  assert.equal(can('pm', 'artifact:push'), true)
  assert.equal(can('dev', 'artifact:export'), false)
})

test('uploading a document is BA-only — it starts an expensive run', () => {
  assert.equal(can('ba', 'document:upload'), true)
  assert.equal(can('qa', 'document:upload'), false)
  assert.equal(can('dev', 'document:upload'), false)
})

test('superadmin can do every gated action', () => {
  for (const a of ['document:upload', 'finding:dismiss', 'srs:approve', 'backlog:approve',
                   'artifact:export', 'artifact:push'] as const)
    assert.equal(can('superadmin', a), true, a)
})

test('every role has a landing page', () => {
  for (const r of ROLES) assert.ok(LANDING[r], r)
})
