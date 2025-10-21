/**
 * Redline Stealer Parser
 *
 * Parses logs from Redline stealer malware
 *
 * Typical structure:
 * - UserInformation.txt (system info, IP, location)
 * - Browsers/
 *   - Passwords/
 *     - {browser}_*.txt
 *   - Cookies/
 *     - {browser}_*.txt
 *   - Autofills/
 *   - CreditCards/
 * - Wallets/
 * - FTP/
 *   - FileZilla.txt
 * - Messengers/
 *   - Discord/
 *   - Telegram/
 * - Games/
 *   - Steam.txt
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
  type FTPCredential,
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
  isSQLiteDatabase,
} from "./sqlite-parser"
import {
  parseFirefoxPlaces,
  parseFirefoxCookies,
  parseFirefoxFormHistory,
  parseFirefoxLogins,
  parseFirefoxExtensions,
  isFirefoxDatabase,
} from "./firefox-parser"

export class RedlineParser implements StealerParser {
  getMetadata() {
    return {
      name: "Redline Parser",
      family: StealerFamily.REDLINE,
      description: "Parser for Redline stealer logs",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for UserInformation.txt (very specific to Redline)
    const hasUserInfo = files.some((f) =>
      f.file_name.match(/^UserInformation\.txt$/i),
    )

    if (hasUserInfo) {
      confidence += 0.4
      indicators.push("UserInformation.txt")
    }

    // Check for Browsers directory
    const hasBrowsersDir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]/i),
    )

    if (hasBrowsersDir) {
      confidence += 0.2
      indicators.push("Browsers directory")
    }

    // Check for typical subdirectories
    const hasPasswordsSubdir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]Passwords?[\/\\]/i),
    )
    const hasCookiesSubdir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]Cookies?[\/\\]/i),
    )

    if (hasPasswordsSubdir) {
      confidence += 0.15
      indicators.push("Browsers/Passwords structure")
    }

    if (hasCookiesSubdir) {
      confidence += 0.1
      indicators.push("Browsers/Cookies structure")
    }

    // Check for FTP directory
    const hasFTPDir = files.some((f) => f.file_path.match(/FTP[\/\\]/i))

    if (hasFTPDir) {
      confidence += 0.1
      indicators.push("FTP directory")
    }

    // Check for Games directory
    const hasGamesDir = files.some((f) => f.file_path.match(/Games[\/\\]/i))

    if (hasGamesDir) {
      confidence += 0.05
      indicators.push("Games directory")
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
    const ftp_credentials: FTPCredential[] = []
    const gaming_sessions: GamingSession[] = []
    const history: BrowserHistory[] = []
    const downloads: Download[] = []
    const bookmarks: Bookmark[] = []

    // Parse password files (in Browsers/Passwords/)
    const passwordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_path.match(/Browsers?[\/\\]Passwords?[\/\\]/i),
    )

    for (const file of passwordFiles) {
      if (file.content) {
        const creds = parsePasswordFile(file.content, file.file_path)
        credentials.push(...creds)
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

    // Parse cookies files (in Browsers/Cookies/)
    const cookieFiles = files.filter(
      (f) =>
        !f.is_directory && f.file_path.match(/Browsers?[\/\\]Cookies?[\/\\]/i),
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

    // Parse SQLite cookie databases (Chrome/Chromium)
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

    // Parse autofill files (in Browsers/Autofills/)
    const autofillFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_path.match(/Browsers?[\/\\]Autofills?[\/\\]/i),
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

    // Parse credit card files (in Browsers/CreditCards/)
    const creditCardFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_path.match(/Browsers?[\/\\]CreditCards?[\/\\]/i),
    )

    for (const file of creditCardFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      const blocks = file.content.split(/\n{2,}/)

      for (const block of blocks) {
        const lines = block.trim().split("\n")

        let cardNumber = ""
        let cardholderName = ""
        let expMonth = 0
        let expYear = 0

        for (const line of lines) {
          const trimmed = line.trim()

          const numberMatch = trimmed.match(/^Card Number:\s*(.+)$/i)
          const nameMatch = trimmed.match(/^Cardholder Name:\s*(.+)$/i)
          const expMatch = trimmed.match(
            /^Expiration:\s*(\d+)[\/\-](\d+)$/i,
          )

          if (numberMatch) cardNumber = numberMatch[1].trim()
          if (nameMatch) cardholderName = nameMatch[1].trim()
          if (expMatch) {
            expMonth = Number.parseInt(expMatch[1])
            expYear = Number.parseInt(expMatch[2])
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

      if (address || seedPhrase) {
        crypto_wallets.push({
          wallet_type: walletType,
          wallet_address: address,
          seed_phrase: seedPhrase,
          file_path: file.file_path,
        })
      }
    }

    // Parse FTP credentials (FileZilla.txt)
    const ftpFiles = files.filter(
      (f) => !f.is_directory && f.file_path.match(/FTP[\/\\]/i),
    )

    for (const file of ftpFiles) {
      if (!file.content) continue

      const lines = file.content.split("\n")

      let host = ""
      let port = 21
      let username = ""
      let password = ""
      const software = "FileZilla"

      for (const line of lines) {
        const trimmed = line.trim()

        const hostMatch = trimmed.match(/^Host:\s*(.+)$/i)
        const portMatch = trimmed.match(/^Port:\s*(\d+)$/i)
        const userMatch = trimmed.match(/^User:\s*(.+)$/i)
        const passMatch = trimmed.match(/^Password:\s*(.+)$/i)

        if (hostMatch) host = hostMatch[1].trim()
        if (portMatch) port = Number.parseInt(portMatch[1])
        if (userMatch) username = userMatch[1].trim()
        if (passMatch) password = passMatch[1].trim()
      }

      if (host && username && password) {
        ftp_credentials.push({
          protocol: port === 22 ? "SFTP" : "FTP",
          host,
          port,
          username,
          password,
          software,
          file_path: file.file_path,
        })
      }
    }

    // Parse messenger tokens
    const messengerFiles = files.filter(
      (f) => !f.is_directory && f.file_path.match(/Messengers?[\/\\]/i),
    )

    for (const file of messengerFiles) {
      if (!file.content) continue

      // Discord tokens
      if (file.file_path.match(/Discord/i)) {
        const token = extractDiscordToken(file.content)
        if (token) {
          messenger_tokens.push({
            messenger_type: "Discord",
            token: token,
            file_path: file.file_path,
          })
        }
      }

      // Telegram
      if (file.file_path.match(/Telegram/i)) {
        messenger_tokens.push({
          messenger_type: "Telegram",
          token: "session_data",
          file_path: file.file_path,
        })
      }
    }

    // Parse gaming sessions
    const gameFiles = files.filter(
      (f) => !f.is_directory && f.file_path.match(/Games?[\/\\]/i),
    )

    for (const file of gameFiles) {
      if (!file.content) continue

      // Steam
      if (file.file_name.match(/Steam/i)) {
        const usernameMatch = file.content.match(/Username:\s*(.+)/i)
        const emailMatch = file.content.match(/Email:\s*(.+)/i)

        gaming_sessions.push({
          platform: "Steam",
          username: usernameMatch ? usernameMatch[1].trim() : undefined,
          email: emailMatch ? emailMatch[1].trim() : undefined,
          session_token: "ssfn",
          file_path: file.file_path,
        })
      }

      // Epic Games
      if (file.file_name.match(/Epic/i)) {
        const usernameMatch = file.content.match(/Username:\s*(.+)/i)

        gaming_sessions.push({
          platform: "Epic Games",
          username: usernameMatch ? usernameMatch[1].trim() : undefined,
          session_token: "session",
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

    // Parse SQLite history databases (Chrome/Chromium)
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

    // Parse Firefox places.sqlite (history, bookmarks, downloads all in one!)
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

    // Extract metadata from UserInformation.txt
    const userInfoFile = files.find((f) =>
      f.file_name.match(/^UserInformation\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (userInfoFile?.content) {
      const versionMatch = userInfoFile.content.match(/Redline\s+v?([\d.]+)/i)
      const buildMatch = userInfoFile.content.match(/Build ID:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.REDLINE,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "UserInformation.txt",
          "Browsers/Passwords structure",
          "FTP directory",
          "Games directory",
        ],
      },
      credentials,
      cookies,
      extensions,
      autofill,
      credit_cards,
      crypto_wallets,
      messenger_tokens,
      ftp_credentials,
      gaming_sessions,
      history,
      downloads,
      bookmarks,
      files,
    }
  }
}
