import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { toVector } from '../lib/ai/embed.ts'

test('vectors serialise in pgvector literal form', () => {
  assert.equal(toVector([1, 2.5, -0.25]), '[1,2.5,-0.25]')
})

test('embed always pins encoding_format to float', async () => {
  // Regression guard: the SDK default is base64, which decodes to 192 dims against
  // LM Studio and corrupts every retrieval silently. See lib/ai/embed.ts.
  const src = await readFile('lib/ai/embed.ts', 'utf8')
  assert.match(src, /encoding_format:\s*'float'/)
})
