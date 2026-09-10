import { llm } from './client.ts'
import { env } from '../env.ts'
import type { Retrieved } from '../rag/store.ts'
import { CHECKS, type GapClass } from '../rag/checks.ts'
import type { RawFinding } from '../pipeline/postprocess.ts'

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'findings',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        findings: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              gap: { type: 'string' },
              severity: { type: 'string', enum: ['high', 'medium', 'low'] },
              evidence_ids: { type: 'array', items: { type: 'string' } },
              question: { type: 'string' },
            },
            required: ['gap', 'severity', 'evidence_ids', 'question'],
            additionalProperties: false,
          },
        },
      },
      required: ['findings'],
      additionalProperties: false,
    },
  },
} as const

/** D21: three levels, anchored to consequence. Uncalibrated severity is noise. */
const RUBRIC = `severity:
  high    money movement or data loss can occur
  medium  system behaves incorrectly, no data or money at risk
  low     the requirement is unclear or ambiguous only`

export async function runGapCheck(opts: {
  gapClass: GapClass
  requirementRef: string
  requirementText: string
  evidence: Retrieved[]
}): Promise<RawFinding[]> {
  const evidenceBlock = opts.evidence
    .map((e) => `[${e.id}] (${e.sourceRef})\n${e.text}`)
    .join('\n\n')

  const prompt = `You are reviewing one requirement from a software requirements document
against evidence drawn from the system that has already been built.

Report ONLY: ${CHECKS[opts.gapClass].question}.

Rules:
- Answer only from the evidence below. Do not use outside knowledge.
- Every finding MUST cite at least one evidence id, exactly as written in brackets.
- Cite ONLY ids that appear below. A finding you cannot cite must not be reported.
- ${CHECKS[opts.gapClass].evidenceRule}
- Phrase "question" as something a business analyst can put to the client directly.
- If there is nothing to report, return an empty list. Do not invent findings.

${RUBRIC}

Evidence:
${evidenceBlock}

Requirement ${opts.requirementRef}:
${opts.requirementText}`

  const res = await llm.chat.completions.create({
    model: env.llmModel,
    messages: [{ role: 'user', content: prompt }],
    response_format: SCHEMA as never,
    ...({ reasoning_effort: env.reasoningEffort } as Record<string, unknown>), // D7
  })
  const raw = res.choices[0]?.message?.content ?? '{"findings":[]}'
  try {
    return (JSON.parse(raw) as { findings: RawFinding[] }).findings ?? []
  } catch {
    return []
  }
}
