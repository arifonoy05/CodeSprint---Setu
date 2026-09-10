-- Progress is a pair of counters on the run, polled by the UI. The worker owns them.
ALTER TABLE runs ADD COLUMN progress_done  integer NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN progress_total integer NOT NULL DEFAULT 0;
ALTER TABLE runs ADD COLUMN stage text;
