/**
 * FormBook Stealer Parser
 *
 * Parses logs from FormBook stealer malware (older but still widely used)
 * FormBook is more of a form grabber and keylogger than a modern stealer
 *
 * Typical structure:
 * - Grabbed_Data.txt or FormBook_Data.txt (grabbed form data)
 * - Passwords.txt (browser passwords)
 * - Cookies.txt (browser cookies)
 * - Screenshots/ (keylogger screenshots)
 * - System_Info.txt (basic system info)
 */

import {
  type StealerParser,
  type ParsedStealerData,
  type ParsedFile,
  StealerFamily,
  type Credential,
  type Cookie,
  type AutofillData,
} from "./types"
import {
  parsePasswordFile,
  parseNetscapeCookies,
  parseJSONCookies,
  detectBrowser,
  extractProfile,
} from "./utils"

export class FormBookParser implements StealerParser {
  getMetadata() {
    return {
      name: "FormBook Parser",
      family: StealerFamily.FORMBOOK,
      description:
        "Parser for FormBook stealer logs (older form grabber/keylogger)",
    }
  }

  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number } {
    let confidence = 0
    const indicators: string[] = []

    // Check for Grabbed_Data.txt or FormBook_Data.txt (very specific to FormBook)
    const hasGrabbedData = files.some(
      (f) =>
        f.file_name.match(/Grabbed.*Data\.txt$/i) ||
        f.file_name.match(/FormBook.*Data\.txt$/i),
    )

    if (hasGrabbedData) {
      confidence += 0.5
      indicators.push("Grabbed_Data.txt (FormBook-specific)")
    }

    // Check for System_Info.txt
    const hasSystemInfo = files.some((f) =>
      f.file_name.match(/System_Info\.txt$/i),
    )

    if (hasSystemInfo) {
      confidence += 0.2
      indicators.push("System_Info.txt")
    }

    // Check for Screenshots directory
    const hasScreenshotsDir = files.some((f) =>
      f.file_path.match(/Screenshots?[\/\\]/i),
    )

    if (hasScreenshotsDir) {
      confidence += 0.15
      indicators.push("Screenshots directory")
    }

    // Check for simple password/cookie files at root
    const hasRootPasswordsFile = files.some(
      (f) =>
        f.file_name.match(/^Passwords?\.txt$/i) &&
        !f.file_path.match(/[\/\\].*[\/\\]/),
    )

    if (hasRootPasswordsFile) {
      confidence += 0.15
      indicators.push("Root-level Passwords.txt")
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
    const autofill: AutofillData[] = []

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

    // Parse grabbed data files (FormBook-specific)
    const grabbedDataFiles = files.filter(
      (f) =>
        !f.is_directory &&
        (f.file_name.match(/Grabbed.*Data\.txt$/i) ||
          f.file_name.match(/FormBook.*Data\.txt$/i)),
    )

    for (const file of grabbedDataFiles) {
      if (!file.content) continue

      // FormBook grabbed data is often in simple format
      // Try to parse as passwords
      const creds = parsePasswordFile(file.content, file.file_path)
      credentials.push(...creds)

      // Also try to extract autofill data
      const lines = file.content.split("\n")
      for (const line of lines) {
        const match = line.match(/^(.+?):\s*(.+)$/)
        if (match && !line.match(/url|username|password/i)) {
          // Autofill data (not password fields)
          autofill.push({
            field_name: match[1].trim(),
            field_value: match[2].trim(),
            browser: "Unknown",
            file_path: file.file_path,
          })
        }
      }
    }

    // Parse cookies
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

    // Extract metadata from System_Info.txt
    const systemInfoFile = files.find((f) =>
      f.file_name.match(/System_Info\.txt$/i),
    )
    let stealerVersion: string | undefined
    let buildId: string | undefined

    if (systemInfoFile?.content) {
      const versionMatch = systemInfoFile.content.match(/FormBook\s+v?([\d.]+)/i)
      const buildMatch = systemInfoFile.content.match(/Build:\s*(.+)/i)

      if (versionMatch) stealerVersion = versionMatch[1]
      if (buildMatch) buildId = buildMatch[1].trim()
    }

    const detection = this.canParse(files)

    return {
      metadata: {
        stealer_family: StealerFamily.FORMBOOK,
        stealer_version: stealerVersion,
        build_id: buildId,
        detection_confidence: detection.confidence,
        indicators: [
          "Grabbed_Data.txt",
          "System_Info.txt",
          "Screenshots directory",
          "Simple root-level structure",
        ],
      },
      credentials,
      cookies,
      extensions: [],
      autofill,
      credit_cards: [],
      crypto_wallets: [],
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
