-- ============================================================
-- Migration 003: supervisor-requested improvements
--   - Orders can now be cancelled (by the customer while Pending,
--     or by admin/manager at any point before Completed)
--   - Job cards get a scheduled window so a mechanic can't be
--     double-booked on overlapping jobs
--   - Helpful indexes for the new search / price-range filters
-- ============================================================

-- Postgres requires ADD VALUE to run outside a multi-statement transaction
-- block in older versions, so keep this as the very first statement when
-- you run this file (psql runs each top-level statement separately here).
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'Cancelled';

-- Scheduling window for a job so overlapping assignments for the same
-- mechanic can be detected and rejected ("assumed period" per job).
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP;
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMP;

-- Search / filter performance
CREATE INDEX IF NOT EXISTS idx_parts_name ON parts (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_parts_price ON parts (unit_price);
CREATE INDEX IF NOT EXISTS idx_users_name ON users (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_job_cards_mechanic_window ON job_cards (assigned_mechanic_id, scheduled_start, scheduled_end);
