-- D3/D14/D19/D20/D24: findings, their citations, and what was suppressed.
CREATE TABLE findings (
    id               bigserial PRIMARY KEY,
    run_id           bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    requirement_id   bigint NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
    gap_class        text NOT NULL
                     CHECK (gap_class IN ('missing_ac','failure_path','contradiction','dependency')),
    merged_classes   text[] NOT NULL DEFAULT '{}',
    -- D20: losing rows are kept, never deleted; their text is an AI proposal too (D14).
    merged_into_id   bigint REFERENCES findings(id),
    severity         text NOT NULL CHECK (severity IN ('high','medium','low')),
    ai_original      text NOT NULL,   -- D14: never UPDATEd
    edited_text      text,
    question         text NOT NULL,
    status           text NOT NULL DEFAULT 'proposed'
                     CHECK (status IN ('proposed','accepted','edited','dismissed')),
    -- D24: what the BA DID and whether it was WORTH ASKING are different questions.
    -- Precision comes from ba_verdict alone; a BA dismisses valid findings routinely.
    ba_verdict       text CHECK (ba_verdict IN ('valid','invalid')),
    resolution_note  text,            -- D26: what the client said
    decided_by       bigint REFERENCES users(id),
    decided_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now()
);

-- D3/D6: citation integrity as a foreign key, not a hoped-for property.
-- RESTRICT because requirement chunks are run-scoped (D23) — deleting cited evidence
-- must fail loudly rather than orphan a citation.
CREATE TABLE finding_evidence (
    finding_id  bigint NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
    chunk_id    text NOT NULL REFERENCES chunks(id) ON DELETE RESTRICT,
    PRIMARY KEY (finding_id, chunk_id)
);

-- D19: the suppression rate is reported. A non-zero rate is the evidence the citation
-- filter does work — a stronger claim than asserting the guarantee.
CREATE TABLE suppressed (
    id              bigserial PRIMARY KEY,
    run_id          bigint NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    requirement_ref text NOT NULL,
    gap_class       text NOT NULL,
    raw_evidence    text NOT NULL,   -- D17: RAW, pre-normalisation, for diagnosis
    reason          text NOT NULL CHECK (reason IN ('no_evidence','out_of_set')),
    gap             text NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_findings_run ON findings (run_id, requirement_id);
CREATE INDEX idx_suppressed_run ON suppressed (run_id);
