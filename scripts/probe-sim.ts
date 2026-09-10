import { readFile } from 'node:fs/promises'
import { parse } from 'yaml'
import { embed } from '../lib/ai/embed.ts'

const cos = (a: number[], b: number[]) => {
  let d = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2 }
  return d / Math.sqrt(na * nb)
}
const truth = (parse(await readFile('fixtures/ground_truth.yaml', 'utf8')) as any).requirements
const got = JSON.parse(await readFile('fixtures/requirements.frozen.json', 'utf8')) as any[]
const [tv, gv] = [await embed(truth.map((r: any) => r.text)), await embed(got.map((r) => r.text))]

console.log('best match per expected requirement:')
truth.forEach((t: any, i: number) => {
  let best = { s: -1, j: -1 }
  gv.forEach((g, j) => { const s = cos(tv[i]!, g); if (s > best.s) best = { s, j } })
  const flag = best.s < 0.88 ? (best.s >= 0.80 ? '  <- rephrased, missed by 0.88' : '  <- genuinely absent?') : ''
  console.log(`  ${t.ref} ${best.s.toFixed(3)}  ${got[best.j]!.text.slice(0, 62)}${flag}`)
})
