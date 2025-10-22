import { readdir, unlink, mkdir, stat, readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"
import { executeQuery } from "./mysql"
import { extractArchive, detectArchiveType, type ArchiveFormat } from "./archive-handler"
import { parseStealerLogs, type ParsedFile } from "./stealer-parsers"
import { parseAndStoreMessagingWalletData } from "./parse-messaging-wallet"

// Password escape function
function escapePassword(password: string): string {
  if (!password) return password
  return password
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
}

// Helper to extract URL info
function extractUrlInfo(url: string): { domain: string | null; tld: string | null } {
  try {
    if (!url || url.trim() === "") {
      return { domain: null, tld: null }
    }

    let cleanUrl = url.trim()
    cleanUrl = cleanUrl.replace(/^https?:\/\//, "")
    cleanUrl = cleanUrl.replace(/^www\./, "")

    const hostname = cleanUrl.split("/")[0].split(":")[0].toLowerCase()

    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipRegex.test(hostname)) {
      return { domain: hostname, tld: null }
    }

    const parts = hostname.split(".")
    const tld = parts.length > 1 ? parts[parts.length - 1] : null

    return { domain: hostname, tld }
  } catch (error) {
    return { domain: null, tld: null }
  }
}

// Extract value from line
function extractValue(line: string): string {
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) return ""
  return line.substring(colonIndex + 1).trim()
}

// Parse password file content
function parsePasswordFile(
  content: string,
): Array<{
  url: string
  domain: string | null
  tld: string | null
  username: string
  password: string
  browser: string | null
}> {
  const credentials: Array<{
    url: string
    domain: string | null
    tld: string | null
    username: string
    password: string
    browser: string | null
  }> = []

  const lines = content.split(/\r?\n/)
  let currentCredential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }> = {}

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (currentCredential.url && currentCredential.username && currentCredential.password) {
        const urlInfo = extractUrlInfo(currentCredential.url)
        credentials.push({
          url: currentCredential.url,
          domain: urlInfo.domain,
          tld: urlInfo.tld,
          username: currentCredential.username,
          password: currentCredential.password,
          browser: currentCredential.browser || null,
        })
      }
      currentCredential = {}
      continue
    }

    const lowerLine = trimmed.toLowerCase()

    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      currentCredential.url = extractValue(trimmed)
    } else if (lowerLine.includes("username:") || lowerLine.includes("user:") || lowerLine.includes("login:")) {
      currentCredential.username = extractValue(trimmed)
    } else if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      const password = extractValue(trimmed)
      try {
        const testEscape = escapePassword(password)
        if (testEscape !== null && testEscape !== undefined) {
          currentCredential.password = password
        }
      } catch (escapeError) {
        console.warn(`Skipping invalid password: ${password.substring(0, 10)}...`)
      }
    } else if (lowerLine.includes("browser:") || lowerLine.includes("soft:") || lowerLine.includes("application:")) {
      currentCredential.browser = extractValue(trimmed)
    }
  }

  // Add the last credential if valid
  if (currentCredential.url && currentCredential.username && currentCredential.password) {
    const urlInfo = extractUrlInfo(currentCredential.url)
    credentials.push({
      url: currentCredential.url,
      domain: urlInfo.domain,
      tld: urlInfo.tld,
      username: currentCredential.username,
      password: currentCredential.password,
      browser: currentCredential.browser || null,
    })
  }

  return credentials
}

// Check if file is a password file
function isPasswordFile(filename: string): boolean {
  const lowerFileName = filename.toLowerCase()
  return (
    lowerFileName === "all passwords.txt" ||
    lowerFileName === "all_passwords.txt" ||
    lowerFileName === "passwords.txt" ||
    lowerFileName === "allpasswords_list.txt" ||
    lowerFileName === "_allpasswords_list.txt"
  )
}

// Check if file is a system file to skip
function isSystemFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower === ".ds_store" || lower.startsWith(".") || lower === "__macosx"
}

// Recursively scan directory for files
async function scanDirectory(
  dirPath: string,
  basePath: string = "",
): Promise<
  Array<{
    path: string
    name: string
    size: number
    isDirectory: boolean
  }>
> {
  const files: Array<{
    path: string
    name: string
    size: number
    isDirectory: boolean
  }> = []

  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (isSystemFile(entry.name)) {
      continue
    }

    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath, relativePath)
      files.push(...subFiles)
    } else {
      const stats = await stat(fullPath)
      files.push({
        path: relativePath,
        name: entry.name,
        size: stats.size,
        isDirectory: false,
      })
    }
  }

  return files
}

// Extract device name from path
function extractDeviceName(filePath: string): string | null {
  const parts = filePath.split(path.sep).filter((p) => p.length > 0)
  if (parts.length === 0) return null
  return parts[0]
}

/**
 * Process archive file (any supported format)
 */
export async function processArchiveFile(
  archiveFilePath: string,
  archiveType: ArchiveFormat,
  uploadBatch: string,
  password: string | null,
  progressCallback: (progress: number, message: string) => Promise<void>,
) {
  await progressCallback(10, `Initializing ${archiveType} archive processing...`)

  // Create extraction directory
  const today = new Date().toISOString().split("T")[0]
  const extractionDir = path.join(process.cwd(), "uploads", "extracted_files", today, uploadBatch)

  if (!existsSync(extractionDir)) {
    await mkdir(extractionDir, { recursive: true })
  }

  await progressCallback(15, "Extracting archive...")

  // Extract archive
  const customPasswords = password ? [password] : []
  const extractResult = await extractArchive(archiveFilePath, extractionDir, archiveType, customPasswords)

  if (!extractResult.success) {
    throw new Error(extractResult.error || "Failed to extract archive")
  }

  if (extractResult.password) {
    await progressCallback(
      20,
      `✅ Archive extracted successfully with password: ${extractResult.password === "" ? "(no password)" : "***"}`,
    )
  } else {
    await progressCallback(20, "✅ Archive extracted successfully")
  }

  // Scan extracted files
  await progressCallback(25, "Scanning extracted files...")
  const allFiles = await scanDirectory(extractionDir)

  await progressCallback(30, `Found ${allFiles.length} files`)

  // Group files by device
  const deviceMap = new Map<string, typeof allFiles>()

  for (const file of allFiles) {
    const deviceName = extractDeviceName(file.path)
    if (!deviceName) continue

    if (!deviceMap.has(deviceName)) {
      deviceMap.set(deviceName, [])
    }

    deviceMap.get(deviceName)?.push(file)
  }

  const totalDevices = deviceMap.size
  await progressCallback(35, `Identified ${totalDevices} devices`)

  // Process each device
  let deviceIndex = 0
  let totalCredentials = 0
  let totalCookies = 0
  let totalExtensions = 0
  let totalAutofill = 0
  let totalCreditCards = 0
  let totalCryptoWallets = 0
  let totalMessengerTokens = 0
  let totalFTPCredentials = 0
  let totalGamingSessions = 0
  let totalHistory = 0
  let totalDownloads = 0
  let totalBookmarks = 0
  let totalDomains = new Set<string>()
  let totalUrls = new Set<string>()

  for (const [deviceName, files] of deviceMap.entries()) {
    deviceIndex++
    const deviceProgress = 35 + ((deviceIndex / totalDevices) * 60)

    await progressCallback(deviceProgress, `Processing device ${deviceIndex}/${totalDevices}: ${deviceName}`)

    // Generate device ID
    const deviceNameHash = crypto.createHash("sha256").update(deviceName).digest("hex")
    const deviceId = `${deviceNameHash.substring(0, 16)}_${Date.now()}`

    // Check for duplicate device
    const existingDevice = await executeQuery(
      "SELECT device_id FROM devices WHERE device_name_hash = ? LIMIT 1",
      [deviceNameHash],
    )

    if (Array.isArray(existingDevice) && existingDevice.length > 0) {
      await progressCallback(deviceProgress, `⚠️ Skipping duplicate device: ${deviceName}`)
      continue
    }

    // Convert files to ParsedFile format and read content
    const parsedFiles: ParsedFile[] = []

    for (const file of files) {
      const fullPath = path.join(extractionDir, file.path)

      let content: string | undefined

      // Only read text files (skip large binary files)
      if (file.size < 10 * 1024 * 1024 && !file.name.match(/\.(jpg|jpeg|png|gif|bmp|ico|exe|dll|so|dylib|zip|rar|7z|tar|gz)$/i)) {
        try {
          content = await readFile(fullPath, "utf-8")
        } catch {
          // Binary file or unreadable, skip content
        }
      }

      parsedFiles.push({
        file_path: file.path,
        file_name: file.name,
        parent_path: path.dirname(file.path),
        is_directory: file.isDirectory,
        file_size: file.size,
        content,
        local_file_path: fullPath,
      })
    }

    // Parse all stealer data using auto-detection
    await progressCallback(deviceProgress + 1, `🔍 Detecting stealer type...`)
    const parsedData = await parseStealerLogs(parsedFiles, deviceId)

    await progressCallback(
      deviceProgress + 2,
      `✅ Detected: ${parsedData.metadata.stealer_family} (${(parsedData.metadata.detection_confidence * 100).toFixed(0)}% confidence)`,
    )

    // Parse Discord, Telegram, 2FA, and Crypto Wallet data
    await progressCallback(deviceProgress + 3, `💎 Parsing messaging & wallet data...`)
    const messagingWalletCounts = await parseAndStoreMessagingWalletData(
      deviceId,
      extractionDir,
      async (subProgress, message) => {
        // Sub-progress for messaging/wallet parsing (don't update main progress too much)
        await progressCallback(deviceProgress + 3, message)
      },
    )

    console.log(
      `💎 Messaging & Wallet Summary: Discord:${messagingWalletCounts.discord_tokens} Telegram:${messagingWalletCounts.telegram_sessions} 2FA:${messagingWalletCounts.authenticator_data} Wallets:${messagingWalletCounts.crypto_wallets}`,
    )

    // Insert device with all statistics
    await executeQuery(
      `INSERT INTO devices (
        device_id, device_name, device_name_hash, upload_batch,
        total_files, total_credentials, total_domains, total_urls,
        total_cookies, total_extensions, total_autofill, total_credit_cards,
        total_crypto_wallets, total_messenger_tokens, total_ftp_credentials, total_gaming_sessions,
        total_history, total_downloads, total_bookmarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        deviceName,
        deviceNameHash,
        uploadBatch,
        parsedFiles.length,
        parsedData.credentials.length,
        new Set(parsedData.credentials.map((c) => c.domain).filter((d) => d)).size,
        new Set(parsedData.credentials.map((c) => c.url)).size,
        parsedData.cookies.length,
        parsedData.extensions.length,
        parsedData.autofill.length,
        parsedData.credit_cards.length,
        parsedData.crypto_wallets.length,
        parsedData.messenger_tokens.length,
        parsedData.ftp_credentials.length,
        parsedData.gaming_sessions.length,
        parsedData.history.length,
        parsedData.downloads.length,
        parsedData.bookmarks.length,
      ],
    )

    // Insert stealer metadata
    await executeQuery(
      `INSERT INTO stealer_metadata (device_id, stealer_family, stealer_version, build_id, detection_confidence, indicators)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        parsedData.metadata.stealer_family,
        parsedData.metadata.stealer_version || null,
        parsedData.metadata.build_id || null,
        parsedData.metadata.detection_confidence,
        JSON.stringify(parsedData.metadata.indicators || []),
      ],
    )

    // Insert credentials in batches
    const batchSize = 50
    for (let i = 0; i < parsedData.credentials.length; i += batchSize) {
      const batch = parsedData.credentials.slice(i, i + batchSize)
      const values = batch.map((c) => [
        deviceId,
        c.url,
        c.domain,
        c.tld,
        c.username,
        escapePassword(c.password),
        c.browser || null,
        c.file_path,
        // Category fields
        c.categories ? JSON.stringify(c.categories) : null,
        c.primary_category || null,
        c.risk_level || 'unknown',
        c.risk_score || 0,
      ])

      if (values.length > 0) {
        const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
        await executeQuery(
          `INSERT INTO credentials (device_id, url, domain, tld, username, password, browser, file_path, categories, primary_category, risk_level, risk_score) VALUES ${placeholders}`,
          values.flat(),
        )
      }
    }

    // Insert cookies in batches
    for (let i = 0; i < parsedData.cookies.length; i += batchSize) {
      const batch = parsedData.cookies.slice(i, i + batchSize)
      const values = batch.map((c) => [
        deviceId,
        c.host_key,
        c.name,
        c.value,
        c.path,
        c.expires_utc,
        c.is_secure,
        c.is_httponly,
        c.same_site || null,
        c.browser || null,
        c.profile || null,
        c.file_path,
        // Category fields
        c.categories ? JSON.stringify(c.categories) : null,
        c.primary_category || null,
        c.risk_level || 'unknown',
        c.risk_score || 0,
      ])

      if (values.length > 0) {
        const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
        await executeQuery(
          `INSERT INTO cookies (device_id, host_key, name, value, path, expires_utc, is_secure, is_httponly, same_site, browser, profile, file_path, categories, primary_category, risk_level, risk_score) VALUES ${placeholders}`,
          values.flat(),
        )
      }
    }

    // Insert browser extensions
    for (const ext of parsedData.extensions) {
      await executeQuery(
        `INSERT INTO browser_extensions (device_id, extension_id, extension_name, extension_type, version, browser, profile, data, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          ext.extension_id,
          ext.extension_name,
          ext.extension_type,
          ext.version || null,
          ext.browser,
          ext.profile || null,
          JSON.stringify(ext.data || {}),
          ext.file_path,
        ],
      )
    }

    // Insert autofill data
    for (const af of parsedData.autofill) {
      await executeQuery(
        `INSERT INTO autofill (device_id, field_name, field_value, times_used, browser, profile, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, af.field_name, af.field_value, af.times_used || 0, af.browser, af.profile || null, af.file_path],
      )
    }

    // Insert credit cards
    for (const cc of parsedData.credit_cards) {
      await executeQuery(
        `INSERT INTO credit_cards (device_id, card_number_encrypted, card_number_last4, cardholder_name, expiration_month, expiration_year, browser, profile, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          cc.card_number_encrypted,
          cc.card_number_last4,
          cc.cardholder_name,
          cc.expiration_month,
          cc.expiration_year,
          cc.browser,
          cc.profile || null,
          cc.file_path,
        ],
      )
    }

    // Insert crypto wallets
    for (const wallet of parsedData.crypto_wallets) {
      await executeQuery(
        `INSERT INTO crypto_wallets (device_id, wallet_type, wallet_name, wallet_address, private_key, seed_phrase, browser, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          wallet.wallet_type,
          wallet.wallet_name || null,
          wallet.wallet_address || null,
          wallet.private_key || null,
          wallet.seed_phrase || null,
          wallet.browser || null,
          wallet.file_path,
        ],
      )
    }

    // Insert messenger tokens
    for (const token of parsedData.messenger_tokens) {
      await executeQuery(
        `INSERT INTO messenger_tokens (device_id, messenger_type, username, user_id, token, email, phone, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          token.messenger_type,
          token.username || null,
          token.user_id || null,
          token.token,
          token.email || null,
          token.phone || null,
          token.file_path,
        ],
      )
    }

    // Insert FTP credentials
    for (const ftp of parsedData.ftp_credentials) {
      await executeQuery(
        `INSERT INTO ftp_credentials (device_id, protocol, host, port, username, password, software, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, ftp.protocol, ftp.host, ftp.port || null, ftp.username, ftp.password, ftp.software || null, ftp.file_path],
      )
    }

    // Insert gaming sessions
    for (const game of parsedData.gaming_sessions) {
      await executeQuery(
        `INSERT INTO gaming_sessions (device_id, platform, username, email, session_token, file_path)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [deviceId, game.platform, game.username || null, game.email || null, game.session_token, game.file_path],
      )
    }

    // Insert browser history
    for (const historyEntry of parsedData.history) {
      await executeQuery(
        `INSERT INTO browser_history (device_id, url, title, visit_count, last_visit_time, browser, profile, file_path, categories, primary_category, risk_level, risk_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          historyEntry.url,
          historyEntry.title || null,
          historyEntry.visit_count,
          historyEntry.last_visit_time,
          historyEntry.browser,
          historyEntry.profile || null,
          historyEntry.file_path,
          // Category fields
          historyEntry.categories ? JSON.stringify(historyEntry.categories) : null,
          historyEntry.primary_category || null,
          historyEntry.risk_level || 'unknown',
          historyEntry.risk_score || 0,
        ],
      )
    }

    // Insert downloads
    for (const download of parsedData.downloads) {
      await executeQuery(
        `INSERT INTO downloads (device_id, url, file_path, file_name, total_bytes, start_time, end_time, state, browser, profile, source_file)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          download.url,
          download.file_path || null,
          download.file_name || null,
          download.total_bytes || null,
          download.start_time || null,
          download.end_time || null,
          download.state || null,
          download.browser,
          download.profile || null,
          download.source_file,
        ],
      )
    }

    // Insert bookmarks
    for (const bookmark of parsedData.bookmarks) {
      await executeQuery(
        `INSERT INTO bookmarks (device_id, url, title, date_added, folder, browser, profile, file_path)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deviceId,
          bookmark.url,
          bookmark.title || null,
          bookmark.date_added || null,
          bookmark.folder || null,
          bookmark.browser,
          bookmark.profile || null,
          bookmark.file_path,
        ],
      )
    }

    // Insert files
    for (const file of parsedFiles) {
      await executeQuery(
        `INSERT INTO files (device_id, file_path, file_name, file_size, local_file_path) VALUES (?, ?, ?, ?, ?)`,
        [deviceId, file.file_path, file.file_name, file.file_size, file.local_file_path],
      )
    }

    // Update totals
    totalCredentials += parsedData.credentials.length
    totalCookies += parsedData.cookies.length
    totalExtensions += parsedData.extensions.length
    totalAutofill += parsedData.autofill.length
    totalCreditCards += parsedData.credit_cards.length
    totalCryptoWallets += parsedData.crypto_wallets.length
    totalCryptoWallets += messagingWalletCounts.crypto_wallets // From new wallet parser
    totalMessengerTokens += parsedData.messenger_tokens.length
    totalMessengerTokens += messagingWalletCounts.discord_tokens // Discord tokens
    totalMessengerTokens += messagingWalletCounts.telegram_sessions // Telegram sessions
    totalMessengerTokens += messagingWalletCounts.authenticator_data // 2FA data
    totalFTPCredentials += parsedData.ftp_credentials.length
    totalGamingSessions += parsedData.gaming_sessions.length
    totalHistory += parsedData.history.length
    totalDownloads += parsedData.downloads.length
    totalBookmarks += parsedData.bookmarks.length

    parsedData.credentials.forEach((c) => {
      if (c.domain) totalDomains.add(c.domain)
      totalUrls.add(c.url)
    })

    await progressCallback(
      deviceProgress + 3,
      `✅ Device ${deviceName}: ${parsedData.credentials.length} credentials, ${parsedData.cookies.length} cookies, ${parsedData.crypto_wallets.length} wallets`,
    )
  }

  // Delete archive file
  try {
    await unlink(archiveFilePath)
    await progressCallback(95, "Cleaned up archive file")
  } catch (err) {
    console.error("Failed to delete archive file:", err)
  }

  await progressCallback(100, "Processing complete!")

  return {
    devicesProcessed: deviceMap.size,
    totalFiles: allFiles.length,
    totalCredentials,
    totalDomains: totalDomains.size,
    totalUrls: totalUrls.size,
    totalCookies,
    totalExtensions,
    totalAutofill,
    totalCreditCards,
    totalCryptoWallets,
    totalMessengerTokens,
    totalFTPCredentials,
    totalGamingSessions,
    totalHistory,
    totalDownloads,
    totalBookmarks,
  }
}
