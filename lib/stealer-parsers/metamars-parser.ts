/**
 * Meta/Mars Stealer Parser
 *
 * Parses logs from Meta and Mars stealer malware (Russian stealer family)
 * Mars is based on Meta, so they share very similar structure
 *
 * Typical structure:
 * - {HWID}/
 *   - Browsers/
 *     - {browser}/
 *       - Passwords.txt
 *       - Cookies.txt
 *       - Autofill.txt
 *       - History
 *   - Wallets/
 *   - Files/ (grabbed files from desktop)
 *   - Screenshot.jpg
 *   - System Info.txt or Информация о системе.txt (Russian)
 */

import {
  type StealerParser,
  type ParsedStealerData,
  type ParsedFile,
  StealerFamily,
  type Credential,
  type Cookie,
  type BrowserExtension,
  type AutofillData,
  type CryptoWallet,
  type MessengerToken,
  type BrowserHistory,
  type Download,
  type Bookmark,
} from "./types"
import {
  parsePasswordFile,
  parseNetscapeCookies,
  parseJSONCookies,
  detectBrowser,
  extractProfile,
  extractWalletAddress,
  extractSeedPhrase,
  extractDiscordToken,
  sanitizeText,
} from "./utils"
import {
  parseSQLiteCookies,
  parseSQLiteHistory,
  parseSQLiteDownloads,
  parseBookmarksJSON,
} from "./sqlite-parser"

export class MetaMarsParser implements StealerParser {
  getMetadata() {
    return {
      name: "Meta/Mars Parser",
      family: StealerFamily.META, // Will detect both Meta and Mars
      description:
        "Parser for Meta and Mars stealer logs (Russian stealer family)",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for System Info.txt or Russian version
    const hasSystemInfo = files.some(
      (f) =>
        f.file_name.match(/^System Info\.txt$/i) ||
        f.file_name.match(/Информация о системе/i),
    )

    if (hasSystemInfo) {
      confidence += 0.35
      indicators.push("System Info.txt")
    }

    // Check for Browsers directory
    const hasBrowsersDir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]/i),
    )

    if (hasBrowsersDir) {
      confidence += 0.2
      indicators.push("Browsers directory")
    }

    // Check for Wallets directory
    const hasWalletsDir = files.some((f) =>
      f.file_path.match(/Wallets?[\/\\]/i),
    )

    if (hasWalletsDir) {
      confidence += 0.2
      indicators.push("Wallets directory")
    }

    // Check for Files directory (grabbed files - common in Meta/Mars)
    const hasFilesDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]Files?[\/\\]/i),
    )

    if (hasFilesDir) {
      confidence += 0.15
      indicators.push("Files directory (grabbed files)")
    }

    // Check for Screenshot
    const hasScreenshot = files.some((f) =>
      f.file_name.match(/Screenshot\.(jpg|png)$/i),
    )

    if (hasScreenshot) {
      confidence += 0.1
      indicators.push("Screenshot")
    }

    return {
      canParse: confidence >= 0.4,
      confidence: Math.min(confidence, 1.0),
    }
  }

  async parse(
    files: ParsedFile[],
    deviceId: string,
  ): Promise<ParsedStealerData> {
    const credentials: Credential[] = []
    const cookies: Cookie[] = []
    const extensions: BrowserExtension[] = []
    const autofill: AutofillData[] = []
    const credit_cards: any[] = []
    const crypto_wallets: CryptoWallet[] = []
    const messenger_tokens: MessengerToken[] = []
    const history: BrowserHistory[] = []
    const downloads: Download[] = []
    const bookmarks: Bookmark[] = []

    // Parse password files
    const passwordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_name.match(/Passwords?\.txt$/i) ||
          f.file_name.match(/Logins?\.txt$/i)),
    )

    for (const file of passwordFiles) {
      if (file.content) {
        const creds = parsePasswordFile(file.content, file.file_path)
        credentials.push(...creds)
      }
    }

    // Parse cookies - both text and SQLite
    const cookieTextFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_name.match(/Cookies?\.txt$/i) ||
          f.file_name.match(/Cookies?\.json$/i)),
    )

    for (const file of cookieTextFiles) {
      if (!file.content) continue

      if (file.file_name.match(/\.json$/i)) {
        const parsedCookies = parseJSONCookies(file.content, file.file_path)
        cookies.push(...parsedCookies)
      } else {
        const parsedCookies = parseNetscapeCookies(file.content, file.file_path)
        cookies.push(...parsedCookies)
      }
    }

    // Parse SQLite cookies
    const cookieSQLiteFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "cookies" &&
        f.local_file_path,
    )

    for (const file of cookieSQLiteFiles) {
      const parsedCookies = parseSQLiteCookies(
        file.local_file_path!,
        file.file_path,
      )
      cookies.push(...parsedCookies)
    }

    // Parse autofill files
    const autofillFiles = files.filter(
      (f) => !f.is_directory && f.file_name.match(/Autofill\.txt$/i),
    )

    for (const file of autofillFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      const lines = file.content.split("\n")
      for (const line of lines) {
        const match = line.match(/^(.+?):\s*(.+)$/)
        if (match) {
          autofill.push({
            field_name: match[1].trim(),
            field_value: match[2].trim(),
            browser,
            profile,
            file_path: file.file_path,
          })
        }
      }
    }

    // Parse wallet files
    const walletFiles = files.filter(
      (f) => !f.is_directory && f.file_path.match(/Wallets?[\/\\]/i),
    )

    for (const file of walletFiles) {
      if (!file.content) continue

      const content = sanitizeText(file.content)

      const address = extractWalletAddress(content)
      const seedPhrase = extractSeedPhrase(content)

      let walletType = "Unknown"
      if (file.file_name.match(/MetaMask/i)) walletType = "MetaMask"
      else if (file.file_name.match(/Exodus/i)) walletType = "Exodus"
      else if (file.file_name.match(/Electrum/i)) walletType = "Electrum"
      else if (file.file_name.match(/Ethereum/i)) walletType = "Ethereum"
      else if (file.file_name.match(/Bitcoin/i)) walletType = "Bitcoin Core"
      else if (file.file_name.match(/Atomic/i)) walletType = "Atomic"
      else if (file.file_name.match(/Coinomi/i)) walletType = "Coinomi"

      if (address || seedPhrase) {
        crypto_wallets.push({
          wallet_type: walletType,
          wallet_address: address,
          seed_phrase: seedPhrase,
          file_path: file.file_path,
        })
      }
    }

    // Parse browser extensions
    const extensionFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_path.match(/Extensions?[\/\\]/i) &&
        f.file_name.match(/\.json$/i),
    )

    for (const file of extensionFiles) {
      if (!file.content) continue

      try {
        const data = JSON.parse(file.content)
        const browser = detectBrowser(file.file_path)
        const profile = extractProfile(file.file_path)

        const extIdMatch = file.file_path.match(/([a-z]{32})[\/\\]/i)
        const extensionId = extIdMatch ? extIdMatch[1] : "unknown"

        let extensionType = "Unknown"
        let extensionName = data.name || "Unknown Extension"

        if (extensionId === "nkbihfbeogaeaoehlefnkodbefgpgknn") {
          extensionType = "MetaMask"
          extensionName = "MetaMask"
        } else if (data.name?.match(/authenticator/i)) {
          extensionType = "Authenticator"
        }

        extensions.push({
          extension_id: extensionId,
          extension_name: extensionName,
          extension_type: extensionType,
          version: data.version,
          browser,
          profile,
          data: data,
          file_path: file.file_path,
        })
      } catch {
        continue
      }
    }

    // Parse Discord tokens
    const discordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/discord/i) || f.file_name.match(/discord/i)),
    )

    for (const file of discordFiles) {
      if (!file.content) continue

      const token = extractDiscordToken(file.content)
      if (token) {
        messenger_tokens.push({
          messenger_type: "Discord",
          token: token,
          file_path: file.file_path,
        })
      }
    }

    // Parse Telegram
    const telegramFiles = files.filter((f) =>
      f.file_path.match(/Telegram/i),
    )

    if (telegramFiles.length > 0) {
      messenger_tokens.push({
        messenger_type: "Telegram",
        token: "tdata",
        file_path: telegramFiles[0].file_path,
      })
    }

    // Parse SQLite history
    const historySQLiteFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "history" &&
        f.local_file_path,
    )

    for (const file of historySQLiteFiles) {
      const parsedHistory = parseSQLiteHistory(
        file.local_file_path!,
        file.file_path,
      )
      history.push(...parsedHistory)

      const parsedDownloads = parseSQLiteDownloads(
        file.local_file_path!,
        file.file_path,
      )
      downloads.push(...parsedDownloads)
    }

    // Parse bookmarks
    const bookmarkFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "bookmarks" &&
        f.content,
    )

    for (const file of bookmarkFiles) {
      const parsedBookmarks = parseBookmarksJSON(file.content!, file.file_path)
      bookmarks.push(...parsedBookmarks)
    }

    // Extract metadata from System Info.txt
    const systemInfoFile = files.find(
      (f) =>
        f.file_name.match(/^System Info\.txt$/i) ||
        f.file_name.match(/Информация о системе/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined
    let stealerFamily: StealerFamily = StealerFamily.META

    if (systemInfoFile?.content) {
      // Detect if it's Meta or Mars
      if (systemInfoFile.content.match(/Mars/i)) {
        stealerFamily = StealerFamily.MARS
        const versionMatch = systemInfoFile.content.match(/Mars\s+v?([\d.]+)/i)
        if (versionMatch) stealerVersion = versionMatch[1]
      } else if (systemInfoFile.content.match(/Meta/i)) {
        stealerFamily = StealerFamily.META
        const versionMatch = systemInfoFile.content.match(/Meta\s+v?([\d.]+)/i)
        if (versionMatch) stealerVersion = versionMatch[1]
      }

      const buildMatch = systemInfoFile.content.match(/Build:\s*(.+)/i)
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: stealerFamily,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "System Info.txt",
          "Browsers directory",
          "Wallets directory",
          "Files directory",
        ],
      },
      credentials,
      cookies,
      extensions,
      autofill,
      credit_cards,
      crypto_wallets,
      messenger_tokens,
      ftp_credentials: [],
      gaming_sessions: [],
      history,
      downloads,
      bookmarks,
      files,
    }
  }
}
