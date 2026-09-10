-- D13/D14/D30: the four role-facing artifacts, and the links between them.
--
-- Every AI-proposed row carries the same three columns as findings: ai_original is
-- immutable, edited_text holds the human change, and the diff is the audit record.
CREATE TABLE stories (
    id              bigserial PRIMARY KEY,
    run_id          bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    requirement_id  bigint NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    title           text NOT NULL,
    criteria        jsonb NOT NULL DEFAULT '[]',   -- [{given, when, then}]
    ai_original     text NOT NULL,
    edited_text     text,
    status          text NOT NULL DEFAULT 'proposed'
                    CHECK (status IN ('proposed','accepted','edited','dismissed')),
    decided_by      bigint REFERENCES users(id),
    decided_at      timestamptz
);

CREATE TABLE tasks (
    id           bigserial PRIMARY KEY,
    run_id       bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    story_id     bigint NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    modules      text[] NOT NULL DEFAULT '{}',
    tables       text[] NOT NULL DEFAULT '{}',
    ai_original  text NOT NULL,
    edited_text  text,
    status       text NOT NULL DEFAULT 'proposed'
                 CHECK (status IN ('proposed','accepted','edited','dismissed')),
    decided_by   bigint REFERENCES users(id),
    decided_at   timestamptz
);

CREATE TABLE test_scenarios (
    id               bigserial PRIMARY KEY,
    run_id           bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    story_id         bigint NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    kind             text NOT NULL CHECK (kind IN ('positive','negative')),
    -- negative scenarios are seeded from the gaps raised in review
    from_finding_id  bigint REFERENCES findings(id),
    ai_original      text NOT NULL,
    edited_text      text,
    status           text NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed','accepted','edited','dismissed')),
    decided_by       bigint REFERENCES users(id),
    decided_at       timestamptz
);

-- D30: structural, written at generation time. Stories and tests are generated FROM
-- requirements, so the link is known by construction — no semantic matching, no LLM call.
CREATE TABLE trace_links (
    id              bigserial PRIMARY KEY,
    run_id          bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    requirement_id  bigint NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    story_id        bigint REFERENCES stories(id) ON DELETE CASCADE,
    test_id         bigint REFERENCES test_scenarios(id) ON DELETE CASCADE
);

CREATE INDEX idx_stories_run ON stories (run_id, requirement_id);
CREATE INDEX idx_tasks_story ON tasks (story_id);
CREATE INDEX idx_tests_story ON test_scenarios (story_id);
CREATE INDEX idx_trace_run ON trace_links (run_id, requirement_id);
