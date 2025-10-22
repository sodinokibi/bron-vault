-- Migration: Add enhanced crypto wallet fields
-- Description: Adds public_key, account_name, network_config, vault_data, and extension_id fields to crypto_wallets table
-- Purpose: Better LevelDB parsing and wallet metadata extraction

-- Add new columns to crypto_wallets table
ALTER TABLE crypto_wallets
  ADD COLUMN IF NOT EXISTS public_key TEXT NULL COMMENT 'Public key extracted from wallet (hex format)',
  ADD COLUMN IF NOT EXISTS account_name VARCHAR(255) NULL COMMENT 'Account name/label from wallet',
  ADD COLUMN IF NOT EXISTS network_config JSON NULL COMMENT 'Network/chain configuration data',
  ADD COLUMN IF NOT EXISTS vault_data TEXT NULL COMMENT 'Encrypted vault data (for analysis)',
  ADD COLUMN IF NOT EXISTS extension_id VARCHAR(100) NULL COMMENT 'Browser extension ID if from extension';

-- Add indexes for new searchable fields
CREATE INDEX IF NOT EXISTS idx_public_key ON crypto_wallets(public_key(255));
CREATE INDEX IF NOT EXISTS idx_account_name ON crypto_wallets(account_name);
CREATE INDEX IF NOT EXISTS idx_extension_id ON crypto_wallets(extension_id);

-- Update comment on table
ALTER TABLE crypto_wallets COMMENT = 'Enhanced crypto wallet data with LevelDB parsing support';
