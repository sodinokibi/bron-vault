-- Migration: Add Ledger Live Hardware Wallet Support
-- Description: Adds support for Ledger Live hardware wallet detection
-- Purpose: Track Ledger hardware wallet users and their portfolio intelligence

-- Add Ledger Live specific fields to crypto_wallets
ALTER TABLE crypto_wallets
  ADD COLUMN IF NOT EXISTS ledger_device_model VARCHAR(50) NULL COMMENT 'Ledger device model (Nano S, Nano X, Nano S Plus)',
  ADD COLUMN IF NOT EXISTS ledger_balance_usd DECIMAL(20, 2) NULL COMMENT 'Portfolio balance in USD (if cached)',
  ADD COLUMN IF NOT EXISTS ledger_operations_count INT NULL COMMENT 'Number of transactions';

-- Modify wallet_type to support hardware_wallet
ALTER TABLE crypto_wallets
  MODIFY COLUMN wallet_type ENUM('browser_extension', 'desktop_app', 'mobile', 'hardware_wallet', 'other') NOT NULL DEFAULT 'other';

-- Add indexes for Ledger Live queries
CREATE INDEX IF NOT EXISTS idx_ledger_device ON crypto_wallets(ledger_device_model);
CREATE INDEX IF NOT EXISTS idx_hardware_wallets ON crypto_wallets(wallet_type, wallet_name);

-- Update table comment
ALTER TABLE crypto_wallets COMMENT = 'Enhanced crypto wallet data with HD wallet and Ledger Live hardware wallet support';

-- Example queries after migration:

-- Find all Ledger Live installations:
-- SELECT device_id, COUNT(*) as accounts, SUM(ledger_balance_usd) as total_usd,
--        GROUP_CONCAT(DISTINCT blockchain) as currencies,
--        ledger_device_model
-- FROM crypto_wallets
-- WHERE wallet_type = 'hardware_wallet' AND wallet_name = 'Ledger Live'
-- GROUP BY device_id, ledger_device_model;

-- Find high-value Ledger targets (>$10k portfolio):
-- SELECT device_id, SUM(ledger_balance_usd) as portfolio_value,
--        COUNT(*) as accounts, GROUP_CONCAT(DISTINCT blockchain) as currencies
-- FROM crypto_wallets
-- WHERE wallet_type = 'hardware_wallet' AND ledger_balance_usd IS NOT NULL
-- GROUP BY device_id
-- HAVING portfolio_value > 10000
-- ORDER BY portfolio_value DESC;

-- Find Ledger users with specific device models:
-- SELECT device_id, ledger_device_model, COUNT(*) as accounts
-- FROM crypto_wallets
-- WHERE ledger_device_model = 'Nano X'
-- GROUP BY device_id, ledger_device_model;
