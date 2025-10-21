/**
 * Aurora Stealer Parser
 *
 * Parses logs from Aurora stealer malware
 * Growing in popularity, focuses on crypto and browser data
 *
 * Typical structure:
 * - {HWID}/
 *   - passwords/
 *     - {browser}_passwords.txt
 *   - cookies/
 *     - {browser}_cookies.txt
 *   - autofill/
 *     - {browser}_autofill.txt
 *   - cc/ (credit cards)
 *   - extensions/
 *   - wallets/
 *   - files/
 *   - screenshot.png
 *   - info.txt (system info)
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

export class AuroraParser implements StealerParser {
  getMetadata() {
    return {
      name: "Aurora Parser",
      family: StealerFamily.AURORA,
      description: "Parser for Aurora stealer logs (crypto-focused)",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for passwords/ directory (lowercase - specific to Aurora)
    const hasPasswordsDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]passwords[\/\\]/i),
    )

    if (hasPasswordsDir) {
      confidence += 0.25
      indicators.push("passwords/ directory")
    }

    // Check for cookies/ directory (lowercase)
    const hasCookiesDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]cookies[\/\\]/i),
    )

    if (hasCookiesDir) {
      confidence += 0.2
      indicators.push("cookies/ directory")
    }

    // Check for autofill/ directory
    const hasAutofillDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]autofill[\/\\]/i),
    )

    if (hasAutofillDir) {
      confidence += 0.15
      indicators.push("autofill/ directory")
    }

    // Check for cc/ directory (credit cards - specific to Aurora)
    const hasCCDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]cc[\/\\]/i),
    )

    if (hasCCDir) {
      confidence += 0.2
      indicators.push("cc/ directory (Aurora-specific)")
    }

    // Check for extensions/ directory
    const hasExtensionsDir = files.some((f) =>
      f.file_path.match(/^[^\/\\]+[\/\\]extensions[\/\\]/i),
    )

    if (hasExtensionsDir) {
      confidence += 0.15
      indicators.push("extensions/ directory")
    }

    // Check for info.txt
    const hasInfoTxt = files.some((f) => f.file_name.match(/^info\.txt$/i))

    if (hasInfoTxt) {
      confidence += 0.1
      indicators.push("info.txt")
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
    const history: BrowserHistory[] = []
    const downloads: Download[] = []
    const bookmarks: Bookmark[] = []

    // Parse password files (in passwords/ directory)
    const passwordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/passwords[\/\\]/i) ||
          f.file_name.match(/_passwords?\.txt$/i)),
    )

    for (const file of passwordFiles) {
      if (file.content) {
        const creds = parsePasswordFile(file.content, file.file_path)
        credentials.push(...creds)
      }
    }

    // Parse cookies - both text files and SQLite
    const cookieTextFiles = files.filter(
      (f) =>
        !f.is_directory &&
        f.file_path.match(/cookies[\/\\]/i) &&
        f.file_name.match(/\.(txt|json)$/i),
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
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/autofill[\/\\]/i) ||
          f.file_name.match(/_autofill\.txt$/i)),
    )

    for (const file of autofillFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Aurora autofill format: "Name: value"
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

    // Parse credit card files (in cc/ directory)
    const creditCardFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/cc[\/\\]/i) ||
          f.file_name.match(/_cc\.txt$/i) ||
          f.file_name.match(/credit.*card/i)),
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

          const numberMatch = trimmed.match(/^(?:Number|Card Number):\s*(.+)$/i)
          const nameMatch = trimmed.match(
            /^(?:Name|Cardholder|Cardholder Name):\s*(.+)$/i,
          )
          const expMatch = trimmed.match(
            /^(?:Exp|Expiration|Exp Date):\s*(\d+)[\/\-](\d+)$/i,
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

    // Parse crypto wallets
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
      if (file.file_name.match(/MetaMask/i)) walletType = "MetaMask"
      else if (file.file_name.match(/Exodus/i)) walletType = "Exodus"
      else if (file.file_name.match(/Electrum/i)) walletType = "Electrum"
      else if (file.file_name.match(/Phantom/i)) walletType = "Phantom"
      else if (file.file_name.match(/Coinbase/i)) walletType = "Coinbase"
      else if (file.file_name.match(/Trust/i)) walletType = "Trust Wallet"
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

    // Parse browser extensions (crypto wallets)
    const extensionFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/extensions?[\/\\]/i) ||
          f.file_path.match(/Local Extension Settings[\/\\]/i)) &&
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

        // Crypto wallet detection
        const cryptoWallets = {
          nkbihfbeogaeaoehlefnkodbefgpgknn: { name: "MetaMask", type: "Crypto" },
          ibnejdfjmmkpcnlpebklmnkoeoihofec: { name: "TronLink", type: "Crypto" },
          bfnaelmomeimhlpmgjnjophhpkkoljpa: { name: "Phantom", type: "Crypto" },
          hnfanknocfeofbddgcijnmhnfnkdnaad: {
            name: "Coinbase Wallet",
            type: "Crypto",
          },
          fhbohimaelbohpjbbldcngcnapndodjp: {
            name: "Binance Chain",
            type: "Crypto",
          },
          egjidjbpglichdcondbcbdnbeeppgdph: {
            name: "Trust Wallet",
            type: "Crypto",
          },
        }

        if (cryptoWallets[extensionId as keyof typeof cryptoWallets]) {
          const wallet = cryptoWallets[extensionId as keyof typeof cryptoWallets]
          extensionName = wallet.name
          extensionType = wallet.type
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

    // Extract metadata from info.txt
    const infoFile = files.find((f) => f.file_name.match(/^info\.txt$/i))
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (infoFile?.content) {
      const versionMatch = infoFile.content.match(/Aurora\s+v?([\d.]+)/i)
      const buildMatch = infoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.AURORA,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "passwords/ directory",
          "cookies/ directory",
          "cc/ directory",
          "extensions/ directory",
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
