/**
 * Lumma Stealer Parser
 *
 * Parses logs from Lumma stealer malware
 *
 * Typical structure:
 * - {HWID}/
 *   - user_data/
 *     - Passwords/
 *       - {browser}_passwords.txt
 *     - Cookies/
 *       - {browser}_cookies.txt
 *     - Autofills/
 *     - Cards/
 *   - wallets/
 *   - files/
 *   - information.txt
 *   - screenshot.jpg
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
  type CreditCard,
  type CryptoWallet,
  type MessengerToken,
  type GamingSession,
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
  extractDomain,
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
import {
  parseFirefoxPlaces,
  parseFirefoxCookies,
  parseFirefoxFormHistory,
  parseFirefoxLogins,
  parseFirefoxExtensions,
} from "./firefox-parser"

export class LummaParser implements StealerParser {
  getMetadata() {
    return {
      name: "Lumma Parser",
      family: StealerFamily.LUMMA,
      description: "Parser for Lumma stealer logs",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for typical Lumma directory structure
    const hasUserData = files.some((f) =>
      f.file_path.match(/user_data[\/\\]/i),
    )
    const hasPasswordsDir = files.some((f) =>
      f.file_path.match(/Passwords?[\/\\]/i),
    )
    const hasCookiesDir = files.some((f) =>
      f.file_path.match(/Cookies?[\/\\]/i),
    )
    const hasWalletsDir = files.some((f) =>
      f.file_path.match(/wallets?[\/\\]/i),
    )
    const hasInformationFile = files.some((f) =>
      f.file_name.match(/information\.txt$/i),
    )

    if (hasUserData) {
      confidence += 0.35
      indicators.push("user_data directory")
    }

    if (hasPasswordsDir) {
      confidence += 0.2
      indicators.push("Passwords directory")
    }

    if (hasCookiesDir) {
      confidence += 0.15
      indicators.push("Cookies directory")
    }

    if (hasWalletsDir) {
      confidence += 0.15
      indicators.push("wallets directory")
    }

    if (hasInformationFile) {
      confidence += 0.15
      indicators.push("information.txt file")
    }

    // Check for browser-specific file naming (e.g., "chrome_passwords.txt")
    const hasBrowserFiles = files.some((f) =>
      f.file_name.match(/^(chrome|firefox|edge|opera)_/i),
    )

    if (hasBrowserFiles) {
      confidence += 0.1
      indicators.push("Browser-specific file naming")
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
    const credit_cards: CreditCard[] = []
    const crypto_wallets: CryptoWallet[] = []
    const messenger_tokens: MessengerToken[] = []
    const gaming_sessions: GamingSession[] = []
    const history: BrowserHistory[] = []
    const downloads: Download[] = []
    const bookmarks: Bookmark[] = []

    // Parse password files
    const passwordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Passwords?[\/\\]/i) ||
          f.file_name.match(/_passwords?\.txt$/i)),
    )

    for (const file of passwordFiles) {
      if (file.content) {
        const creds = parsePasswordFile(file.content, file.file_path)
        credentials.push(...creds)
      }
    }

    // Parse cookies files
    const cookieFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Cookies?[\/\\]/i) ||
          f.file_name.match(/_cookies?\.txt$/i)),
    )

    for (const file of cookieFiles) {
      if (!file.content) continue

      if (file.file_name.match(/\.json$/i)) {
        const parsedCookies = parseJSONCookies(file.content, file.file_path)
        cookies.push(...parsedCookies)
      } else {
        const parsedCookies = parseNetscapeCookies(file.content, file.file_path)
        cookies.push(...parsedCookies)
      }
    }

    // Parse autofill files
    const autofillFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Autofills?[\/\\]/i) ||
          f.file_name.match(/_autofill\.txt$/i)),
    )

    for (const file of autofillFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Parse autofill format (similar to StealC)
      const lines = file.content.split("\n")
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // Format: "Name: value" or "name = value"
        const match =
          line.match(/^(.+?):\s*(.+)$/) || line.match(/^(.+?)\s*=\s*(.+)$/)

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

    // Parse credit card files
    const creditCardFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Cards?[\/\\]/i) ||
          f.file_name.match(/_cards?\.txt$/i)),
    )

    for (const file of creditCardFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      const blocks = file.content.split(/\n{2,}|[-=]{3,}\n/)

      for (const block of blocks) {
        const lines = block.trim().split("\n")

        let cardNumber = ""
        let cardholderName = ""
        let expMonth = 0
        let expYear = 0

        for (const line of lines) {
          const trimmed = line.trim()

          const numberMatch = trimmed.match(/^(?:Number|Card):\s*(.+)$/i)
          const nameMatch = trimmed.match(/^(?:Name|Holder):\s*(.+)$/i)
          const expMatch = trimmed.match(
            /^(?:Exp|Expiration):\s*(\d+)[\/\-](\d+)$/i,
          )

          if (numberMatch) cardNumber = numberMatch[1].trim()
          if (nameMatch) cardholderName = nameMatch[1].trim()
          if (expMatch) {
            expMonth = Number.parseInt(expMatch[1])
            expYear = Number.parseInt(expMatch[2])
            // Handle 2-digit year
            if (expYear < 100) expYear += 2000
          }
        }

        if (cardNumber && cardholderName) {
          const last4 = cardNumber.slice(-4)

          credit_cards.push({
            card_number_encrypted: "",
            card_number_last4: last4,
            cardholder_name: cardholderName,
            expiration_month: expMonth,
            expiration_year: expYear,
            browser,
            profile,
            file_path: file.file_path,
          })
        }
      }
    }

    // Parse Firefox logins.json
    const firefoxLoginsFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "logins.json" &&
        f.content,
    )

    for (const file of firefoxLoginsFiles) {
      const parsedCreds = parseFirefoxLogins(file.content!, file.file_path)
      credentials.push(...parsedCreds)
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

    // Parse Firefox cookies.sqlite
    const firefoxCookieFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "cookies.sqlite" &&
        f.local_file_path,
    )

    for (const file of firefoxCookieFiles) {
      const parsedCookies = parseFirefoxCookies(
        file.local_file_path!,
        file.file_path,
      )
      cookies.push(...parsedCookies)
    }

    // Parse Firefox formhistory.sqlite
    const firefoxFormHistoryFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "formhistory.sqlite" &&
        f.local_file_path,
    )

    for (const file of firefoxFormHistoryFiles) {
      const parsedAutofill = parseFirefoxFormHistory(
        file.local_file_path!,
        file.file_path,
      )
      autofill.push(...parsedAutofill)
    }

    // Parse wallet files
    const walletFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/wallets?[\/\\]/i) ||
          f.file_path.match(/crypto/i)),
    )

    for (const file of walletFiles) {
      if (!file.content) continue

      const content = sanitizeText(file.content)

      const address = extractWalletAddress(content)
      const seedPhrase = extractSeedPhrase(content)

      let walletType = "Unknown"
      if (file.file_path.match(/MetaMask/i)) walletType = "MetaMask"
      else if (file.file_path.match(/Exodus/i)) walletType = "Exodus"
      else if (file.file_path.match(/Electrum/i)) walletType = "Electrum"
      else if (file.file_path.match(/Phantom/i)) walletType = "Phantom"
      else if (file.file_path.match(/Coinbase/i)) walletType = "Coinbase"
      else if (file.file_path.match(/Trust/i)) walletType = "Trust Wallet"

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

        // Identify crypto wallet extensions
        if (
          extensionId === "nkbihfbeogaeaoehlefnkodbefgpgknn" ||
          file.file_path.match(/MetaMask/i)
        ) {
          extensionType = "MetaMask"
          extensionName = "MetaMask"
        } else if (
          extensionId === "ibnejdfjmmkpcnlpebklmnkoeoihofec" ||
          file.file_path.match(/TronLink/i)
        ) {
          extensionType = "TronLink"
          extensionName = "TronLink"
        } else if (
          extensionId === "bfnaelmomeimhlpmgjnjophhpkkoljpa" ||
          file.file_path.match(/Phantom/i)
        ) {
          extensionType = "Phantom"
          extensionName = "Phantom"
        } else if (data.name?.match(/authenticator/i)) {
          extensionType = "Authenticator"
        } else if (data.name?.match(/password/i)) {
          extensionType = "PasswordManager"
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

    // Parse Telegram data
    const telegramFiles = files.filter((f) =>
      f.file_path.match(/Telegram/i),
    )

    for (const file of telegramFiles) {
      if (file.file_path.match(/tdata/i)) {
        // Telegram session found
        messenger_tokens.push({
          messenger_type: "Telegram",
          token: "tdata",
          file_path: file.file_path,
        })
        break // Only add once per device
      }
    }

    // Parse Steam session files
    const steamFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Steam/i) || f.file_name.match(/ssfn/i)),
    )

    if (steamFiles.length > 0) {
      // Look for loginusers.vdf for username
      const loginUsersFile = files.find((f) =>
        f.file_name.match(/loginusers\.vdf$/i),
      )

      let username: string | undefined
      if (loginUsersFile?.content) {
        const usernameMatch = loginUsersFile.content.match(
          /"AccountName"\s+"(.+?)"/i,
        )
        if (usernameMatch) username = usernameMatch[1]
      }

      gaming_sessions.push({
        platform: "Steam",
        username,
        session_token: "ssfn",
        file_path: steamFiles[0].file_path,
      })
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

      const parsedDownloads = parseSQLiteDownloads(
        file.local_file_path!,
        file.file_path,
      )
      downloads.push(...parsedDownloads)
    }

    // Parse Firefox places.sqlite
    const firefoxPlacesFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "places.sqlite" &&
        f.local_file_path,
    )

    for (const file of firefoxPlacesFiles) {
      const parsed = parseFirefoxPlaces(file.local_file_path!, file.file_path)
      history.push(...parsed.history)
      bookmarks.push(...parsed.bookmarks)
      downloads.push(...parsed.downloads)
    }

    // Parse Chrome/Chromium bookmarks
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

    // Parse Firefox extensions.json
    const firefoxExtensionsFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_name.toLowerCase() === "extensions.json" &&
        f.content,
    )

    for (const file of firefoxExtensionsFiles) {
      const parsedExtensions = parseFirefoxExtensions(
        file.content!,
        file.file_path,
      )
      extensions.push(...parsedExtensions)
    }

    // Extract metadata from information.txt
    const infoFile = files.find((f) =>
      f.file_name.match(/information\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (infoFile?.content) {
      const versionMatch = infoFile.content.match(/Lumma\s+v?([\d.]+)/i)
      const buildMatch = infoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.LUMMA,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "user_data directory structure",
          "Passwords/Cookies/Cards directories",
          "wallets directory",
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
      gaming_sessions,
      history,
      downloads,
      bookmarks,
      files,
    }
  }
}
