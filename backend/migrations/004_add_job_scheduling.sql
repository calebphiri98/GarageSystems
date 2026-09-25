-- Adds scheduling window columns used by JobController::assignMechanic()
-- for mechanic double-booking checks.

ALTER TABLE job_cards
  ADD COLUMN scheduled_start timestamp without time zone,
  ADD COLUMN scheduled_end   timestamp without time zone;

-- Speeds up the overlap-check query in assignMechanic(), which filters
-- by assigned_mechanic_id and the scheduled window.
CREATE INDEX idx_job_cards_mechanic_schedule
  ON job_cards (assigned_mechanic_id, scheduled_start, scheduled_end)
  WHERE assigned_mechanic_id IS NOT NULL;