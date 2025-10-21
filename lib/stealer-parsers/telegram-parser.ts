/**
 * Telegram Session Extraction
 *
 * Detects and extracts Telegram session data (tdata folders) from stealer logs.
 * Telegram Desktop stores sessions in the "tdata" folder with encrypted files.
 */

import { readdirSync, statSync, existsSync } from "fs"
import path from "path"

/**
 * Telegram session information
 */
export interface TelegramSession {
  tdata_path: string
  has_key_data: boolean
  has_user_data: boolean
  has_map_files: boolean
  session_type: "desktop" | "portable" | "unknown"
  session_files: string[]
  file_count: number
  total_size: number
  original_path: string
}

/**
 * Telegram session file patterns
 */
const TELEGRAM_FILES = {
  KEY_DATA: ["key_data", "key_datas"],
  MAP_FILES: ["map0", "map1", "map2", "maps"],
  SETTINGS: ["settings0", "settings1", "settingss"],
  USER_TAG: ["usertag", "usertag0"],
  // Telegram session files are often named with hex patterns
  DATA_FILES: /^[A-F0-9]{16}$/i, // 16 hex chars
}

/**
 * Check if a directory is a valid Telegram tdata folder
 */
export function isTelegramTdata(directoryPath: string): boolean {
  try {
    const stat = statSync(directoryPath)
    if (!stat.isDirectory()) return false

    // Check for key_data file (most important indicator)
    const hasKeyData = TELEGRAM_FILES.KEY_DATA.some((filename) =>
      existsSync(path.join(directoryPath, filename)),
    )

    if (hasKeyData) return true

    // Alternative: Check for multiple map files or hex-named data files
    const files = readdirSync(directoryPath)
    const hasMapFiles = TELEGRAM_FILES.MAP_FILES.some((filename) =>
      files.includes(filename),
    )
    const hasDataFiles = files.some((f) => TELEGRAM_FILES.DATA_FILES.test(f))

    return hasMapFiles && hasDataFiles
  } catch (err) {
    return false
  }
}

/**
 * Parse Telegram tdata folder and extract session information
 */
export function parseTelegramTdata(
  tdataPath: string,
  originalPath: string,
): TelegramSession | null {
  if (!isTelegramTdata(tdataPath)) {
    return null
  }

  try {
    const files = readdirSync(tdataPath)
    const sessionFiles: string[] = []
    let totalSize = 0

    // Check for key_data files
    const hasKeyData = TELEGRAM_FILES.KEY_DATA.some((filename) => {
      if (files.includes(filename)) {
        sessionFiles.push(filename)
        try {
          const filePath = path.join(tdataPath, filename)
          totalSize += statSync(filePath).size
        } catch (err) {
          // Ignore
        }
        return true
      }
      return false
    })

    // Check for map files
    const hasMapFiles = TELEGRAM_FILES.MAP_FILES.some((filename) => {
      if (files.includes(filename)) {
        sessionFiles.push(filename)
        try {
          const filePath = path.join(tdataPath, filename)
          totalSize += statSync(filePath).size
        } catch (err) {
          // Ignore
        }
        return true
      }
      return false
    })

    // Check for settings files
    TELEGRAM_FILES.SETTINGS.forEach((filename) => {
      if (files.includes(filename)) {
        sessionFiles.push(filename)
        try {
          const filePath = path.join(tdataPath, filename)
          totalSize += statSync(filePath).size
        } catch (err) {
          // Ignore
        }
      }
    })

    // Check for user tag
    TELEGRAM_FILES.USER_TAG.forEach((filename) => {
      if (files.includes(filename)) {
        sessionFiles.push(filename)
        try {
          const filePath = path.join(tdataPath, filename)
          totalSize += statSync(filePath).size
        } catch (err) {
          // Ignore
        }
      }
    })

    // Check for hex-named data files (session data)
    let hasUserData = false
    for (const file of files) {
      if (TELEGRAM_FILES.DATA_FILES.test(file)) {
        sessionFiles.push(file)
        hasUserData = true
        try {
          const filePath = path.join(tdataPath, file)
          totalSize += statSync(filePath).size
        } catch (err) {
          // Ignore
        }
      }
    }

    // Determine session type
    let sessionType: TelegramSession["session_type"] = "unknown"
    const lowerPath = tdataPath.toLowerCase()
    if (lowerPath.includes("telegram desktop")) {
      sessionType = "desktop"
    } else if (lowerPath.includes("portable")) {
      sessionType = "portable"
    } else {
      // Default to desktop if has proper structure
      sessionType = hasKeyData ? "desktop" : "unknown"
    }

    return {
      tdata_path: tdataPath,
      has_key_data: hasKeyData,
      has_user_data: hasUserData,
      has_map_files: hasMapFiles,
      session_type: sessionType,
      session_files: sessionFiles,
      file_count: sessionFiles.length,
      total_size: totalSize,
      original_path: originalPath,
    }
  } catch (err) {
    return null
  }
}

/**
 * Find all Telegram tdata directories in a stealer log
 */
export function findTelegramTdataDirs(rootPath: string): string[] {
  const tdataDirs: string[] = []

  function search(currentPath: string, depth: number = 0) {
    // Limit recursion depth
    if (depth > 10) return

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory()) continue

        const fullPath = path.join(currentPath, entry.name)
        const lowerName = entry.name.toLowerCase()

        // Check if this is a tdata directory
        if (lowerName === "tdata") {
          if (isTelegramTdata(fullPath)) {
            tdataDirs.push(fullPath)
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
  return tdataDirs
}

/**
 * Parse all Telegram sessions from a stealer log directory
 */
export function parseAllTelegramSessions(logDirectory: string): TelegramSession[] {
  const sessions: TelegramSession[] = []

  // Find all tdata directories
  const tdataDirs = findTelegramTdataDirs(logDirectory)

  // Parse each tdata directory
  for (const dir of tdataDirs) {
    const session = parseTelegramTdata(dir, dir)
    if (session) {
      sessions.push(session)
    }
  }

  return sessions
}

/**
 * Get summary statistics for Telegram sessions
 */
export function getTelegramSessionStats(sessions: TelegramSession[]): {
  total_sessions: number
  with_key_data: number
  with_user_data: number
  desktop_sessions: number
  portable_sessions: number
  total_size: number
  avg_files_per_session: number
} {
  return {
    total_sessions: sessions.length,
    with_key_data: sessions.filter((s) => s.has_key_data).length,
    with_user_data: sessions.filter((s) => s.has_user_data).length,
    desktop_sessions: sessions.filter((s) => s.session_type === "desktop").length,
    portable_sessions: sessions.filter((s) => s.session_type === "portable").length,
    total_size: sessions.reduce((sum, s) => sum + s.total_size, 0),
    avg_files_per_session:
      sessions.length > 0
        ? sessions.reduce((sum, s) => sum + s.file_count, 0) / sessions.length
        : 0,
  }
}
