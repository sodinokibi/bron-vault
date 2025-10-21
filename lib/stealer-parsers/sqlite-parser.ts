/**
 * SQLite Database Parser
 *
 * Parses Chrome/Chromium SQLite databases for cookies, history, downloads, and bookmarks
 */

import Database from "better-sqlite3"
import { existsSync } from "fs"
import type {
  Cookie,
  BrowserHistory,
  Download,
  Bookmark,
  ParsedFile,
} from "./types"
import { detectBrowser, extractProfile } from "./utils"

/**
 * Parse Chrome Cookies SQLite database
 * File: Cookies (no extension)
 */
export function parseSQLiteCookies(
  filePath: string,
  originalPath: string,
): Cookie[] {
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true })

    const browser = detectBrowser(originalPath)
    const profile = extractProfile(originalPath)

    const rows = db
      .prepare(
        `
      SELECT
        host_key,
        name,
        value,
        path,
        expires_utc,
        is_secure,
        is_httponly,
        samesite
      FROM cookies
      LIMIT 10000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => ({
      host_key: row.host_key || "",
      name: row.name || "",
      value: row.value || "",
      path: row.path || "/",
      expires_utc: row.expires_utc || 0,
      is_secure: row.is_secure === 1,
      is_httponly: row.is_httponly === 1,
      same_site: getSameSiteString(row.samesite),
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error(`Failed to parse SQLite cookies from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Chrome History SQLite database
 * File: History (no extension)
 */
export function parseSQLiteHistory(
  filePath: string,
  originalPath: string,
): BrowserHistory[] {
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true })

    const browser = detectBrowser(originalPath)
    const profile = extractProfile(originalPath)

    const rows = db
      .prepare(
        `
      SELECT
        url,
        title,
        visit_count,
        last_visit_time
      FROM urls
      ORDER BY visit_count DESC
      LIMIT 5000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => ({
      url: row.url || "",
      title: row.title || undefined,
      visit_count: row.visit_count || 1,
      last_visit_time: row.last_visit_time || 0,
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error(`Failed to parse SQLite history from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Chrome Downloads SQLite database (in History file)
 * File: History (no extension)
 */
export function parseSQLiteDownloads(
  filePath: string,
  originalPath: string,
): Download[] {
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true })

    const browser = detectBrowser(originalPath)
    const profile = extractProfile(originalPath)

    // Check if downloads table exists
    const tableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='downloads'",
      )
      .get()

    if (!tableCheck) {
      db.close()
      return []
    }

    const rows = db
      .prepare(
        `
      SELECT
        current_path,
        target_path,
        tab_url,
        total_bytes,
        start_time,
        end_time,
        state
      FROM downloads
      LIMIT 2000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => {
      const filePath = row.target_path || row.current_path || ""
      const fileName = filePath.split(/[/\\]/).pop() || undefined

      return {
        url: row.tab_url || "",
        file_path: filePath,
        file_name: fileName,
        total_bytes: row.total_bytes || undefined,
        start_time: row.start_time || undefined,
        end_time: row.end_time || undefined,
        state: getDownloadState(row.state),
        browser,
        profile,
        source_file: originalPath,
      }
    })
  } catch (error) {
    console.error(`Failed to parse SQLite downloads from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Chrome Bookmarks JSON file
 * File: Bookmarks (JSON format)
 */
export function parseBookmarksJSON(
  content: string,
  filePath: string,
): Bookmark[] {
  try {
    const data = JSON.parse(content)
    const browser = detectBrowser(filePath)
    const profile = extractProfile(filePath)

    const bookmarks: Bookmark[] = []

    // Recursive function to extract bookmarks from folder structure
    function extractBookmarks(node: any, folder: string = "") {
      if (node.type === "url") {
        bookmarks.push({
          url: node.url || "",
          title: node.name || undefined,
          date_added: node.date_added
            ? Number.parseInt(node.date_added)
            : undefined,
          folder: folder || undefined,
          browser,
          profile,
          file_path: filePath,
        })
      } else if (node.type === "folder" && node.children) {
        const newFolder = folder ? `${folder}/${node.name}` : node.name
        for (const child of node.children) {
          extractBookmarks(child, newFolder)
        }
      }
    }

    // Chrome bookmarks structure
    if (data.roots) {
      for (const rootKey of Object.keys(data.roots)) {
        const root = data.roots[rootKey]
        if (root.children) {
          for (const child of root.children) {
            extractBookmarks(child, rootKey)
          }
        }
      }
    }

    return bookmarks
  } catch (error) {
    console.error(`Failed to parse bookmarks JSON from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Chrome Login Data SQLite database (passwords)
 * File: Login Data (no extension)
 * Note: Values are encrypted on Windows with DPAPI
 */
export function parseSQLiteLogins(filePath: string, originalPath: string) {
  if (!existsSync(filePath)) {
    return []
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true })

    const browser = detectBrowser(originalPath)
    const profile = extractProfile(originalPath)

    const rows = db
      .prepare(
        `
      SELECT
        origin_url,
        username_value,
        password_value,
        date_created,
        times_used
      FROM logins
      LIMIT 5000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => ({
      url: row.origin_url || "",
      username: row.username_value || "",
      password_encrypted: row.password_value, // Binary blob, encrypted
      date_created: row.date_created || 0,
      times_used: row.times_used || 0,
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error(`Failed to parse SQLite logins from ${filePath}:`, error)
    return []
  }
}

/**
 * Auto-detect and parse SQLite database based on file name
 */
export function parseSQLiteDatabase(file: ParsedFile) {
  const fileName = file.file_name.toLowerCase()
  const localPath = file.local_file_path

  if (!localPath) {
    return {
      cookies: [],
      history: [],
      downloads: [],
      bookmarks: [],
      logins: [],
    }
  }

  const result = {
    cookies: [] as Cookie[],
    history: [] as BrowserHistory[],
    downloads: [] as Download[],
    bookmarks: [] as Bookmark[],
    logins: [] as any[],
  }

  // Parse Cookies database
  if (fileName === "cookies" || fileName === "cookies.db") {
    result.cookies = parseSQLiteCookies(localPath, file.file_path)
  }

  // Parse History database (contains both history and downloads)
  if (fileName === "history" || fileName === "history.db") {
    result.history = parseSQLiteHistory(localPath, file.file_path)
    result.downloads = parseSQLiteDownloads(localPath, file.file_path)
  }

  // Parse Bookmarks JSON
  if (fileName === "bookmarks" && file.content) {
    result.bookmarks = parseBookmarksJSON(file.content, file.file_path)
  }

  // Parse Login Data (passwords)
  if (fileName === "login data" || fileName === "logins.json") {
    result.logins = parseSQLiteLogins(localPath, file.file_path)
  }

  return result
}

/**
 * Helper: Convert SameSite integer to string
 */
function getSameSiteString(value: number): string | undefined {
  switch (value) {
    case 0:
      return "no_restriction"
    case 1:
      return "lax"
    case 2:
      return "strict"
    default:
      return undefined
  }
}

/**
 * Helper: Convert download state integer to string
 */
function getDownloadState(state: number): string | undefined {
  switch (state) {
    case 0:
      return "in_progress"
    case 1:
      return "complete"
    case 2:
      return "cancelled"
    case 3:
      return "interrupted"
    case 4:
      return "interrupted"
    default:
      return undefined
  }
}

/**
 * Check if file is a Chrome SQLite database
 */
export function isSQLiteDatabase(file: ParsedFile): boolean {
  const fileName = file.file_name.toLowerCase()

  const sqliteFiles = [
    "cookies",
    "cookies.db",
    "history",
    "history.db",
    "login data",
    "web data",
    "favicons",
    "top sites",
  ]

  return sqliteFiles.includes(fileName)
}
