-- D11/D25/D26/D27: a document, the run that analysed it, and its requirements.
CREATE TABLE documents (
    id           bigserial PRIMARY KEY,
    filename     text NOT NULL,
    mime         text NOT NULL,
    text         text NOT NULL,
    uploaded_by  bigint REFERENCES users(id),
    uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE runs (
    id           bigserial PRIMARY KEY,
    document_id  bigint NOT NULL REFERENCES documents(id),
    status       text NOT NULL DEFAULT 'extracting'
                 CHECK (status IN ('extracting','indexing','analyzing','review',
                                   'approved','generating','ready','failed')),
    llm_model    text,
    embed_model  text,
    error        text,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    -- D27: two distinct gates. approved_at is the SRS sign-off, which fires BEFORE
    -- generation; time-to-first-backlog is measured to backlog_approved_at, or the
    -- figure stops before a backlog exists and reads structurally too small.
    approved_at           timestamptz,
    approved_by           bigint REFERENCES users(id),
    backlog_approved_at   timestamptz,
    backlog_approved_by   bigint REFERENCES users(id)
);

CREATE TABLE requirements (
    id              bigserial PRIMARY KEY,
    run_id          bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    ref             text NOT NULL,
    -- D25: BRD AI point 1 requires this classification.
    classification  text NOT NULL
                    CHECK (classification IN ('functional','non_functional','business_rule','constraint')),
    ai_original     text NOT NULL,          -- D14: never UPDATEd
    edited_text     text,                   -- D26: BA revises in place
    order_index     integer NOT NULL,
    UNIQUE (run_id, ref)
);

CREATE INDEX idx_requirements_run ON requirements (run_id, order_index);
