-- D22: one complete, already-approved run kept for the demo, so a bad minute from a
-- local model on stage is a shrug rather than a dead demo. Labelled, never disguised.
ALTER TABLE runs ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
CREATE INDEX idx_runs_demo ON runs (is_demo) WHERE is_demo;
