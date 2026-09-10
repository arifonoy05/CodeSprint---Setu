/**
 * Configuration only. No node:* imports — this is pulled in by pages and components,
 * and anything platform-specific here breaks the bundler. The egress assertion that
 * enforces D31 lives in ./egress.ts, which only the boot path imports.
 */
export const env = {
  llmBaseUrl: process.env.LLM_BASE_URL ?? 'http://host.docker.internal:1234/v1',
  llmModel: process.env.LLM_MODEL ?? 'qwen/qwen3.5-9b',
  /** D7: measured 215s -> 4s. Not a tuning knob. */
  reasoningEffort: process.env.LLM_REASONING_EFFORT ?? 'none',
  embedModel: process.env.EMBED_MODEL ?? 'text-embedding-nomic-embed-text-v1.5',
  embedDims: 768,
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://setu:setu@localhost:5433/setu',
  sessionSecret: process.env.SESSION_SECRET ?? 'dev-only-secret-at-least-32-chars-long!',
  jiraPushEnabled: process.env.JIRA_PUSH_ENABLED === 'true',
  jiraBaseUrl: process.env.JIRA_BASE_URL ?? '',
  jiraProjectKey: process.env.JIRA_PROJECT_KEY ?? 'SETU',
  jiraToken: process.env.JIRA_TOKEN ?? '',
}
