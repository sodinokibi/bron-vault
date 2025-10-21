/**
 * Firefox SQLite Parser
 *
 * Parses Firefox-specific SQLite databases
 * Firefox uses completely different schemas than Chrome/Chromium
 *
 * Firefox Databases:
 * - places.sqlite: History, bookmarks, downloads (all in one!)
 * - cookies.sqlite: Cookies (different schema than Chrome)
 * - formhistory.sqlite: Autofill data
 * - logins.json: Passwords (JSON, not SQLite!)
 * - extensions.json: Installed extensions (JSON)
 */

import Database from "better-sqlite3"
import { existsSync } from "fs"
import type {
  Cookie,
  BrowserHistory,
  Download,
  Bookmark,
  AutofillData,
  Credential,
  BrowserExtension,
} from "./types"
import { detectBrowser, extractProfile } from "./utils"

/**
 * Parse Firefox places.sqlite database
 * Contains history, bookmarks, and downloads all in one database!
 *
 * Tables:
 * - moz_places: URLs with titles
 * - moz_historyvisits: Visit timestamps
 * - moz_bookmarks: Bookmarks with folders
 * - moz_annos: Annotations (metadata)
 */
export function parseFirefoxPlaces(
  filePath: string,
  originalPath: string,
): {
  history: BrowserHistory[]
  bookmarks: Bookmark[]
  downloads: Download[]
} {
  if (!existsSync(filePath)) {
    return { history: [], bookmarks: [], downloads: [] }
  }

  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true })

    const browser = detectBrowser(originalPath)
    const profile = extractProfile(originalPath)

    // Parse history
    const history = parseFirefoxHistory(db, browser, profile, originalPath)

    // Parse bookmarks
    const bookmarks = parseFirefoxBookmarks(db, browser, profile, originalPath)

    // Parse downloads (stored as annotations in places.sqlite)
    const downloads = parseFirefoxDownloads(db, browser, profile, originalPath)

    db.close()

    return { history, bookmarks, downloads }
  } catch (error) {
    console.error(`Failed to parse Firefox places.sqlite from ${filePath}:`, error)
    return { history: [], bookmarks: [], downloads: [] }
  }
}

/**
 * Parse Firefox history from places.sqlite
 */
function parseFirefoxHistory(
  db: Database.Database,
  browser: string,
  profile: string | undefined,
  originalPath: string,
): BrowserHistory[] {
  try {
    // Firefox stores history in moz_places + moz_historyvisits
    // We join them to get visit counts and last visit time
    const rows = db
      .prepare(
        `
      SELECT
        p.url,
        p.title,
        COUNT(v.id) as visit_count,
        MAX(v.visit_date) as last_visit_time
      FROM moz_places p
      LEFT JOIN moz_historyvisits v ON v.place_id = p.id
      WHERE p.url IS NOT NULL
      GROUP BY p.id
      ORDER BY visit_count DESC
      LIMIT 5000
    `,
      )
      .all() as any[]

    return rows.map((row) => ({
      url: row.url || "",
      title: row.title || undefined,
      visit_count: row.visit_count || 1,
      last_visit_time: row.last_visit_time || 0, // Firefox uses microseconds
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error("Failed to parse Firefox history:", error)
    return []
  }
}

/**
 * Parse Firefox bookmarks from places.sqlite
 */
function parseFirefoxBookmarks(
  db: Database.Database,
  browser: string,
  profile: string | undefined,
  originalPath: string,
): Bookmark[] {
  try {
    // Firefox bookmarks are in moz_bookmarks + moz_places
    // Type 1 = bookmark (not folder, separator, etc.)
    const rows = db
      .prepare(
        `
      SELECT
        p.url,
        b.title,
        b.dateAdded,
        b.parent,
        b.position
      FROM moz_bookmarks b
      JOIN moz_places p ON b.fk = p.id
      WHERE b.type = 1
      AND p.url IS NOT NULL
      ORDER BY b.dateAdded DESC
      LIMIT 2000
    `,
      )
      .all() as any[]

    return rows.map((row) => ({
      url: row.url || "",
      title: row.title || undefined,
      date_added: row.dateAdded || undefined, // Firefox uses microseconds
      folder: undefined, // TODO: Could map parent to folder name
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error("Failed to parse Firefox bookmarks:", error)
    return []
  }
}

/**
 * Parse Firefox downloads from places.sqlite
 * Downloads are stored as annotations in Firefox
 */
function parseFirefoxDownloads(
  db: Database.Database,
  browser: string,
  profile: string | undefined,
  originalPath: string,
): Download[] {
  try {
    // Check if moz_annos table exists (it should in places.sqlite)
    const tableCheck = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='moz_annos'",
      )
      .get()

    if (!tableCheck) {
      return []
    }

    // Firefox downloads are marked with specific annotations
    // We look for "downloads/destinationFileURI" annotations
    const rows = db
      .prepare(
        `
      SELECT
        p.url,
        a.content,
        p.title
      FROM moz_annos a
      JOIN moz_places p ON a.place_id = p.id
      WHERE a.anno_attribute_id IN (
        SELECT id FROM moz_anno_attributes
        WHERE name LIKE '%download%' OR name LIKE '%file%'
      )
      LIMIT 1000
    `,
      )
      .all() as any[]

    return rows.map((row) => ({
      url: row.url || "",
      file_path: row.content || undefined,
      file_name: row.content ? row.content.split(/[/\\]/).pop() : undefined,
      browser,
      profile,
      source_file: originalPath,
    }))
  } catch (error) {
    console.error("Failed to parse Firefox downloads:", error)
    return []
  }
}

/**
 * Parse Firefox cookies.sqlite database
 * Schema is completely different from Chrome!
 *
 * Table: moz_cookies
 * Columns: host, name, value, path, expiry, isSecure, isHttpOnly, sameSite
 */
export function parseFirefoxCookies(
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
        host,
        name,
        value,
        path,
        expiry,
        isSecure,
        isHttpOnly,
        sameSite
      FROM moz_cookies
      LIMIT 10000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => ({
      host_key: row.host || "",
      name: row.name || "",
      value: row.value || "",
      path: row.path || "/",
      expires_utc: row.expiry ? row.expiry * 1000000 : 0, // Convert to microseconds
      is_secure: row.isSecure === 1,
      is_httponly: row.isHttpOnly === 1,
      same_site: getFirefoxSameSiteString(row.sameSite),
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error(`Failed to parse Firefox cookies from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Firefox formhistory.sqlite database
 * Contains autofill data
 *
 * Table: moz_formhistory
 * Columns: fieldname, value, timesUsed
 */
export function parseFirefoxFormHistory(
  filePath: string,
  originalPath: string,
): AutofillData[] {
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
        fieldname,
        value,
        timesUsed
      FROM moz_formhistory
      ORDER BY timesUsed DESC
      LIMIT 2000
    `,
      )
      .all() as any[]

    db.close()

    return rows.map((row) => ({
      field_name: row.fieldname || "",
      field_value: row.value || "",
      times_used: row.timesUsed || 0,
      browser,
      profile,
      file_path: originalPath,
    }))
  } catch (error) {
    console.error(
      `Failed to parse Firefox formhistory from ${filePath}:`,
      error,
    )
    return []
  }
}

/**
 * Parse Firefox logins.json file
 * Contains encrypted passwords
 *
 * Format:
 * {
 *   "logins": [
 *     {
 *       "hostname": "https://example.com",
 *       "httpRealm": null,
 *       "formSubmitURL": "https://example.com/login",
 *       "usernameField": "username",
 *       "passwordField": "password",
 *       "encryptedUsername": "...",
 *       "encryptedPassword": "...",
 *       "guid": "...",
 *       "encType": 1,
 *       "timeCreated": 1234567890,
 *       "timeLastUsed": 1234567890,
 *       "timePasswordChanged": 1234567890,
 *       "timesUsed": 5
 *     }
 *   ]
 * }
 */
export function parseFirefoxLogins(
  content: string,
  filePath: string,
): Credential[] {
  try {
    const data = JSON.parse(content)
    const browser = detectBrowser(filePath)
    const profile = extractProfile(filePath)

    if (!data.logins || !Array.isArray(data.logins)) {
      return []
    }

    return data.logins.map((login: any) => ({
      url: login.hostname || login.formSubmitURL || "",
      domain: extractDomainFromURL(login.hostname || ""),
      tld: extractTLDFromURL(login.hostname || ""),
      username: login.encryptedUsername || "", // Still encrypted!
      password: login.encryptedPassword || "", // Still encrypted!
      browser,
      file_path: filePath,
    }))
  } catch (error) {
    console.error(`Failed to parse Firefox logins from ${filePath}:`, error)
    return []
  }
}

/**
 * Parse Firefox extensions.json file
 * Contains installed extensions
 *
 * Format:
 * {
 *   "addons": [
 *     {
 *       "id": "addon@example.com",
 *       "name": "Extension Name",
 *       "version": "1.0.0",
 *       "type": "extension",
 *       ...
 *     }
 *   ]
 * }
 */
export function parseFirefoxExtensions(
  content: string,
  filePath: string,
): BrowserExtension[] {
  try {
    const data = JSON.parse(content)
    const browser = detectBrowser(filePath)
    const profile = extractProfile(filePath)

    if (!data.addons || !Array.isArray(data.addons)) {
      return []
    }

    return data.addons
      .filter((addon: any) => addon.type === "extension")
      .map((addon: any) => ({
        extension_id: addon.id || "unknown",
        extension_name: addon.name || "Unknown Extension",
        extension_type: categorizeFirefoxExtension(addon),
        version: addon.version,
        browser,
        profile,
        data: addon,
        file_path: filePath,
      }))
  } catch (error) {
    console.error(
      `Failed to parse Firefox extensions from ${filePath}:`,
      error,
    )
    return []
  }
}

/**
 * Auto-detect and parse Firefox databases
 */
export function parseFirefoxDatabase(filePath: string, fileName: string) {
  const lowerName = fileName.toLowerCase()

  const result = {
    history: [] as BrowserHistory[],
    bookmarks: [] as Bookmark[],
    downloads: [] as Download[],
    cookies: [] as Cookie[],
    autofill: [] as AutofillData[],
  }

  // Parse places.sqlite (history, bookmarks, downloads)
  if (lowerName === "places.sqlite") {
    const parsed = parseFirefoxPlaces(filePath, filePath)
    result.history = parsed.history
    result.bookmarks = parsed.bookmarks
    result.downloads = parsed.downloads
  }

  // Parse cookies.sqlite
  if (lowerName === "cookies.sqlite") {
    result.cookies = parseFirefoxCookies(filePath, filePath)
  }

  // Parse formhistory.sqlite
  if (lowerName === "formhistory.sqlite") {
    result.autofill = parseFirefoxFormHistory(filePath, filePath)
  }

  return result
}

/**
 * Check if file is a Firefox database
 */
export function isFirefoxDatabase(fileName: string): boolean {
  const lowerName = fileName.toLowerCase()

  return [
    "places.sqlite",
    "cookies.sqlite",
    "formhistory.sqlite",
    "logins.json",
    "extensions.json",
    "key4.db",
    "key3.db",
  ].includes(lowerName)
}

// Helper functions

function getFirefoxSameSiteString(value: number): string | undefined {
  // Firefox SameSite values:
  // 0 = None, 1 = Lax, 2 = Strict
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

function extractDomainFromURL(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

function extractTLDFromURL(url: string): string {
  try {
    const parsed = new URL(url)
    const parts = parsed.hostname.split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
  } catch {
    return ""
  }
}

function categorizeFirefoxExtension(addon: any): string {
  const name = (addon.name || "").toLowerCase()
  const description = (addon.description || "").toLowerCase()

  if (
    name.includes("metamask") ||
    name.includes("wallet") ||
    name.includes("crypto")
  ) {
    return "Crypto"
  }
  if (name.includes("authenticator") || name.includes("2fa")) {
    return "Authenticator"
  }
  if (name.includes("password")) {
    return "PasswordManager"
  }
  if (name.includes("adblock") || name.includes("privacy")) {
    return "Privacy"
  }

  return "Unknown"
}
