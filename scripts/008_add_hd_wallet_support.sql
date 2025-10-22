-- Migration: Add HD Wallet Derivation Path Support
-- Description: Adds derivation_path, seed_id, and address_index for HD wallet correlation
-- Purpose: Track which addresses derive from same seed phrase and their paths

-- Add HD wallet tracking fields
ALTER TABLE crypto_wallets
  ADD COLUMN IF NOT EXISTS derivation_path VARCHAR(255) NULL COMMENT 'BIP32/44 derivation path (e.g., m/44''/60''/0''/0/0)',
  ADD COLUMN IF NOT EXISTS seed_id VARCHAR(64) NULL COMMENT 'Hash of seed phrase to group derived addresses',
  ADD COLUMN IF NOT EXISTS address_index INT NULL COMMENT 'Address index in derivation path',
  ADD COLUMN IF NOT EXISTS wallet_software VARCHAR(100) NULL COMMENT 'Detected wallet software (MetaMask, Trust Wallet, etc.)';

-- Add indexes for HD wallet queries
CREATE INDEX IF NOT EXISTS idx_derivation_path ON crypto_wallets(derivation_path);
CREATE INDEX IF NOT EXISTS idx_seed_id ON crypto_wallets(seed_id);
CREATE INDEX IF NOT EXISTS idx_address_index ON crypto_wallets(address_index);
CREATE INDEX IF NOT EXISTS idx_wallet_software ON crypto_wallets(wallet_software);

-- Composite index for finding all addresses from same seed
CREATE INDEX IF NOT EXISTS idx_seed_blockchain ON crypto_wallets(seed_id, blockchain);

-- Update comment on table
ALTER TABLE crypto_wallets COMMENT = 'Enhanced crypto wallet data with HD wallet derivation path tracking';

-- Example queries after migration:

-- Find all addresses derived from same seed:
-- SELECT * FROM crypto_wallets WHERE seed_id = 'abc123...' ORDER BY address_index;

-- Count "side wallets" from same seed:
-- SELECT seed_id, COUNT(*) as address_count, GROUP_CONCAT(blockchain) as blockchains
-- FROM crypto_wallets
-- WHERE seed_id IS NOT NULL
-- GROUP BY seed_id
-- HAVING address_count > 1;

-- Find MetaMask wallets with multiple addresses:
-- SELECT device_id, seed_id, COUNT(*) as addresses
-- FROM crypto_wallets
-- WHERE wallet_software = 'MetaMask' AND seed_id IS NOT NULL
-- GROUP BY device_id, seed_id
-- HAVING addresses > 1;
