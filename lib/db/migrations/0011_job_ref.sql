-- Which background job a run is waiting on, so "still queued" can be told apart from
-- "the job was never created". Without it a run that failed to enqueue shows a progress
-- bar for ever and the UI offers no way out.
ALTER TABLE runs ADD COLUMN generate_job_id text;
