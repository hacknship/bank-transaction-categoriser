-- Migration: Convert tx_date, budget_date, period_start, period_end to DATE type
-- IMPORTANT: Run SHOW timezone; first to confirm server timezone
--
-- Uses AT TIME ZONE 'Asia/Kuala_Lumpur' to ensure dates stored as UTC timestamps
-- are correctly interpreted as Malaysian dates before conversion.
-- Example: "2026-03-01 16:00:00 UTC" (= midnight MYT March 2) → DATE "2026-03-02"

BEGIN;

-- Convert tx_date from TIMESTAMPTZ to DATE (interpreting as Malaysian time)
ALTER TABLE transactions
  ALTER COLUMN tx_date TYPE DATE
  USING (tx_date AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

-- Convert budget_date from TIMESTAMPTZ to DATE (nullable)
ALTER TABLE transactions
  ALTER COLUMN budget_date TYPE DATE
  USING (budget_date AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

-- Convert budget_snapshots period columns if they are TIMESTAMP
ALTER TABLE budget_snapshots
  ALTER COLUMN period_start TYPE DATE
  USING (period_start AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

ALTER TABLE budget_snapshots
  ALTER COLUMN period_end TYPE DATE
  USING (period_end AT TIME ZONE 'Asia/Kuala_Lumpur')::date;

COMMIT;

-- Rollback (if needed):
-- ALTER TABLE transactions ALTER COLUMN tx_date TYPE TIMESTAMPTZ USING tx_date::timestamptz;
-- ALTER TABLE transactions ALTER COLUMN budget_date TYPE TIMESTAMPTZ USING budget_date::timestamptz;
-- ALTER TABLE budget_snapshots ALTER COLUMN period_start TYPE TIMESTAMPTZ USING period_start::timestamptz;
-- ALTER TABLE budget_snapshots ALTER COLUMN period_end TYPE TIMESTAMPTZ USING period_end::timestamptz;
