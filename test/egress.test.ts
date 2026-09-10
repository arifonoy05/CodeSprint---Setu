import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateAddress, assertPrivateEndpoint } from '../lib/egress.ts'

test('private ranges are accepted', () => {
  for (const ip of ['10.0.0.1', '127.0.0.1', '172.16.0.1', '172.31.255.255',
                    '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.1.2.3'])
    assert.equal(isPrivateAddress(ip), true, ip)
})

test('public ranges are rejected', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.0.1',
                    '11.0.0.1', '100.128.0.1', '2606:4700::1111'])
    assert.equal(isPrivateAddress(ip), false, ip)
})

test('boundary cases around 172.16/12 and 100.64/10', () => {
  assert.equal(isPrivateAddress('172.15.255.255'), false)
  assert.equal(isPrivateAddress('172.16.0.0'), true)
  assert.equal(isPrivateAddress('172.31.255.255'), true)
  assert.equal(isPrivateAddress('172.32.0.0'), false)
  assert.equal(isPrivateAddress('100.63.255.255'), false)
  assert.equal(isPrivateAddress('100.64.0.0'), true)
  assert.equal(isPrivateAddress('100.127.255.255'), true)
  assert.equal(isPrivateAddress('100.128.0.0'), false)
})

test('accepts a private endpoint', async () => {
  assert.equal(await assertPrivateEndpoint('http://127.0.0.1:1234/v1'), '127.0.0.1')
  assert.equal(await assertPrivateEndpoint('http://host.docker.internal:1234/v1'), 'host.docker.internal')
})

test('refuses a public endpoint', async () => {
  await assert.rejects(() => assertPrivateEndpoint('https://api.openai.com/v1'), /public address/)
  await assert.rejects(() => assertPrivateEndpoint('http://8.8.8.8:1234/v1'), /public address/)
})

test('the refusal names the setting that is wrong, not always the model', async () => {
  // The same check guards the Jira endpoint (D31 applies to any outbound client data).
  await assert.rejects(() => assertPrivateEndpoint('https://x.atlassian.net', 'JIRA_BASE_URL'),
    /JIRA_BASE_URL resolves to a public address/)
  await assert.rejects(() => assertPrivateEndpoint('https://api.openai.com/v1'),
    /LLM_BASE_URL resolves to a public address/)
})

test('refuses malformed and unresolvable', async () => {
  await assert.rejects(() => assertPrivateEndpoint('not-a-url'), /not a valid URL/)
  await assert.rejects(
    () => assertPrivateEndpoint('http://nx-domain-that-does-not-exist-setu.invalid/v1'),
    /does not resolve/)
})
