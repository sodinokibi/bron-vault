/**
 * 2FA / Authenticator Data Extraction
 *
 * Extracts 2FA secrets, backup codes, and authenticator data from:
 * - Authy Desktop
 * - Google Authenticator exports
 * - Microsoft Authenticator
 * - Browser 2FA extensions
 * - Text files with backup codes
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import path from "path"

/**
 * Authenticator data interface
 */
export interface AuthenticatorData {
  app_type: "authy" | "google_authenticator" | "microsoft_authenticator" | "browser_extension" | "other"
  service_name?: string
  account_name?: string
  secret_key?: string
  backup_codes?: string[]
  qr_code_path?: string
  file_path: string
}

/**
 * Patterns for detecting 2FA secrets
 */
const SECRET_PATTERNS = {
  // TOTP secrets are typically base32 encoded (A-Z, 2-7)
  TOTP_SECRET: /[A-Z2-7]{16,}/g,
  // Backup codes patterns
  BACKUP_CODE: /\b[A-Z0-9]{4,6}[-\s][A-Z0-9]{4,6}\b/gi,
  // QR code data
  OTPAUTH: /otpauth:\/\/totp\/[^\s"']+/gi,
}

/**
 * Known 2FA service names from common patterns
 */
const COMMON_SERVICES = [
  "google",
  "microsoft",
  "amazon",
  "facebook",
  "twitter",
  "github",
  "gitlab",
  "steam",
  "discord",
  "binance",
  "coinbase",
  "kraken",
  "paypal",
  "stripe",
  "aws",
  "azure",
  "cloudflare",
]

/**
 * Parse Authy Desktop data
 */
export function parseAuthyDesktop(authyPath: string): AuthenticatorData[] {
  const data: AuthenticatorData[] = []

  try {
    // Authy Desktop stores data in User Data directory
    const userDataPath = path.join(authyPath, "User Data")
    if (!existsSync(userDataPath)) return []

    // Look for Authy database files (JSON)
    const searchPaths = [
      path.join(authyPath, "Authy Desktop.json"),
      path.join(userDataPath, "authy.json"),
      path.join(userDataPath, "Default", "databases"),
    ]

    for (const searchPath of searchPaths) {
      if (!existsSync(searchPath)) continue

      try {
        if (statSync(searchPath).isFile()) {
          const content = readFileSync(searchPath, "utf-8")

          // Try to parse as JSON
          try {
            const json = JSON.parse(content)
            // Extract TOTP secrets from various JSON structures
            extractAuthyFromJSON(json, searchPath, data)
          } catch (err) {
            // Not valid JSON or encrypted, try pattern matching
            extractSecretsFromText(content, searchPath, "authy", data)
          }
        } else if (statSync(searchPath).isDirectory()) {
          // Search directory for JSON files
          const files = readdirSync(searchPath)
          for (const file of files) {
            if (file.endsWith(".json")) {
              const filePath = path.join(searchPath, file)
              const content = readFileSync(filePath, "utf-8")
              try {
                const json = JSON.parse(content)
                extractAuthyFromJSON(json, filePath, data)
              } catch (err) {
                extractSecretsFromText(content, filePath, "authy", data)
              }
            }
          }
        }
      } catch (err) {
        // Can't read file/directory
        continue
      }
    }
  } catch (err) {
    // Directory doesn't exist
  }

  return data
}

/**
 * Extract Authy data from JSON structure
 */
function extractAuthyFromJSON(
  json: any,
  filePath: string,
  data: AuthenticatorData[],
): void {
  // Recursively search for TOTP secrets in JSON
  function search(obj: any, serviceName?: string) {
    if (typeof obj !== "object" || obj === null) return

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()

      // Check for secret keys
      if (
        (lowerKey.includes("secret") || lowerKey.includes("seed")) &&
        typeof value === "string" &&
        /^[A-Z2-7]{16,}$/.test(value)
      ) {
        data.push({
          app_type: "authy",
          service_name: serviceName || "Unknown",
          secret_key: value,
          file_path: filePath,
        })
      }

      // Check for service names
      if (lowerKey.includes("name") || lowerKey.includes("issuer")) {
        if (typeof value === "string") {
          serviceName = value
        }
      }

      // Recurse
      if (typeof value === "object") {
        search(value, serviceName)
      }
    }
  }

  search(json)
}

/**
 * Extract secrets from text content using patterns
 */
function extractSecretsFromText(
  content: string,
  filePath: string,
  appType: AuthenticatorData["app_type"],
  data: AuthenticatorData[],
): void {
  // Extract TOTP secrets
  const secrets = content.match(SECRET_PATTERNS.TOTP_SECRET)
  if (secrets) {
    for (const secret of secrets) {
      // Find service name near secret
      let serviceName: string | undefined
      const secretIndex = content.indexOf(secret)
      const contextBefore = content.substring(Math.max(0, secretIndex - 100), secretIndex)
      const contextAfter = content.substring(secretIndex, secretIndex + 100)
      const context = contextBefore + contextAfter

      for (const service of COMMON_SERVICES) {
        if (context.toLowerCase().includes(service)) {
          serviceName = service
          break
        }
      }

      data.push({
        app_type: appType,
        service_name: serviceName,
        secret_key: secret,
        file_path: filePath,
      })
    }
  }

  // Extract otpauth URIs
  const otpauths = content.match(SECRET_PATTERNS.OTPAUTH)
  if (otpauths) {
    for (const uri of otpauths) {
      try {
        const url = new URL(uri)
        const pathParts = url.pathname.split("/")
        const serviceName = pathParts[pathParts.length - 1]?.split(":")[0]
        const secret = url.searchParams.get("secret")

        if (secret) {
          data.push({
            app_type: appType,
            service_name: serviceName || "Unknown",
            secret_key: secret,
            file_path: filePath,
          })
        }
      } catch (err) {
        // Invalid URI
      }
    }
  }

  // Extract backup codes
  const backupCodes = content.match(SECRET_PATTERNS.BACKUP_CODE)
  if (backupCodes && backupCodes.length > 0) {
    data.push({
      app_type: appType,
      backup_codes: backupCodes,
      file_path: filePath,
    })
  }
}

/**
 * Find and parse backup code text files
 */
export function parseBackupCodes(rootPath: string): AuthenticatorData[] {
  const data: AuthenticatorData[] = []

  function search(currentPath: string, depth: number = 0) {
    if (depth > 10) return

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isFile()) {
          const lowerName = entry.name.toLowerCase()

          // Look for files that might contain backup codes
          if (
            lowerName.includes("backup") ||
            lowerName.includes("recovery") ||
            lowerName.includes("codes") ||
            lowerName.includes("2fa") ||
            lowerName.includes("mfa")
          ) {
            try {
              const content = readFileSync(fullPath, "utf-8")
              extractSecretsFromText(content, fullPath, "other", data)
            } catch (err) {
              // Can't read file
            }
          }
        } else if (entry.isDirectory()) {
          search(fullPath, depth + 1)
        }
      }
    } catch (err) {
      // Can't read directory
    }
  }

  search(rootPath)
  return data
}

/**
 * Find Authy Desktop installations
 */
export function findAuthyDesktop(rootPath: string): string[] {
  const authyPaths: string[] = []

  function search(currentPath: string, depth: number = 0) {
    if (depth > 10) return

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const fullPath = path.join(currentPath, entry.name)
        const lowerName = entry.name.toLowerCase()

        if (lowerName.includes("authy")) {
          authyPaths.push(fullPath)
        }

        search(fullPath, depth + 1)
      }
    } catch (err) {
      // Can't read directory
    }
  }

  search(rootPath)
  return authyPaths
}

/**
 * Parse all authenticator data from stealer log
 */
export function parseAllAuthenticatorData(logDirectory: string): AuthenticatorData[] {
  const allData: AuthenticatorData[] = []

  // Find and parse Authy Desktop
  const authyPaths = findAuthyDesktop(logDirectory)
  for (const authyPath of authyPaths) {
    const authyData = parseAuthyDesktop(authyPath)
    allData.push(...authyData)
  }

  // Find and parse backup code files
  const backupCodes = parseBackupCodes(logDirectory)
  allData.push(...backupCodes)

  return allData
}
