/**
 * Cookie Session Analyzer
 *
 * Analyzes cookies to detect active logged-in sessions for popular services
 * Identifies high-value authenticated sessions across browsers
 */

import { readFileSync, existsSync, readdirSync } from "fs"
import path from "path"
import Database from "better-sqlite3"

/**
 * Detected session interface
 */
export interface DetectedSession {
  service: string
  service_category: string
  account_identifier?: string // email, username, user_id
  session_valid: boolean
  expires_at?: Date
  cookie_count: number
  has_auth_token: boolean
  security_flags: {
    httponly: boolean
    secure: boolean
    same_site: string | null
  }
  browser: string
  profile: string
  file_path: string
  detected_at: Date
}

/**
 * Service detection patterns
 */
interface ServicePattern {
  name: string
  category: string
  domains: string[]
  auth_cookies: string[] // Cookie names that indicate authentication
  identifier_cookies?: { name: string; extract?: (value: string) => string }[] // Cookies that contain user identifiers
  high_value: boolean
}

const SERVICE_PATTERNS: ServicePattern[] = [
  // Google Services
  {
    name: "Google",
    category: "email",
    domains: [".google.com", ".youtube.com", ".gmail.com"],
    auth_cookies: ["SID", "HSID", "SSID", "APISID", "SAPISID"],
    identifier_cookies: [{ name: "ACCOUNT_CHOOSER" }],
    high_value: true,
  },

  // Microsoft Services
  {
    name: "Microsoft",
    category: "email",
    domains: [".microsoft.com", ".live.com", ".outlook.com", ".office.com"],
    auth_cookies: ["MSA", "MSPOK", "MSPRequ", "MSPSoftVis"],
    high_value: true,
  },

  // Social Media
  {
    name: "Facebook",
    category: "social",
    domains: [".facebook.com", ".messenger.com"],
    auth_cookies: ["c_user", "xs", "fr", "datr"],
    identifier_cookies: [{ name: "c_user" }],
    high_value: true,
  },
  {
    name: "Instagram",
    category: "social",
    domains: [".instagram.com"],
    auth_cookies: ["sessionid", "csrftoken", "ds_user_id"],
    identifier_cookies: [{ name: "ds_user_id" }],
    high_value: true,
  },
  {
    name: "Twitter/X",
    category: "social",
    domains: [".twitter.com", ".x.com"],
    auth_cookies: ["auth_token", "ct0", "twid"],
    identifier_cookies: [{ name: "twid" }],
    high_value: true,
  },
  {
    name: "LinkedIn",
    category: "social",
    domains: [".linkedin.com"],
    auth_cookies: ["li_at", "JSESSIONID", "liap"],
    high_value: true,
  },
  {
    name: "TikTok",
    category: "social",
    domains: [".tiktok.com"],
    auth_cookies: ["sessionid", "sid_tt", "sessionid_ss"],
    high_value: false,
  },
  {
    name: "Reddit",
    category: "social",
    domains: [".reddit.com"],
    auth_cookies: ["reddit_session", "token_v2"],
    high_value: false,
  },

  // E-commerce & Payments
  {
    name: "Amazon",
    category: "ecommerce",
    domains: [".amazon.com", ".amazon.co.uk", ".amazon.de"],
    auth_cookies: ["session-id", "session-token", "x-main", "at-main"],
    high_value: true,
  },
  {
    name: "PayPal",
    category: "financial",
    domains: [".paypal.com"],
    auth_cookies: ["cookie_check", "login_email", "X-PP-SILOVER"],
    identifier_cookies: [{ name: "login_email" }],
    high_value: true,
  },
  {
    name: "eBay",
    category: "ecommerce",
    domains: [".ebay.com"],
    auth_cookies: ["s", "nonsession", "dp1"],
    high_value: false,
  },

  // Cryptocurrency
  {
    name: "Binance",
    category: "crypto",
    domains: [".binance.com"],
    auth_cookies: ["source", "lang", "bnc-uuid"],
    high_value: true,
  },
  {
    name: "Coinbase",
    category: "crypto",
    domains: [".coinbase.com"],
    auth_cookies: ["__cf_bm", "cb_device_id"],
    high_value: true,
  },
  {
    name: "Kraken",
    category: "crypto",
    domains: [".kraken.com"],
    auth_cookies: ["session", "csrf_token"],
    high_value: true,
  },

  // Gaming
  {
    name: "Steam",
    category: "gaming",
    domains: [".steampowered.com", ".steamcommunity.com"],
    auth_cookies: ["steamLoginSecure", "sessionid", "steamRememberLogin"],
    identifier_cookies: [{ name: "steamLoginSecure" }],
    high_value: true,
  },
  {
    name: "Epic Games",
    category: "gaming",
    domains: [".epicgames.com"],
    auth_cookies: ["EPIC_BEARER_TOKEN", "EPIC_SESSION_AP"],
    high_value: true,
  },
  {
    name: "Discord",
    category: "gaming",
    domains: [".discord.com"],
    auth_cookies: ["__dcfduid", "__sdcfduid", "token"],
    high_value: false,
  },

  // Development & Productivity
  {
    name: "GitHub",
    category: "development",
    domains: [".github.com"],
    auth_cookies: ["user_session", "logged_in", "__Host-user_session_same_site"],
    high_value: true,
  },
  {
    name: "GitLab",
    category: "development",
    domains: [".gitlab.com"],
    auth_cookies: ["_gitlab_session"],
    high_value: true,
  },

  // Streaming Services
  {
    name: "Netflix",
    category: "streaming",
    domains: [".netflix.com"],
    auth_cookies: ["NetflixId", "SecureNetflixId", "nfvdid"],
    high_value: false,
  },
  {
    name: "Spotify",
    category: "streaming",
    domains: [".spotify.com"],
    auth_cookies: ["sp_dc", "sp_key", "sp_t"],
    high_value: false,
  },
  {
    name: "YouTube Premium",
    category: "streaming",
    domains: [".youtube.com"],
    auth_cookies: ["VISITOR_INFO1_LIVE", "YSC", "PREF"],
    high_value: false,
  },

  // Cloud Storage
  {
    name: "Dropbox",
    category: "cloud",
    domains: [".dropbox.com"],
    auth_cookies: ["t", "gvc", "__Host-js_csrf"],
    high_value: true,
  },
  {
    name: "Google Drive",
    category: "cloud",
    domains: [".drive.google.com"],
    auth_cookies: ["SID", "HSID", "SSID"],
    high_value: true,
  },

  // Banking (Generic patterns)
  {
    name: "Banking (Generic)",
    category: "financial",
    domains: [
      ".chase.com",
      ".bankofamerica.com",
      ".wellsfargo.com",
      ".citibank.com",
      ".usbank.com",
    ],
    auth_cookies: ["session", "token", "auth"],
    high_value: true,
  },
]

/**
 * Parse cookies from Chrome/Edge/Brave SQLite database
 */
function parseCookiesFromBrowser(
  cookieDbPath: string,
  browserName: string,
  profileName: string,
): DetectedSession[] {
  const sessions: DetectedSession[] = []

  if (!existsSync(cookieDbPath)) {
    return sessions
  }

  try {
    const db = new Database(cookieDbPath, { readonly: true, fileMustExist: true })

    // Get all cookies
    const cookies = db
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
      ORDER BY host_key, name
    `,
      )
      .all() as any[]

    db.close()

    // Group cookies by domain
    const cookiesByDomain = new Map<string, any[]>()
    for (const cookie of cookies) {
      if (!cookiesByDomain.has(cookie.host_key)) {
        cookiesByDomain.set(cookie.host_key, [])
      }
      cookiesByDomain.get(cookie.host_key)!.push(cookie)
    }

    // Check each domain against service patterns
    for (const [domain, domainCookies] of cookiesByDomain.entries()) {
      for (const pattern of SERVICE_PATTERNS) {
        // Check if domain matches any pattern domain
        const matchesDomain = pattern.domains.some(
          (patternDomain) =>
            domain === patternDomain || domain.endsWith(patternDomain),
        )

        if (!matchesDomain) continue

        // Check if we have any auth cookies
        const foundAuthCookies = domainCookies.filter((cookie) =>
          pattern.auth_cookies.includes(cookie.name),
        )

        if (foundAuthCookies.length === 0) continue

        // Extract account identifier if available
        let accountIdentifier: string | undefined
        if (pattern.identifier_cookies) {
          for (const idCookie of pattern.identifier_cookies) {
            const found = domainCookies.find((c) => c.name === idCookie.name)
            if (found) {
              accountIdentifier = idCookie.extract
                ? idCookie.extract(found.value)
                : found.value
              break
            }
          }
        }

        // Get expiration (use the latest expiring auth cookie)
        const expirations = foundAuthCookies
          .map((c) => c.expires_utc)
          .filter((e) => e > 0)
        const latestExpiration = expirations.length > 0 ? Math.max(...expirations) : 0

        // Convert Chrome timestamp (microseconds since Jan 1, 1601) to JavaScript Date
        let expiresAt: Date | undefined
        let sessionValid = false
        if (latestExpiration > 0) {
          // Chrome uses Windows epoch (1601-01-01), convert to Unix epoch (1970-01-01)
          const unixTimestamp = (latestExpiration - 11644473600000000) / 1000000
          expiresAt = new Date(unixTimestamp * 1000)
          sessionValid = expiresAt > new Date()
        }

        // Check security flags
        const hasHttpOnly = foundAuthCookies.some((c) => c.is_httponly === 1)
        const hasSecure = foundAuthCookies.some((c) => c.is_secure === 1)
        const sameSite =
          foundAuthCookies.find((c) => c.samesite !== -1)?.samesite || null

        sessions.push({
          service: pattern.name,
          service_category: pattern.category,
          account_identifier: accountIdentifier,
          session_valid: sessionValid,
          expires_at: expiresAt,
          cookie_count: foundAuthCookies.length,
          has_auth_token: true,
          security_flags: {
            httponly: hasHttpOnly,
            secure: hasSecure,
            same_site:
              sameSite === 0
                ? "none"
                : sameSite === 1
                  ? "lax"
                  : sameSite === 2
                    ? "strict"
                    : null,
          },
          browser: browserName,
          profile: profileName,
          file_path: cookieDbPath,
          detected_at: new Date(),
        })
      }
    }
  } catch (error) {
    console.error(`Error parsing cookies from ${cookieDbPath}:`, error)
  }

  return sessions
}

/**
 * Parse all cookie sessions from device extraction directory
 */
export function parseAllCookieSessions(extractionDir: string): DetectedSession[] {
  const allSessions: DetectedSession[] = []

  try {
    // Browser directories to check
    const browserPaths = [
      { name: "Chrome", path: "AppData/Local/Google/Chrome/User Data" },
      { name: "Edge", path: "AppData/Local/Microsoft/Edge/User Data" },
      { name: "Brave", path: "AppData/Local/BraveSoftware/Brave-Browser/User Data" },
      { name: "Opera", path: "AppData/Roaming/Opera Software/Opera Stable" },
      { name: "Chromium", path: "AppData/Local/Chromium/User Data" },
      // Add Firefox support later (uses different format)
    ]

    for (const { name, path: browserPath } of browserPaths) {
      const fullPath = path.join(extractionDir, browserPath)

      if (!existsSync(fullPath)) continue

      // Find profiles
      const entries = readdirSync(fullPath, { withFileTypes: true })
      const profiles = entries.filter(
        (e) => e.isDirectory() && (e.name === "Default" || e.name.startsWith("Profile")),
      )

      for (const profile of profiles) {
        const cookieDbPath = path.join(fullPath, profile.name, "Network", "Cookies")

        if (existsSync(cookieDbPath)) {
          const sessions = parseCookiesFromBrowser(cookieDbPath, name, profile.name)
          allSessions.push(...sessions)
        }
      }
    }
  } catch (error) {
    console.error("Error parsing cookie sessions:", error)
  }

  return allSessions
}

/**
 * Get high-value sessions only
 */
export function getHighValueSessions(sessions: DetectedSession[]): DetectedSession[] {
  const highValueCategories = ["email", "financial", "crypto", "cloud", "development"]

  return sessions.filter(
    (session) =>
      highValueCategories.includes(session.service_category) && session.session_valid,
  )
}

/**
 * Get sessions grouped by category
 */
export function groupSessionsByCategory(
  sessions: DetectedSession[],
): Record<string, DetectedSession[]> {
  const grouped: Record<string, DetectedSession[]> = {}

  for (const session of sessions) {
    if (!grouped[session.service_category]) {
      grouped[session.service_category] = []
    }
    grouped[session.service_category].push(session)
  }

  return grouped
}
