import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

/**
 * Chunk identity (D9).
 *
 * IDs are derived deterministically from the source, never assigned by a counter:
 *   - the fixture answer key must cite evidence IDs before any indexing has run
 *   - a citation shown to a BA should read as a place, not as a serial number
 *
 * A chunk boundary IS the citation granularity, so one id names exactly one
 * table, one function, one ticket, or one requirement.
 */

export type ChunkKind = 'requirement' | 'code' | 'ddl' | 'rca'

export type SourceChunk = {
  id: string
  kind: ChunkKind
  sourceRef: string
  text: string
}

export const tableId = (table: string) => `T-${table}`
export const codeId = (file: string, symbol: string) => `C-${file}.${symbol}`
export const rcaId = (ticket: string) => `R-${ticket.replace(/^RCA-/i, '')}`
export const requirementId = (ref: string) => ref // REQ-007 is already the id

/** One chunk per CREATE TABLE. */
export function chunkDdl(ddl: string): SourceChunk[] {
  const out: SourceChunk[] = []
  const re = /CREATE TABLE\s+(\w+)\s*\(/gi
  const starts: { table: string; at: number }[] = []
  for (const m of ddl.matchAll(re)) starts.push({ table: m[1]!, at: m.index! })

  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1]!.at : ddl.length
    out.push({
      id: tableId(s.table),
      kind: 'ddl',
      sourceRef: `table ${s.table}`,
      text: ddl.slice(s.at, end).trim(),
    })
  })
  return out
}

/**
 * One chunk per top-level function or class.
 * ponytail: regex, not a parser — we author these fixtures and control the formatting.
 * Swap for ts-morph only if real repositories land.
 */
export function chunkCode(file: string, src: string): SourceChunk[] {
  const mod = basename(file, extname(file))
  const lines = src.split('\n')
  const re = /^(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/

  const heads: { symbol: string; line: number }[] = []
  lines.forEach((l, i) => {
    const m = l.match(re)
    if (m) heads.push({ symbol: m[1]!, line: i })
  })

  return heads.map((h, i) => {
    const endLine = i + 1 < heads.length ? heads[i + 1]!.line : lines.length
    return {
      id: codeId(mod, h.symbol),
      kind: 'code' as const,
      sourceRef: `${basename(file)}:${h.line + 1}-${endLine}`,
      text: lines.slice(h.line, endLine).join('\n').trimEnd(),
    }
  })
}

/** RCA tickets are short; keep each whole. */
export function chunkRca(file: string, text: string): SourceChunk {
  const ticket = basename(file, extname(file))
  return { id: rcaId(ticket), kind: 'rca', sourceRef: ticket, text: text.trim() }
}

/** Every chunk the fixture corpus yields — the closed set citations must live in. */
export async function chunkFixtureCorpus(root: string): Promise<SourceChunk[]> {
  const out: SourceChunk[] = []

  out.push(...chunkDdl(await readFile(join(root, 'schema.ddl'), 'utf8')))

  const srcDir = join(root, 'src')
  for (const f of (await readdir(srcDir)).filter((f) => f.endsWith('.ts')).sort()) {
    out.push(...chunkCode(f, await readFile(join(srcDir, f), 'utf8')))
  }

  const rcaDir = join(root, 'rca')
  for (const f of (await readdir(rcaDir)).filter((f) => f.endsWith('.md')).sort()) {
    out.push(chunkRca(f, await readFile(join(rcaDir, f), 'utf8')))
  }

  return out
}
