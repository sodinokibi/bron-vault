/**
 * Raccoon Stealer Parser
 *
 * Parses logs from Raccoon stealer malware (v1 and v2)
 *
 * Typical structure:
 * - {machineId}_country/
 *   - System Info.txt
 *   - cookies.txt
 *   - autofills.txt
 *   - passwords.txt
 *   - credit_cards.txt
 *   - Wallets/
 *   - Screenshot.jpg
 *   - {browser}/
 *     - cookies
 *     - passwords
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

export class RaccoonParser implements StealerParser {
  getMetadata() {
    return {
      name: "Raccoon Parser",
      family: StealerFamily.RACCOON,
      description: "Parser for Raccoon stealer logs (v1 and v2)",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for "System Info.txt" (very specific to Raccoon)
    const hasSystemInfo = files.some((f) =>
      f.file_name.match(/^System Info\.txt$/i),
    )

    if (hasSystemInfo) {
      confidence += 0.4
      indicators.push("System Info.txt")
    }

    // Check for root-level data files (Raccoon v2 style)
    const hasCookiesTxt = files.some(
      (f) =>
        f.file_name.match(/^cookies\.txt$/i) &&
        !f.file_path.match(/[\/\\].*[\/\\]/), // Root level
    )
    const hasPasswordsTxt = files.some(
      (f) =>
        f.file_name.match(/^passwords\.txt$/i) &&
        !f.file_path.match(/[\/\\].*[\/\\]/),
    )
    const hasAutofillsTxt = files.some(
      (f) =>
        f.file_name.match(/^autofills\.txt$/i) &&
        !f.file_path.match(/[\/\\].*[\/\\]/),
    )

    if (hasCookiesTxt) {
      confidence += 0.2
      indicators.push("Root-level cookies.txt")
    }

    if (hasPasswordsTxt) {
      confidence += 0.2
      indicators.push("Root-level passwords.txt")
    }

    if (hasAutofillsTxt) {
      confidence += 0.1
      indicators.push("Root-level autofills.txt")
    }

    // Check for screenshot
    const hasScreenshot = files.some((f) =>
      f.file_name.match(/^Screenshot\.(jpg|png)$/i),
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
    const credit_cards: CreditCard[] = []
    const crypto_wallets: CryptoWallet[] = []
    const messenger_tokens: MessengerToken[] = []

    // Parse password files
    const passwordFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_name.match(/^passwords?\.txt$/i) ||
          f.file_name.match(/password/i)),
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
        (f.file_name.match(/^cookies?\.txt$/i) ||
          f.file_name.match(/^cookies?\.json$/i)),
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
        (f.file_name.match(/^autofills?\.txt$/i) ||
          f.file_name.match(/autofill/i)),
    )

    for (const file of autofillFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Raccoon autofill format: "Name\tValue"
      const lines = file.content.split("\n")

      for (const line of lines) {
        const parts = line.split("\t")
        if (parts.length >= 2) {
          autofill.push({
            field_name: parts[0].trim(),
            field_value: parts[1].trim(),
            times_used: parts[2] ? Number.parseInt(parts[2]) : undefined,
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
        (f.file_name.match(/^credit_?cards?\.txt$/i) ||
          f.file_name.match(/credit.*card/i)),
    )

    for (const file of creditCardFiles) {
      if (!file.content) continue

      const browser = detectBrowser(file.file_path)
      const profile = extractProfile(file.file_path)

      // Raccoon format: tab-separated or line-separated
      const lines = file.content.split("\n")

      for (const line of lines) {
        if (!line.trim()) continue

        // Try tab-separated first
        const parts = line.split("\t")

        let cardNumber = ""
        let cardholderName = ""
        let expMonth = 0
        let expYear = 0

        if (parts.length >= 4) {
          // Format: Number\tName\tMonth\tYear
          cardNumber = parts[0].trim()
          cardholderName = parts[1].trim()
          expMonth = Number.parseInt(parts[2])
          expYear = Number.parseInt(parts[3])
        } else {
          // Try colon-separated format
          const numberMatch = line.match(/Number:\s*(.+)/i)
          const nameMatch = line.match(/Name:\s*(.+)/i)
          const expMatch = line.match(/Exp:\s*(\d+)[\/\-](\d+)/i)

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
      (f) =>
        !f.is_directory &&
        (f.file_path.match(/Wallets?[\/\\]/i) ||
          f.file_name.match(/wallet/i)),
    )

    for (const file of walletFiles) {
      if (!file.content) continue

      const content = sanitizeText(file.content)

      const address = extractWalletAddress(content)
      const seedPhrase = extractSeedPhrase(content)

      let walletType = "Unknown"
      if (file.file_name.match(/Metamask/i)) walletType = "MetaMask"
      else if (file.file_name.match(/Exodus/i)) walletType = "Exodus"
      else if (file.file_name.match(/Electrum/i)) walletType = "Electrum"
      else if (file.file_name.match(/Ethereum/i)) walletType = "Ethereum"
      else if (file.file_name.match(/Bitcoin/i)) walletType = "Bitcoin Core"

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
        (f.file_name.match(/discord/i) || f.file_path.match(/discord/i)),
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

    // Extract metadata from System Info.txt
    const systemInfoFile = files.find((f) =>
      f.file_name.match(/^System Info\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (systemInfoFile?.content) {
      const versionMatch = systemInfoFile.content.match(/Raccoon\s+v?([\d.]+)/i)
      const buildMatch = systemInfoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.RACCOON,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "System Info.txt",
          "Root-level data files",
          "Tab-separated format",
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
      files,
    }
  }
}
