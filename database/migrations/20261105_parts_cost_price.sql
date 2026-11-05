-- Additive, reversible: records what a part costs the garage so the
-- Business Intelligence module can compute gross profit and margin.
-- Existing rows keep NULL (treated as "cost not captured").
ALTER TABLE parts
  ADD COLUMN cost_price NUMERIC(12,2) NULL DEFAULT NULL;
