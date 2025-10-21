/**
 * StealC Stealer Parser
 *
 * Parses logs from StealC stealer malware
 *
 * Typical structure:
 * - Browsers/
 *   - Chrome/
 *     - Passwords.txt
 *     - Cookies.txt
 *     - Autofill.txt
 *     - CreditCards.txt
 *   - Firefox/
 *     - ...
 * - Wallets/
 * - Screenshot.jpg
 * - Information.txt (system info)
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
} from "./types"
import {
  parsePasswordFile,
  parseNetscapeCookies,
  parseJSONCookies,
  detectBrowser,
  extractProfile,
  extractDomain,
  findFilesByPatterns,
  containsFiles,
  extractWalletAddress,
  extractSeedPhrase,
  sanitizeText,
} from "./utils"

export class StealCParser implements StealerParser {
  getMetadata() {
    return {
      name: "StealC Parser",
      family: StealerFamily.STEALC,
      description: "Parser for StealC stealer logs",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for typical StealC directory structure
    const hasBrowsersDir = files.some((f) =>
      f.file_path.match(/Browsers?[\/\\]/i),
    )
    const hasWalletsDir = files.some((f) =>
      f.file_path.match(/Wallets?[\/\\]/i),
    )
    const hasInformationFile = files.some((f) =>
      f.file_name.match(/Information\.txt$/i),
    )
    const hasScreenshot = files.some((f) =>
      f.file_name.match(/Screenshot\.(jpg|png)$/i),
    )

    if (hasBrowsersDir) {
      confidence += 0.3
      indicators.push("Browsers directory")
    }

    if (hasWalletsDir) {
      confidence += 0.2
      indicators.push("Wallets directory")
    }

    if (hasInformationFile) {
      confidence += 0.25
      indicators.push("Information.txt file")
    }

    if (hasScreenshot) {
      confidence += 0.15
      indicators.push("Screenshot file")
    }

    // Check for typical file patterns
    const hasPasswordsTxt = files.some((f) =>
      f.file_name.match(/Passwords?\.txt$/i),
    )
    const hasCookiesTxt = files.some((f) =>
      f.file_name.match(/Cookies?\.txt$/i),
    )
    const hasAutofillTxt = files.some((f) =>
      f.file_name.match(/Autofill\.txt$/i),
    )

    if (hasPasswordsTxt) confidence += 0.1
    if (hasCookiesTxt) confidence += 0.05
    if (hasAutofillTxt) confidence += 0.05

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

    // Parse cookies files
    const cookieFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_name.match(/Cookies?\.txt$/i) ||
          f.file_name.match(/Cookies?\.json$/i)),
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
      (f) => !f.is_directory && f.file_name.match(/Autofill\.txt$/i),
    )

    for (const file of autofillFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Parse autofill format: "Name: value" pairs
      const lines = file.content.split("\n")
      for (let i = 0; i < lines.length; i += 2) {
        const nameMatch = lines[i]?.match(/^Name:\s*(.+)$/i)
        const valueMatch = lines[i + 1]?.match(/^Value:\s*(.+)$/i)

        if (nameMatch && valueMatch) {
          autofill.push({
            field_name: nameMatch[1].trim(),
            field_value: valueMatch[1].trim(),
            browser,
            profile,
            file_path: file.file_path,
          })
        }
      }
    }

    // Parse credit card files
    const creditCardFiles = files.filter(
      (f) => !f.is_directory && f.file_name.match(/CreditCards?\.txt$/i),
    )

    for (const file of creditCardFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Parse credit card format
      const blocks = file.content.split(/\n{2,}/)

      for (const block of blocks) {
        const lines = block.trim().split("\n")

        let cardNumber = ""
        let cardholderName = ""
        let expMonth = 0
        let expYear = 0

        for (const line of lines) {
          const trimmed = line.trim()

          const numberMatch = trimmed.match(/^(?:Card Number|Number):\s*(.+)$/i)
          const nameMatch = trimmed.match(/^(?:Cardholder Name|Name):\s*(.+)$/i)
          const expMatch = trimmed.match(
            /^(?:Expiration|Exp Date):\s*(\d+)\s*\/\s*(\d+)$/i,
          )

          if (numberMatch) cardNumber = numberMatch[1].trim()
          if (nameMatch) cardholderName = nameMatch[1].trim()
          if (expMatch) {
            expMonth = Number.parseInt(expMatch[1])
            expYear = Number.parseInt(expMatch[2])
          }
        }

        if (cardNumber && cardholderName) {
          // Only store last 4 digits for security
          const last4 = cardNumber.slice(-4)

          credit_cards.push({
            card_number_encrypted: "", // We don't encrypt in parser
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
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Wallets?[\/\\]/i) ||
          f.file_name.match(/wallet/i)),
    )

    for (const file of walletFiles) {
      if (!file.content) continue

      const content = sanitizeText(file.content)

      // Try to extract wallet data
      const address = extractWalletAddress(content)
      const seedPhrase = extractSeedPhrase(content)

      // Determine wallet type from path or filename
      let walletType = "Unknown"
      if (file.file_path.match(/MetaMask/i)) walletType = "MetaMask"
      else if (file.file_path.match(/Exodus/i)) walletType = "Exodus"
      else if (file.file_path.match(/Electrum/i)) walletType = "Electrum"
      else if (file.file_path.match(/Coinomi/i)) walletType = "Coinomi"
      else if (file.file_path.match(/Atomic/i)) walletType = "Atomic"

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

        // Extract extension ID from path
        const extIdMatch = file.file_path.match(
          /([a-z]{32})[\/\\]/i,
        )
        const extensionId = extIdMatch ? extIdMatch[1] : "unknown"

        // Determine extension type
        let extensionType = "Unknown"
        let extensionName = data.name || "Unknown Extension"

        if (file.file_path.match(/nkbihfbeogaeaoehlefnkodbefgpgknn/i)) {
          extensionType = "MetaMask"
          extensionName = "MetaMask"
        } else if (file.file_path.match(/ibnejdfjmmkpcnlpebklmnkoeoihofec/i)) {
          extensionType = "TronLink"
          extensionName = "TronLink"
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
        // Invalid JSON, skip
        continue
      }
    }

    // Determine version and build ID from Information.txt if present
    const infoFile = files.find((f) =>
      f.file_name.match(/Information\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (infoFile?.content) {
      const versionMatch = infoFile.content.match(/StealC\s+v?([\d.]+)/i)
      const buildMatch = infoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.STEALC,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "Browsers directory structure",
          "Wallets directory",
          "Information.txt",
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
      history: [],
      downloads: [],
      bookmarks: [],
      files,
    }
  }
}
