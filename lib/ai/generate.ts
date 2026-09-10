import { getLlm, reasoningParam } from './client.ts'

const call = async <T>(prompt: string, schema: unknown, fallback: T): Promise<T> => {
  const { client, chatModel, reasoningEffort } = await getLlm()
  const res = await client.chat.completions.create({
    model: chatModel,
    messages: [{ role: 'user', content: prompt }],
    response_format: schema as never,
    ...reasoningParam(reasoningEffort), // D7
  })
  try {
    return JSON.parse(res.choices[0]?.message?.content ?? '') as T
  } catch {
    return fallback
  }
}

const obj = (name: string, properties: object, required: string[]) => ({
  type: 'json_schema',
  json_schema: { name, strict: true,
    schema: { type: 'object', properties, required, additionalProperties: false } },
})

// --- stories + acceptance criteria (BA) ------------------------------------
export type GenStory = { title: string; criteria: { given: string; when: string; then: string }[] }

export async function generateStories(req: { ref: string; text: string; classification: string }) {
  const schema = obj('stories', {
    stories: { type: 'array', items: obj('s', {
      title: { type: 'string' },
      criteria: { type: 'array', items: obj('c', {
        given: { type: 'string' }, when: { type: 'string' }, then: { type: 'string' },
      }, ['given', 'when', 'then']).json_schema.schema },
    }, ['title', 'criteria']).json_schema.schema },
  }, ['stories'])

  const prompt = `Turn one approved requirement into user stories with acceptance criteria.

Rules:
- Usually one story. Split only if the requirement genuinely covers separate pieces of work.
- Title in the form "As a <role>, I want <goal>, so that <reason>".
- Acceptance criteria in Given / When / Then form, each concrete enough for a tester to execute.
- Cover the normal path and the boundaries the requirement implies. Do not invent scope.
${req.classification === 'non_functional'
  ? '- This is a NON-FUNCTIONAL requirement: criteria must state a measurable threshold, not behaviour.'
  : ''}

Requirement ${req.ref} (${req.classification}):
${req.text}`

  return (await call<{ stories: GenStory[] }>(prompt, schema, { stories: [] })).stories
}

// --- developer tasks -------------------------------------------------------
export type GenTask = { task: string; modules: string[]; tables: string[] }

/**
 * Names are FILTERED against the real system, not requested politely.
 *
 * Measured: told "use only names that appear below, do not invent names", the model
 * produced `disbursement_requests`, `loan_terms`, `loan_ledgers`, `accounts` and modules
 * like `PaymentProcessing` — none of which exist. A confidently wrong table name is worse
 * than no table name, and this is the dev-facing feature the BRD leads with. Same lesson
 * as D3: the guarantee has to be a property of the code.
 */
function keepReal(proposed: string[], allowed: Set<string>): string[] {
  const byLower = new Map([...allowed].map((a) => [a.toLowerCase(), a]))
  return [...new Set(
    (proposed ?? [])
      .map((p) => byLower.get(String(p).trim().toLowerCase().replace(/[`'"]/g, '')))
      .filter((x): x is string => Boolean(x)),
  )]
}

export async function generateTasks(story: GenStory, evidence: { ref: string; kind: string }[]) {
  const schema = obj('tasks', {
    tasks: { type: 'array', items: obj('t', {
      task: { type: 'string' },
      modules: { type: 'array', items: { type: 'string' } },
      tables: { type: 'array', items: { type: 'string' } },
    }, ['task', 'modules', 'tables']).json_schema.schema },
  }, ['tasks'])

  const tables = [...new Set(
    evidence.filter((e) => e.kind === 'ddl').map((e) => e.ref.replace(/^table\s+/, '')))]
  const modules = [...new Set(
    evidence.filter((e) => e.kind === 'code').map((e) => e.ref.split(':')[0]!.replace(/\.ts$/, '')))]

  // The closed set is shown verbatim. Naming it vaguely ("the parts this touches") left the
  // model guessing at plausible-sounding names, all of which the filter then discarded.
  const vocabulary = (tables.length || modules.length)
    ? `\nThe existing system this requirement was found to touch. Use ONLY these names:
  modules: ${modules.length ? modules.join(', ') : '(none)'}
  tables:  ${tables.length ? tables.join(', ') : '(none)'}
Leave the list empty if a task touches none of them. Never invent a name.`
    : `\nNo existing modules or tables were linked to this requirement. Leave modules and tables empty.`

  const prompt = `Break one user story into development tasks.

Rules:
- Three to six tasks. Each should be a day or less of work.
- For each task, list the modules and tables it touches, drawn ONLY from the vocabulary below.
- Include test and migration work, not only the happy path.
${vocabulary}

Story: ${story.title}
Acceptance criteria:
${story.criteria.map((c) => `- Given ${c.given}, when ${c.when}, then ${c.then}`).join('\n')}`

  const allowedTables = new Set(tables)
  const allowedModules = new Set(modules)
  const out = (await call<{ tasks: GenTask[] }>(prompt, schema, { tasks: [] })).tasks
  return out.map((t) => ({
    ...t,
    modules: keepReal(t.modules, allowedModules),
    tables: keepReal(t.tables, allowedTables),
  }))
}

// --- QA scenarios ----------------------------------------------------------
export type GenTest = { scenario: string; kind: 'positive' | 'negative'; addressesGap?: string }

/**
 * Scenarios that cover reviewed gaps are generated ONE PER GAP, index-aligned.
 *
 * The first version asked the model to tag each scenario with a GAP-id it had been shown.
 * Measured: 132 scenarios, 84 of them negative, and **zero** carried a usable id — so the
 * link the BRD asks for ("test scenarios covering the failure paths flagged in Phase 1")
 * silently did not exist. Asking for one scenario per gap in order makes the link
 * structural, the same reasoning as D30.
 */
export async function generateGapTests(story: GenStory, gaps: { id: number; text: string }[]) {
  if (gaps.length === 0) return []
  const schema = obj('gaptests', {
    scenarios: { type: 'array', items: { type: 'string' } },
  }, ['scenarios'])

  const prompt = `Write exactly one negative test scenario for each gap below, in the same order.

Rules:
- Return exactly ${gaps.length} scenarios, one per gap, in the order given.
- Each must be one sentence, concrete enough for a tester to execute.
- The scenario must exercise the gap, not merely describe it.

Story: ${story.title}

Gaps raised during requirement review:
${gaps.map((g, i) => `${i + 1}. ${g.text}`).join('\n')}`

  const out = await call<{ scenarios: string[] }>(prompt, schema, { scenarios: [] })
  // Align by position; drop anything the model returned beyond the gaps it was given.
  return gaps.map((g, i) => ({ gapId: g.id, scenario: out.scenarios[i] }))
              .filter((x): x is { gapId: number; scenario: string } => Boolean(x.scenario))
}

export async function generateTests(story: GenStory, gaps: { id: number; text: string }[]) {
  const schema = obj('tests', {
    tests: { type: 'array', items: obj('t', {
      scenario: { type: 'string' },
      kind: { type: 'string', enum: ['positive', 'negative'] },
      addressesGap: { type: 'string' },
    }, ['scenario', 'kind', 'addressesGap']).json_schema.schema },
  }, ['tests'])

  const gapBlock = gaps.length
    ? `\nGaps raised during requirement review. Each MUST have at least one negative scenario.\n` +
      gaps.map((g) => `- [GAP-${g.id}] ${g.text}`).join('\n')
    : ''

  const prompt = `Write test scenarios for one user story.

Rules:
- Cover the acceptance criteria, then the failure paths.
- Mark each scenario positive or negative.
- For a scenario that covers a listed gap, put its GAP-id in addressesGap. Otherwise use "".
- One sentence per scenario, concrete enough to execute.
${gapBlock}

Story: ${story.title}
Acceptance criteria:
${story.criteria.map((c) => `- Given ${c.given}, when ${c.when}, then ${c.then}`).join('\n')}`

  return (await call<{ tests: GenTest[] }>(prompt, schema, { tests: [] })).tests
}
