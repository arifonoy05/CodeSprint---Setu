import { getLlm, reasoningParam } from './client.ts'

export type ExtractedRequirement = {
  ref: string
  text: string
  classification: 'functional' | 'non_functional' | 'business_rule' | 'constraint'
}

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'requirements',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        requirements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string' },
              text: { type: 'string' },
              classification: {
                type: 'string',
                enum: ['functional', 'non_functional', 'business_rule', 'constraint'],
              },
            },
            required: ['ref', 'text', 'classification'],
            additionalProperties: false,
          },
        },
      },
      required: ['requirements'],
      additionalProperties: false,
    },
  },
} as const

const PROMPT = `You are a business analyst breaking a software requirements document into
discrete, individually testable requirement statements.

Rules:
- One requirement per statement. A single sentence often contains two or three — split them.
- Keep the author's wording. Do not improve, expand or invent requirements.
- Ignore background, scope, assumptions and open items. Extract only statements of what the
  system or its users shall do, or rules it must obey.
- Number them REQ-001, REQ-002, ... in the order they appear.
- Classify each:
    functional      something the system or a user does
    non_functional  a quality: speed, availability, auditability, usability
    business_rule   a policy or constraint on values, limits or eligibility
    constraint      a fixed technical or environmental restriction

Document:
---
{{DOC}}
---`

export async function extractRequirements(documentText: string): Promise<ExtractedRequirement[]> {
  const { client, chatModel, reasoningEffort } = await getLlm()
  const res = await client.chat.completions.create({
    model: chatModel,
    messages: [{ role: 'user', content: PROMPT.replace('{{DOC}}', documentText) }],
    response_format: SCHEMA as never,
    ...reasoningParam(reasoningEffort), // D7: 215s -> 4s. Always.
  })
  const raw = res.choices[0]?.message?.content ?? '{"requirements":[]}'
  const parsed = JSON.parse(raw) as { requirements: ExtractedRequirement[] }

  // Renumber defensively — the model's own numbering is not load-bearing and has been
  // seen to skip. Order is what matters.
  return parsed.requirements.map((r, i) => ({
    ...r,
    ref: `REQ-${String(i + 1).padStart(3, '0')}`,
    text: r.text.trim(),
  }))
}
