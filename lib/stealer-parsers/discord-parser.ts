/**
 * Discord Token Extraction
 *
 * Extracts Discord tokens from leveldb files commonly found in stealer logs.
 * Supports Desktop Discord, Discord PTB, Discord Canary, and browser-based Discord.
 */

import { readFileSync, readdirSync, statSync } from "fs"
import path from "path"

/**
 * Discord token information
 */
export interface DiscordToken {
  token: string
  token_type: "discord" | "discord_ptb" | "discord_canary" | "browser" | "unknown"
  user_id?: string
  username?: string
  email?: string
  phone?: string
  mfa_enabled?: boolean
  verified?: boolean
  file_path: string
  source_application?: string
}

/**
 * Discord token patterns
 */
const DISCORD_TOKEN_PATTERNS = [
  // New Discord token format (after 2023)
  /[\w-]{24,26}\.[\w-]{6,7}\.[\w-]{27,}/g,
  // Old Discord token format
  /mfa\.[\w-]{84}/g,
  // Mobile/alternate format
  /[\w-]{24}\.[\w-]{6}\.[\w-]{38}/g,
]

/**
 * Discord application paths to search
 */
const DISCORD_PATHS = [
  "discord",
  "discordptb",
  "discordcanary",
  "discorddevelopment",
  "lightcord",
  "discordapp.com",
  "discord.com",
]

/**
 * Extract Discord tokens from leveldb file content
 */
export function extractDiscordTokens(
  content: string,
  filePath: string,
  sourceApp: string = "unknown",
): DiscordToken[] {
  const tokens: DiscordToken[] = []
  const foundTokens = new Set<string>()

  // Try all token patterns
  for (const pattern of DISCORD_TOKEN_PATTERNS) {
    const matches = content.match(pattern)
    if (matches) {
      for (const token of matches) {
        // Skip if already found
        if (foundTokens.has(token)) continue
        foundTokens.add(token)

        // Determine token type
        let tokenType: DiscordToken["token_type"] = "unknown"
        const lowerPath = filePath.toLowerCase()
        const lowerSource = sourceApp.toLowerCase()

        if (lowerPath.includes("discordptb") || lowerSource.includes("ptb")) {
          tokenType = "discord_ptb"
        } else if (
          lowerPath.includes("discordcanary") ||
          lowerSource.includes("canary")
        ) {
          tokenType = "discord_canary"
        } else if (
          lowerPath.includes("discord") ||
          lowerSource.includes("discord")
        ) {
          tokenType = "discord"
        } else if (
          lowerPath.includes("chrome") ||
          lowerPath.includes("firefox") ||
          lowerPath.includes("browser")
        ) {
          tokenType = "browser"
        }

        // Try to extract user ID from token
        let userId: string | undefined
        try {
          // Discord tokens: base64_user_id.timestamp.hmac
          const parts = token.split(".")
          if (parts.length >= 2) {
            // Decode the first part (user ID)
            const decoded = Buffer.from(parts[0], "base64").toString("utf-8")
            if (/^\d+$/.test(decoded)) {
              userId = decoded
            }
          }
        } catch (err) {
          // Token format might be different, skip user ID extraction
        }

        tokens.push({
          token,
          token_type: tokenType,
          user_id: userId,
          file_path: filePath,
          source_application: sourceApp,
        })
      }
    }
  }

  return tokens
}

/**
 * Parse Discord leveldb files from a directory
 */
export function parseDiscordLevelDB(directoryPath: string, originalPath: string): DiscordToken[] {
  const tokens: DiscordToken[] = []

  try {
    // Determine source application from path
    let sourceApp = "unknown"
    const lowerPath = directoryPath.toLowerCase()
    for (const discordPath of DISCORD_PATHS) {
      if (lowerPath.includes(discordPath)) {
        sourceApp = discordPath
        break
      }
    }

    // Read all files in directory
    const files = readdirSync(directoryPath)

    for (const file of files) {
      const filePath = path.join(directoryPath, file)

      try {
        const stat = statSync(filePath)
        if (!stat.isFile()) continue

        // Only process leveldb files (typically .log or .ldb files)
        if (!file.endsWith(".log") && !file.endsWith(".ldb")) continue

        // Read file content as binary then convert to string
        const buffer = readFileSync(filePath)
        const content = buffer.toString("utf-8", 0, Math.min(buffer.length, 1024 * 1024)) // Limit to 1MB

        // Extract tokens
        const extracted = extractDiscordTokens(content, originalPath, sourceApp)
        tokens.push(...extracted)
      } catch (err) {
        // Skip files that can't be read
        continue
      }
    }
  } catch (err) {
    // Directory doesn't exist or can't be read
    return []
  }

  // Remove duplicates based on token value
  const uniqueTokens = new Map<string, DiscordToken>()
  for (const token of tokens) {
    if (!uniqueTokens.has(token.token)) {
      uniqueTokens.set(token.token, token)
    }
  }

  return Array.from(uniqueTokens.values())
}

/**
 * Search for Discord leveldb directories in stealer log structure
 */
export function findDiscordLevelDBDirs(rootPath: string): string[] {
  const dirs: string[] = []

  const searchPatterns = [
    "**/discord/Local Storage/leveldb",
    "**/discordptb/Local Storage/leveldb",
    "**/discordcanary/Local Storage/leveldb",
    "**/discord.com/Local Storage/leveldb",
    "**/discordapp.com/Local Storage/leveldb",
  ]

  // Recursively search for Discord directories
  function search(currentPath: string, depth: number = 0) {
    // Limit recursion depth
    if (depth > 10) return

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const fullPath = path.join(currentPath, entry.name)
        const lowerName = entry.name.toLowerCase()

        // Check if this is a Discord directory
        if (DISCORD_PATHS.some((dp) => lowerName.includes(dp))) {
          // Look for Local Storage/leveldb
          const leveldbPath = path.join(fullPath, "Local Storage", "leveldb")
          try {
            const stat = statSync(leveldbPath)
            if (stat.isDirectory()) {
              dirs.push(leveldbPath)
            }
          } catch (err) {
            // leveldb directory doesn't exist, continue searching
          }
        }

        // Continue recursive search
        search(fullPath, depth + 1)
      }
    } catch (err) {
      // Can't read directory, skip
    }
  }

  search(rootPath)
  return dirs
}

/**
 * Parse all Discord tokens from a stealer log directory
 */
export function parseAllDiscordTokens(logDirectory: string): DiscordToken[] {
  const allTokens: DiscordToken[] = []

  // Find all Discord leveldb directories
  const leveldbDirs = findDiscordLevelDBDirs(logDirectory)

  // Parse tokens from each directory
  for (const dir of leveldbDirs) {
    const tokens = parseDiscordLevelDB(dir, dir)
    allTokens.push(...tokens)
  }

  // Remove duplicates
  const uniqueTokens = new Map<string, DiscordToken>()
  for (const token of allTokens) {
    if (!uniqueTokens.has(token.token)) {
      uniqueTokens.set(token.token, token)
    }
  }

  return Array.from(uniqueTokens.values())
}
