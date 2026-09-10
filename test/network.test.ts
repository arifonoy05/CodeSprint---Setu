import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.SETU_IN_CONTAINER = 'true'
const { adviseUrl, inContainer } = await import('../lib/model/network.ts')

test('inside a container, loopback addresses are flagged with a fix', () => {
  assert.equal(inContainer(), true)
  for (const host of ['localhost', '127.0.0.1', '0.0.0.0']) {
    const a = adviseUrl(`http://${host}:1234/v1`)
    assert.ok(a, host)
    assert.equal(a!.suggestion, 'http://host.docker.internal:1234/v1')
    assert.match(a!.problem, /container itself/)
  }
})

test('the port and path are preserved', () => {
  assert.equal(adviseUrl('http://localhost:8000/v1')!.suggestion, 'http://host.docker.internal:8000/v1')
  assert.equal(adviseUrl('http://127.0.0.1:11434/v1')!.suggestion, 'http://host.docker.internal:11434/v1')
})

test('a real address is left alone — it may genuinely be another machine', () => {
  for (const url of ['http://10.0.4.20:1234/v1', 'http://host.docker.internal:1234/v1',
                     'https://api.openai.com/v1', 'http://192.168.1.50:8080/v1'])
    assert.equal(adviseUrl(url), null, url)
})

test('nonsense input does not throw', () => {
  assert.equal(adviseUrl('not a url'), null)
  assert.equal(adviseUrl(''), null)
})
