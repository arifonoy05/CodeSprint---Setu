-- Organisation-level settings. One row per key, with who set it and why.
--
-- Allowing models outside the network contradicts the BRD ("all inference runs on
-- internally hosted models... client business logic never leaves the network"), so it is a
-- deliberate, attributed, revocable decision — not a checkbox tucked inside a test result.
CREATE TABLE app_settings (
    key        text PRIMARY KEY,
    value      boolean NOT NULL,
    reason     text,
    set_by     bigint REFERENCES users(id),
    set_at     timestamptz NOT NULL DEFAULT now()
);
