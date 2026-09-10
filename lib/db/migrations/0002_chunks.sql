-- D6/D9/D23: evidence chunks.
--
-- Two lifetimes share this table: KB chunks (code, ddl, rca) are corpus-scoped and
-- permanent with run_id NULL; requirement chunks belong to the run that extracted them.
-- Without run_id, one document's check could retrieve and cite another document's
-- requirements — a real id, passing the citation filter, pointing at the wrong document.
CREATE TABLE chunks (
    id          text PRIMARY KEY,
    kind        text NOT NULL CHECK (kind IN ('requirement', 'code', 'ddl', 'rca')),
    run_id      bigint,
    source_ref  text NOT NULL,
    text        text NOT NULL,
    embedding   vector(768) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_chunks_kind_run ON chunks (kind, run_id);
