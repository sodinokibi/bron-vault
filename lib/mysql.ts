import mysql from "mysql2/promise"

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "stealer_logs",
  charset: "utf8mb4",
}

// Create connection pool with optimized settings for high volume
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
})

export { pool }

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const [results] = await pool.execute(query, params)
    return results
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

export async function initializeDatabase() {
  try {
    // Create database if not exists
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: "utf8mb4",
    })

    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await connection.end()

    // Create tables
    await createTables()

    // IMPORTANT: Ensure local_file_path column exists
    await ensureLocalFilePathColumn()

    // IMPORTANT: Ensure device statistics columns exist
    await ensureDeviceStatisticsColumns()

    // IMPORTANT: Ensure Discord validation columns exist
    await ensureDiscordValidationColumns()

    // IMPORTANT: Ensure cookie sessions table exists
    await ensureCookieSessionsTable()

    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Database initialization error:", error)
    throw error
  }
}

async function ensureLocalFilePathColumn() {
  try {
    console.log("🔧 Ensuring local_file_path column exists...")

    // Check if column exists
    const columnCheck = await executeQuery(
      `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'files' AND COLUMN_NAME = 'local_file_path'
    `,
      [dbConfig.database],
    )

    if ((columnCheck as any[]).length === 0) {
      console.log("➕ Adding local_file_path column to files table...")
      await executeQuery(`
        ALTER TABLE files ADD COLUMN local_file_path TEXT NULL
      `)

      // Add index
      await executeQuery(`
        CREATE INDEX idx_local_file_path ON files(local_file_path(255))
      `)

      console.log("✅ local_file_path column added successfully")
    } else {
      console.log("✅ local_file_path column already exists")
    }
  } catch (error) {
    console.error("❌ Error ensuring local_file_path column:", error)
    // Don't throw - continue with existing schema
  }
}

async function ensureDeviceStatisticsColumns() {
  try {
    console.log("🔧 Ensuring device statistics columns exist...")

    const columnsToAdd = [
      "total_cookies INT DEFAULT 0",
      "total_extensions INT DEFAULT 0",
      "total_autofill INT DEFAULT 0",
      "total_credit_cards INT DEFAULT 0",
      "total_crypto_wallets INT DEFAULT 0",
      "total_messenger_tokens INT DEFAULT 0",
      "total_ftp_credentials INT DEFAULT 0",
      "total_gaming_sessions INT DEFAULT 0",
      "total_history INT DEFAULT 0",
      "total_downloads INT DEFAULT 0",
      "total_bookmarks INT DEFAULT 0",
    ]

    for (const column of columnsToAdd) {
      const columnName = column.split(" ")[0]
      const columnCheck = await executeQuery(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'devices' AND COLUMN_NAME = ?
      `,
        [dbConfig.database, columnName],
      )

      if ((columnCheck as any[]).length === 0) {
        console.log(`➕ Adding ${columnName} column to devices table...`)
        await executeQuery(`ALTER TABLE devices ADD COLUMN ${column}`)
      }
    }

    console.log("✅ Device statistics columns ensured")
  } catch (error) {
    console.error("❌ Error ensuring device statistics columns:", error)
    // Don't throw - continue with existing schema
  }
}

async function ensureDiscordValidationColumns() {
  try {
    console.log("🔧 Ensuring Discord validation columns exist...")

    const columnsToAdd = [
      "is_valid BOOLEAN NULL",
      "is_validated BOOLEAN DEFAULT FALSE",
      "validation_error TEXT NULL",
      "global_name VARCHAR(255) NULL",
      "avatar VARCHAR(255) NULL",
      "discriminator VARCHAR(4) NULL",
      "email_verified BOOLEAN NULL",
      "phone_verified BOOLEAN NULL",
      "premium_type TINYINT NULL COMMENT '0=None, 1=Classic, 2=Nitro, 3=Basic'",
      "account_flags INT NULL",
      "server_count INT NULL",
      "friend_count INT NULL",
      "account_created TIMESTAMP NULL",
      "last_validated TIMESTAMP NULL",
      "bio TEXT NULL",
    ]

    for (const column of columnsToAdd) {
      const columnName = column.split(" ")[0]
      const columnCheck = await executeQuery(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'discord_tokens' AND COLUMN_NAME = ?
      `,
        [dbConfig.database, columnName],
      )

      if ((columnCheck as any[]).length === 0) {
        console.log(`➕ Adding ${columnName} column to discord_tokens table...`)
        await executeQuery(`ALTER TABLE discord_tokens ADD COLUMN ${column}`)
      }
    }

    // Add indexes
    const indexesToAdd = [
      { name: "idx_is_valid", column: "is_valid" },
      { name: "idx_is_validated", column: "is_validated" },
      { name: "idx_premium_type", column: "premium_type" },
      { name: "idx_server_count", column: "server_count" },
      { name: "idx_last_validated", column: "last_validated" },
    ]

    for (const index of indexesToAdd) {
      try {
        const indexCheck = await executeQuery(
          `
          SELECT INDEX_NAME
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'discord_tokens' AND INDEX_NAME = ?
        `,
          [dbConfig.database, index.name],
        )

        if ((indexCheck as any[]).length === 0) {
          console.log(`➕ Adding index ${index.name} on discord_tokens table...`)
          await executeQuery(
            `CREATE INDEX ${index.name} ON discord_tokens(${index.column})`,
          )
        }
      } catch (error) {
        console.log(`⚠️  Index ${index.name} might already exist or column not ready`)
      }
    }

    console.log("✅ Discord validation columns ensured")
  } catch (error) {
    console.error("❌ Error ensuring Discord validation columns:", error)
    // Don't throw - continue with existing schema
  }
}

async function ensureCookieSessionsTable() {
  try {
    console.log("🔧 Ensuring cookie_sessions table exists...")

    // Check if table exists
    const tableCheck = await executeQuery(
      `
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cookie_sessions'
    `,
      [dbConfig.database],
    )

    if ((tableCheck as any[]).length === 0) {
      console.log("➕ Creating cookie_sessions table...")
      await executeQuery(`
        CREATE TABLE cookie_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          device_id VARCHAR(255) NOT NULL,
          service VARCHAR(100) NOT NULL COMMENT 'Service name (Google, Facebook, etc.)',
          service_category ENUM('email', 'social', 'ecommerce', 'financial', 'crypto', 'gaming', 'development', 'streaming', 'cloud', 'other') DEFAULT 'other',
          account_identifier VARCHAR(500) NULL COMMENT 'Email, username, or user ID',
          session_valid BOOLEAN DEFAULT FALSE COMMENT 'Whether session is still valid',
          expires_at TIMESTAMP NULL COMMENT 'Session expiration time',
          cookie_count INT DEFAULT 0 COMMENT 'Number of auth cookies found',
          has_auth_token BOOLEAN DEFAULT TRUE,

          security_httponly BOOLEAN DEFAULT FALSE,
          security_secure BOOLEAN DEFAULT FALSE,
          security_samesite VARCHAR(20) NULL,

          browser VARCHAR(100) NULL,
          profile VARCHAR(100) NULL,
          file_path TEXT NULL,

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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)
      console.log("✅ cookie_sessions table created")
    } else {
      console.log("✅ cookie_sessions table already exists")
    }
  } catch (error) {
    console.error("❌ Error ensuring cookie_sessions table:", error)
    // Don't throw - continue with existing schema
  }
}

async function createTables() {
  // Create devices table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) UNIQUE NOT NULL,
      device_name VARCHAR(500) NOT NULL,
      device_name_hash VARCHAR(64) NOT NULL,
      upload_batch VARCHAR(255) NOT NULL,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_files INT DEFAULT 0,
      total_credentials INT DEFAULT 0,
      total_domains INT DEFAULT 0,
      total_urls INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_device_name (device_name),
      INDEX idx_device_name_hash (device_name_hash),
      INDEX idx_upload_batch (upload_batch),
      INDEX idx_upload_date (upload_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create files table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS files (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      parent_path TEXT,
      is_directory BOOLEAN DEFAULT FALSE,
      file_size INT DEFAULT 0,
      content LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_file_name (file_name),
      INDEX idx_created_at (created_at),
      FULLTEXT idx_content (content)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create credentials table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS credentials (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      url TEXT,
      domain VARCHAR(255),
      tld VARCHAR(50),
      username VARCHAR(500),
      password TEXT,
      browser VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_domain (domain),
      INDEX idx_tld (tld),
      INDEX idx_username (username),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create password_stats table for top passwords
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS password_stats (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      password TEXT NOT NULL,
      count INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_count (count)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create analytics cache table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS analytics_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cache_key VARCHAR(255) UNIQUE NOT NULL,
      cache_data JSON,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cache_key (cache_key),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create search_cache table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      search_query VARCHAR(500) NOT NULL,
      search_type ENUM('email', 'domain') NOT NULL,
      results JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_search (search_query, search_type),
      INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create software table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS software (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      software_name VARCHAR(500) NOT NULL,
      version VARCHAR(500) NULL,
      source_file VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_software_name (software_name),
      INDEX idx_version (version),
      INDEX idx_source_file (source_file),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Update existing software table if version column is too small
  try {
    await executeQuery(`ALTER TABLE software MODIFY COLUMN version VARCHAR(500) NULL`)
  } catch (error) {
    // Column might not exist yet or already be the right size, ignore error
    console.log("Version column update skipped (might already be correct size)")
  }

  // Create API keys table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      api_key VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME NULL,
      expires_at DATETIME NULL,
      permissions JSON NULL,
      INDEX idx_api_key (api_key),
      INDEX idx_user_id (user_id),
      INDEX idx_is_active (is_active),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create cookies table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS cookies (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      host_key VARCHAR(500),
      name VARCHAR(500),
      value TEXT,
      path VARCHAR(500),
      expires_utc BIGINT,
      is_secure BOOLEAN DEFAULT FALSE,
      is_httponly BOOLEAN DEFAULT FALSE,
      same_site VARCHAR(50),
      browser VARCHAR(255),
      profile VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_host_key (host_key(255)),
      INDEX idx_name (name(255)),
      INDEX idx_browser (browser),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create browser extensions table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS browser_extensions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      extension_id VARCHAR(255),
      extension_name VARCHAR(500),
      extension_type VARCHAR(100),
      version VARCHAR(100),
      browser VARCHAR(255),
      profile VARCHAR(255),
      data JSON,
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_extension_id (extension_id),
      INDEX idx_extension_type (extension_type),
      INDEX idx_browser (browser),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create autofill table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS autofill (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      field_name VARCHAR(500),
      field_value TEXT,
      times_used INT DEFAULT 0,
      browser VARCHAR(255),
      profile VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_field_name (field_name(255)),
      INDEX idx_browser (browser),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create credit cards table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS credit_cards (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      card_number_encrypted TEXT,
      card_number_last4 VARCHAR(4),
      cardholder_name VARCHAR(500),
      expiration_month INT,
      expiration_year INT,
      browser VARCHAR(255),
      profile VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_last4 (card_number_last4),
      INDEX idx_browser (browser),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create crypto wallets table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS crypto_wallets (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      wallet_type VARCHAR(255),
      wallet_name VARCHAR(500),
      wallet_address TEXT,
      private_key TEXT,
      seed_phrase TEXT,
      browser VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_wallet_type (wallet_type),
      INDEX idx_browser (browser),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create messenger tokens table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS messenger_tokens (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      messenger_type VARCHAR(100),
      username VARCHAR(500),
      user_id VARCHAR(255),
      token TEXT,
      email VARCHAR(500),
      phone VARCHAR(100),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_messenger_type (messenger_type),
      INDEX idx_username (username(255)),
      INDEX idx_email (email(255)),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create FTP/SSH credentials table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS ftp_credentials (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      protocol VARCHAR(50),
      host VARCHAR(500),
      port INT,
      username VARCHAR(500),
      password TEXT,
      software VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_protocol (protocol),
      INDEX idx_host (host(255)),
      INDEX idx_software (software),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create gaming sessions table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS gaming_sessions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      platform VARCHAR(255),
      username VARCHAR(500),
      email VARCHAR(500),
      session_token TEXT,
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_platform (platform),
      INDEX idx_username (username(255)),
      INDEX idx_email (email(255)),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create stealer metadata table to track detected stealer types
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS stealer_metadata (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      stealer_family VARCHAR(100),
      stealer_version VARCHAR(100),
      build_id VARCHAR(255),
      detection_confidence FLOAT,
      indicators JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_stealer_family (stealer_family),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create browser history table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS browser_history (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      visit_count INT DEFAULT 1,
      last_visit_time BIGINT,
      browser VARCHAR(255),
      profile VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_browser (browser),
      INDEX idx_visit_count (visit_count),
      INDEX idx_created_at (created_at),
      FULLTEXT idx_url_title (url, title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create downloads table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS downloads (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      file_path TEXT,
      file_name VARCHAR(500),
      total_bytes BIGINT,
      start_time BIGINT,
      end_time BIGINT,
      state VARCHAR(50),
      browser VARCHAR(255),
      profile VARCHAR(255),
      source_file TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_browser (browser),
      INDEX idx_file_name (file_name(255)),
      INDEX idx_created_at (created_at),
      FULLTEXT idx_url (url)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create bookmarks table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      date_added BIGINT,
      folder VARCHAR(500),
      browser VARCHAR(255),
      profile VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_browser (browser),
      INDEX idx_folder (folder(255)),
      INDEX idx_created_at (created_at),
      FULLTEXT idx_url_title (url, title)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}
