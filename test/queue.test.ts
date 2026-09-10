import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

/**
 * Regression guards for a run that sat at "queued" for ever: the generate queue did not
 * exist, creation errors were swallowed, and send() returned null without complaint.
 */
test('queue creation errors are not swallowed', async () => {
  const src = await readFile('lib/queue.ts', 'utf8')
  assert.doesNotMatch(src, /createQueue\([^)]*\)\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/,
    'createQueue must not have an empty catch')
  assert.match(src, /throw new Error\(`could not create queue/)
})

test('an enqueue that creates no job throws', async () => {
  const src = await readFile('lib/queue.ts', 'utf8')
  assert.match(src, /if \(!id\) throw new Error/)
})

test('both queues are ensured before use', async () => {
  const src = await readFile('lib/queue.ts', 'utf8')
  assert.match(src, /ensureQueue\(b, QUEUE\)/)
  assert.match(src, /ensureQueue\(b, GENERATE_QUEUE\)/)
})
