/**
 * Stealer Parser Utilities
 *
 * Common utility functions for parsing stealer logs
 */

import crypto from "crypto"
import {
  type ParsedFile,
  type Credential,
  BROWSER_PATHS,
  FILE_PATTERNS,
} from "./types"

/**
 * Extract domain and TLD from URL
 */
export function extractDomain(url: string): { domain: string; tld: string } {
  try {
    // Handle URLs without protocol
    let urlToParse = url
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      urlToParse = `https://${url}`
    }

    const parsedUrl = new URL(urlToParse)
    const hostname = parsedUrl.hostname

    // Extract TLD
    const parts = hostname.split(".")
    const tld = parts.length > 1 ? parts[parts.length - 1] : ""

    return { domain: hostname, tld }
  } catch {
    // If URL parsing fails, try to extract domain manually
    const match = url.match(/([a-z0-9-]+\.[a-z]{2,})/i)
    if (match) {
      const domain = match[1]
      const parts = domain.split(".")
      const tld = parts[parts.length - 1]
      return { domain, tld }
    }

    return { domain: url, tld: "" }
  }
}

/**
 * Detect browser from file path
 */
export function detectBrowser(filePath: string): string {
  const pathLower = filePath.toLowerCase()

  for (const [browser, patterns] of Object.entries(BROWSER_PATHS)) {
    for (const pattern of patterns) {
      if (pathLower.includes(pattern.toLowerCase())) {
        return browser
      }
    }
  }

  return "Unknown"
}

/**
 * Extract profile name from browser path
 * e.g., "Chrome/User Data/Profile 1" -> "Profile 1"
 */
export function extractProfile(filePath: string): string | undefined {
  const profileMatch = filePath.match(
    /(?:Profile \d+|Default|Guest Profile)/i,
  )
  return profileMatch ? profileMatch[0] : undefined
}

/**
 * Parse generic password file
 * Supports multiple formats:
 * - URL: ... Username: ... Password: ... (most common)
 * - URL\nUsername\nPassword (line-separated)
 * - url|username|password (pipe-separated)
 * - url,username,password (comma-separated)
 */
export function parsePasswordFile(
  content: string,
  filePath: string,
): Credential[] {
  const credentials: Credential[] = []
  const browser = detectBrowser(filePath)

  // Split by common separators (multiple newlines, dashes, etc.)
  const blocks = content.split(/\n{2,}|[-=]{3,}\n/)

  for (const block of blocks) {
    const lines = block.trim().split("\n")

    // Try format 1: "URL: ... Username: ... Password: ..."
    let url = ""
    let username = ""
    let password = ""

    for (const line of lines) {
      const trimmed = line.trim()

      const urlMatch = trimmed.match(/^(?:URL|Domain|Site|Host):\s*(.+)$/i)
      const userMatch = trimmed.match(
        /^(?:Username|User|Login|Email):\s*(.+)$/i,
      )
      const passMatch = trimmed.match(/^(?:Password|Pass):\s*(.+)$/i)

      if (urlMatch) url = urlMatch[1].trim()
      if (userMatch) username = userMatch[1].trim()
      if (passMatch) password = passMatch[1].trim()
    }

    // Try format 2: Line-separated (3 lines)
    if (!url && lines.length === 3) {
      ;[url, username, password] = lines.map((l) => l.trim())
    }

    // Try format 3: Pipe or comma separated
    if (!url && lines.length === 1) {
      const parts = lines[0].split(/[|,]/).map((p) => p.trim())
      if (parts.length === 3) {
        ;[url, username, password] = parts
      }
    }

    // Add credential if all fields present
    if (url && username && password) {
      const { domain, tld } = extractDomain(url)

      credentials.push({
        url,
        domain,
        tld,
        username,
        password,
        browser,
        file_path: filePath,
      })
    }
  }

  return credentials
}

/**
 * Parse Netscape-format cookies file
 */
export function parseNetscapeCookies(content: string, filePath: string) {
  const cookies = []
  const browser = detectBrowser(filePath)
  const profile = extractProfile(filePath)

  const lines = content.split("\n")

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || !line.trim()) continue

    const parts = line.split("\t")
    if (parts.length < 7) continue

    const [domain, , path, secure, expiresStr, name, value] = parts

    cookies.push({
      host_key: domain.trim(),
      name: name.trim(),
      value: value.trim(),
      path: path.trim(),
      expires_utc: Number.parseInt(expiresStr.trim()) || 0,
      is_secure: secure.trim().toLowerCase() === "true",
      is_httponly: false,
      browser,
      profile,
      file_path: filePath,
    })
  }

  return cookies
}

/**
 * Parse JSON cookies file
 */
export function parseJSONCookies(content: string, filePath: string) {
  try {
    const data = JSON.parse(content)
    const browser = detectBrowser(filePath)
    const profile = extractProfile(filePath)

    if (Array.isArray(data)) {
      return data.map((cookie) => ({
        host_key: cookie.domain || cookie.host_key || "",
        name: cookie.name || "",
        value: cookie.value || "",
        path: cookie.path || "/",
        expires_utc: cookie.expirationDate || cookie.expires_utc || 0,
        is_secure: cookie.secure || cookie.is_secure || false,
        is_httponly: cookie.httpOnly || cookie.is_httponly || false,
        same_site: cookie.sameSite || cookie.same_site,
        browser,
        profile,
        file_path: filePath,
      }))
    }

    return []
  } catch {
    return []
  }
}

/**
 * Hash device name for deduplication
 */
export function hashDeviceName(deviceName: string): string {
  return crypto.createHash("sha256").update(deviceName.toLowerCase()).digest("hex")
}

/**
 * Find files matching a pattern
 */
export function findFiles(files: ParsedFile[], pattern: RegExp): ParsedFile[] {
  return files.filter((file) => pattern.test(file.file_path))
}

/**
 * Find files matching multiple patterns
 */
export function findFilesByPatterns(
  files: ParsedFile[],
  patterns: RegExp[],
): ParsedFile[] {
  return files.filter((file) =>
    patterns.some((pattern) => pattern.test(file.file_path)),
  )
}

/**
 * Check if directory contains specific files/patterns
 */
export function containsFiles(
  files: ParsedFile[],
  patterns: RegExp[],
): boolean {
  return patterns.some((pattern) =>
    files.some((file) => pattern.test(file.file_path)),
  )
}

/**
 * Extract wallet address from various formats
 */
export function extractWalletAddress(content: string): string | undefined {
  // Ethereum address (0x followed by 40 hex chars)
  const ethMatch = content.match(/0x[a-fA-F0-9]{40}/)
  if (ethMatch) return ethMatch[0]

  // Bitcoin address (26-35 chars, starts with 1, 3, or bc1)
  const btcMatch = content.match(/\b([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,87})\b/)
  if (btcMatch) return btcMatch[0]

  return undefined
}

/**
 * Extract seed phrase (12 or 24 words)
 */
export function extractSeedPhrase(content: string): string | undefined {
  const words = content.toLowerCase().split(/\s+/)

  // Check for common seed phrase lengths (12, 15, 18, 21, 24 words)
  const validLengths = [12, 15, 18, 21, 24]

  if (validLengths.includes(words.length)) {
    // Basic validation: all words should be lowercase alphabetic
    if (words.every((w) => /^[a-z]+$/.test(w))) {
      return words.join(" ")
    }
  }

  return undefined
}

/**
 * Parse Discord token from content
 */
export function extractDiscordToken(content: string): string | undefined {
  const match = content.match(/[\w-]{24}\.[\w-]{6}\.[\w-]{27}/)
  return match ? match[0] : undefined
}

/**
 * Sanitize and normalize text
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "") // Remove control chars
    .replace(/\r\n/g, "\n") // Normalize line endings
    .trim()
}

/**
 * Check if file content is likely binary
 */
export function isBinaryContent(content: string): boolean {
  // Check for null bytes or high percentage of non-printable chars
  const nullBytes = (content.match(/\x00/g) || []).length
  if (nullBytes > 0) return true

  const nonPrintable = content
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0)
      return code < 32 && code !== 9 && code !== 10 && code !== 13
    }).length

  return nonPrintable / content.length > 0.3
}

/**
 * Extract version from file path or content
 */
export function extractVersion(text: string): string | undefined {
  const match = text.match(/v?(\d+\.\d+(?:\.\d+)?(?:\.\d+)?)/i)
  return match ? match[1] : undefined
}

/**
 * Group files by browser profile
 */
export function groupFilesByProfile(files: ParsedFile[]): Map<string, ParsedFile[]> {
  const groups = new Map<string, ParsedFile[]>()

  for (const file of files) {
    const browser = detectBrowser(file.file_path)
    const profile = extractProfile(file.file_path) || "Default"
    const key = `${browser}/${profile}`

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(file)
  }

  return groups
}
