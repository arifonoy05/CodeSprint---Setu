-- D10/D14: five roles, thin RBAC, and an append-only audit trail.
CREATE TABLE users (
    id             bigserial PRIMARY KEY,
    email          citext NOT NULL UNIQUE,
    name           text NOT NULL,
    role           text NOT NULL CHECK (role IN ('superadmin','ba','dev','qa','pm')),
    password_hash  text NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- Append-only by policy: nothing in the app updates or deletes a row here (D14).
CREATE TABLE audit_log (
    id           bigserial PRIMARY KEY,
    actor_id     bigint REFERENCES users(id),
    action       text NOT NULL,
    entity_type  text NOT NULL,
    entity_id    bigint,
    before       jsonb,
    after        jsonb,
    at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_at ON audit_log (at DESC);
