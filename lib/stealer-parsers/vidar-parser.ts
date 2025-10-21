/**
 * Vidar Stealer Parser
 *
 * Parses logs from Vidar stealer malware
 * Very similar to Redline with some structural differences
 *
 * Typical structure:
 * - Information.txt (system info)
 * - Browsers/
 *   - {browser}/
 *     - Passwords.txt
 *     - Cookies.txt
 *     - Autofill.txt
 *     - History
 *     - Bookmarks
 * - Wallets/
 * - Files/ (grabbed files)
 * - Screenshot.jpg
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
  sanitizeText,
} from "./utils"
import {
  parseSQLiteCookies,
  parseSQLiteHistory,
  parseSQLiteDownloads,
  parseBookmarksJSON,
  isSQLiteDatabase,
} from "./sqlite-parser"

export class VidarParser implements StealerParser {
  getMetadata() {
    return {
      name: "Vidar Parser",
      family: StealerFamily.VIDAR,
      description: "Parser for Vidar stealer logs (similar to Redline)",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for Information.txt (not UserInformation.txt like Redline)
    const hasInformationFile = files.some((f) =>
      f.file_name.match(/^Information\.txt$/i),
    )

    if (hasInformationFile) {
      confidence += 0.3
      indicators.push("Information.txt")
    }

    // Check for Browsers directory
    const hasBrowsersDir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]/i),
    )

    if (hasBrowsersDir) {
      confidence += 0.25
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

    // Check for Files directory (grabbed files - specific to Vidar)
    const hasFilesDir = files.some((f) =>
      f.file_path.match(/^Files?[\/\\]/i),
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

    // Parse cookies - both text files and SQLite databases
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

    // Parse SQLite cookie databases
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

    // Parse SQLite history databases
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

      // Downloads are in the same History database
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
      else if (file.file_name.match(/Bitcoin/i)) walletType = "Bitcoin"
      else if (file.file_name.match(/Atomic/i)) walletType = "Atomic"

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

    // Extract metadata from Information.txt
    const infoFile = files.find((f) =>
      f.file_name.match(/^Information\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (infoFile?.content) {
      const versionMatch = infoFile.content.match(/Vidar\s+v?([\d.]+)/i)
      const buildMatch = infoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.VIDAR,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "Information.txt",
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
      messenger_tokens: [],
      ftp_credentials: [],
      gaming_sessions: [],
      history,
      downloads,
      bookmarks,
      files,
    }
  }
}
