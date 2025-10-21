/**
 * Smart File Categorization System
 *
 * Automatically categorizes files from stealer logs based on:
 * - File paths and names
 * - Content patterns
 * - Directory structure
 * - Known application signatures
 */

import path from "path"

/**
 * File category types
 */
export enum FileCategory {
  MESSAGING = "messaging",
  AUTHENTICATION = "authentication",
  CRYPTO_WALLET = "crypto_wallet",
  GAMING = "gaming",
  FINANCIAL = "financial",
  CORPORATE = "corporate",
  SOCIAL_MEDIA = "social_media",
  DEVELOPER = "developer",
  EMAIL = "email",
  VPN_FTP = "vpn_ftp",
  OTHER = "other",
}

/**
 * Categorization result
 */
export interface CategoryResult {
  category: FileCategory
  subcategory: string | null
  confidence: number // 0.0 to 1.0
  tags: string[]
  reason: string
}

/**
 * Category patterns and rules
 */
const CATEGORY_PATTERNS = {
  [FileCategory.MESSAGING]: {
    paths: [
      /discord/i,
      /telegram/i,
      /tdata/i,
      /slack/i,
      /teams/i,
      /whatsapp/i,
      /signal/i,
      /viber/i,
      /skype/i,
      /zoom/i,
    ],
    files: [
      /discord.*\.log/i,
      /discord.*\.ldb/i,
      /key_data/i,
      /\b(maps?|settings?|usertag)\b/i,
    ],
    confidence: 0.95,
  },
  [FileCategory.AUTHENTICATION]: {
    paths: [/authy/i, /authenticator/i, /2fa/i, /mfa/i, /google.*auth/i],
    files: [/backup.*codes?/i, /recovery/i, /2fa/i, /mfa/i, /otp/i, /totp/i],
    confidence: 0.90,
  },
  [FileCategory.CRYPTO_WALLET]: {
    paths: [
      /metamask/i,
      /phantom/i,
      /coinbase.*wallet/i,
      /trust.*wallet/i,
      /exodus/i,
      /electrum/i,
      /atomic/i,
      /jaxx/i,
      /bitcoin/i,
      /ethereum/i,
      /monero/i,
      /litecoin/i,
      /dogecoin/i,
      /wallet/i,
    ],
    files: [/wallet.*\.dat/i, /keystore/i, /seed/i, /mnemonic/i, /\.wallet$/i],
    confidence: 0.95,
  },
  [FileCategory.GAMING]: {
    paths: [
      /steam/i,
      /epic.*games/i,
      /origin/i,
      /uplay/i,
      /battle\.?net/i,
      /riot.*games/i,
      /minecraft/i,
      /roblox/i,
      /gog/i,
      /xbox/i,
      /playstation/i,
    ],
    files: [/ssfn/i, /loginusers\.vdf/i, /config\.vdf/i],
    confidence: 0.90,
  },
  [FileCategory.FINANCIAL]: {
    paths: [
      /paypal/i,
      /stripe/i,
      /square/i,
      /venmo/i,
      /cash.*app/i,
      /zelle/i,
      /banking/i,
      /bank/i,
    ],
    files: [],
    confidence: 0.85,
  },
  [FileCategory.CORPORATE]: {
    paths: [
      /vpn/i,
      /openvpn/i,
      /wireguard/i,
      /cisco/i,
      /outlook/i,
      /office365/i,
      /sharepoint/i,
      /onedrive.*business/i,
      /teams/i,
      /zoom/i,
    ],
    files: [/\.ovpn$/i, /\.conf$/i],
    confidence: 0.80,
  },
  [FileCategory.SOCIAL_MEDIA]: {
    paths: [
      /facebook/i,
      /twitter/i,
      /instagram/i,
      /tiktok/i,
      /linkedin/i,
      /reddit/i,
      /snapchat/i,
      /pinterest/i,
    ],
    files: [],
    confidence: 0.85,
  },
  [FileCategory.DEVELOPER]: {
    paths: [/\.ssh/i, /\.aws/i, /\.docker/i, /\.kube/i, /\.git/i],
    files: [
      /id_rsa/i,
      /id_ed25519/i,
      /\.pem$/i,
      /\.key$/i,
      /\.crt$/i,
      /\.p12$/i,
      /\.pfx$/i,
      /credentials$/i,
      /\.env$/i,
      /\.npmrc$/i,
      /\.pypirc$/i,
    ],
    confidence: 0.95,
  },
  [FileCategory.EMAIL]: {
    paths: [
      /thunderbird/i,
      /outlook/i,
      /mail/i,
      /postbox/i,
      /mailbird/i,
      /eudora/i,
    ],
    files: [/\.eml$/i, /\.msg$/i, /inbox/i],
    confidence: 0.85,
  },
  [FileCategory.VPN_FTP]: {
    paths: [
      /filezilla/i,
      /winscp/i,
      /putty/i,
      /openvpn/i,
      /nordvpn/i,
      /expressvpn/i,
    ],
    files: [
      /sitemanager\.xml/i,
      /recentservers\.xml/i,
      /\.ovpn$/i,
      /\.ppk$/i,
      /winscp\.ini/i,
    ],
    confidence: 0.90,
  },
}

/**
 * Subcategory mapping
 */
const SUBCATEGORY_MAPPING: Record<string, { category: FileCategory; subcategory: string }> = {
  // Messaging
  discord: { category: FileCategory.MESSAGING, subcategory: "Discord" },
  telegram: { category: FileCategory.MESSAGING, subcategory: "Telegram" },
  slack: { category: FileCategory.MESSAGING, subcategory: "Slack" },
  teams: { category: FileCategory.MESSAGING, subcategory: "Microsoft Teams" },
  whatsapp: { category: FileCategory.MESSAGING, subcategory: "WhatsApp" },
  signal: { category: FileCategory.MESSAGING, subcategory: "Signal" },

  // Crypto Wallets
  metamask: { category: FileCategory.CRYPTO_WALLET, subcategory: "MetaMask" },
  phantom: { category: FileCategory.CRYPTO_WALLET, subcategory: "Phantom" },
  exodus: { category: FileCategory.CRYPTO_WALLET, subcategory: "Exodus" },
  electrum: { category: FileCategory.CRYPTO_WALLET, subcategory: "Electrum" },
  "trust wallet": { category: FileCategory.CRYPTO_WALLET, subcategory: "Trust Wallet" },
  "coinbase wallet": { category: FileCategory.CRYPTO_WALLET, subcategory: "Coinbase Wallet" },

  // Gaming
  steam: { category: FileCategory.GAMING, subcategory: "Steam" },
  "epic games": { category: FileCategory.GAMING, subcategory: "Epic Games" },
  origin: { category: FileCategory.GAMING, subcategory: "Origin" },
  uplay: { category: FileCategory.GAMING, subcategory: "Ubisoft" },
  "battle.net": { category: FileCategory.GAMING, subcategory: "Battle.net" },
  minecraft: { category: FileCategory.GAMING, subcategory: "Minecraft" },
  roblox: { category: FileCategory.GAMING, subcategory: "Roblox" },

  // VPN/FTP
  filezilla: { category: FileCategory.VPN_FTP, subcategory: "FileZilla" },
  winscp: { category: FileCategory.VPN_FTP, subcategory: "WinSCP" },
  openvpn: { category: FileCategory.VPN_FTP, subcategory: "OpenVPN" },
  nordvpn: { category: FileCategory.VPN_FTP, subcategory: "NordVPN" },
  expressvpn: { category: FileCategory.VPN_FTP, subcategory: "ExpressVPN" },

  // Developer
  ".ssh": { category: FileCategory.DEVELOPER, subcategory: "SSH Keys" },
  ".aws": { category: FileCategory.DEVELOPER, subcategory: "AWS" },
  ".docker": { category: FileCategory.DEVELOPER, subcategory: "Docker" },
  ".kube": { category: FileCategory.DEVELOPER, subcategory: "Kubernetes" },

  // 2FA
  authy: { category: FileCategory.AUTHENTICATION, subcategory: "Authy" },
  authenticator: { category: FileCategory.AUTHENTICATION, subcategory: "Authenticator" },
}

/**
 * Categorize a file based on its path and name
 */
export function categorizeFile(filePath: string, fileName: string): CategoryResult {
  const fullPath = path.join(filePath, fileName).toLowerCase()
  const lowerFileName = fileName.toLowerCase()

  // Check each category
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    // Check path patterns
    for (const pathPattern of patterns.paths) {
      if (pathPattern.test(fullPath)) {
        const subcategory = extractSubcategory(fullPath)
        return {
          category: category as FileCategory,
          subcategory,
          confidence: patterns.confidence,
          tags: extractTags(fullPath),
          reason: `Path matches ${category} pattern`,
        }
      }
    }

    // Check file patterns
    for (const filePattern of patterns.files) {
      if (filePattern.test(lowerFileName)) {
        const subcategory = extractSubcategory(fullPath)
        return {
          category: category as FileCategory,
          subcategory,
          confidence: patterns.confidence * 0.9, // Slightly lower confidence for file-only match
          tags: extractTags(fullPath),
          reason: `Filename matches ${category} pattern`,
        }
      }
    }
  }

  // Default to OTHER
  return {
    category: FileCategory.OTHER,
    subcategory: null,
    confidence: 0.5,
    tags: [],
    reason: "No specific pattern matched",
  }
}

/**
 * Extract subcategory from file path
 */
function extractSubcategory(filePath: string): string | null {
  const lowerPath = filePath.toLowerCase()

  for (const [keyword, mapping] of Object.entries(SUBCATEGORY_MAPPING)) {
    if (lowerPath.includes(keyword)) {
      return mapping.subcategory
    }
  }

  return null
}

/**
 * Extract relevant tags from file path
 */
function extractTags(filePath: string): string[] {
  const tags: string[] = []
  const lowerPath = filePath.toLowerCase()

  // Browser tags
  if (lowerPath.includes("chrome")) tags.push("chrome")
  if (lowerPath.includes("firefox")) tags.push("firefox")
  if (lowerPath.includes("edge")) tags.push("edge")
  if (lowerPath.includes("opera")) tags.push("opera")
  if (lowerPath.includes("brave")) tags.push("brave")

  // Desktop vs browser extension
  if (lowerPath.includes("local extension settings")) tags.push("browser_extension")
  if (lowerPath.includes("appdata") || lowerPath.includes("program")) tags.push("desktop_app")

  // Data type tags
  if (lowerPath.includes("cookie")) tags.push("cookies")
  if (lowerPath.includes("password") || lowerPath.includes("login")) tags.push("credentials")
  if (lowerPath.includes("history")) tags.push("history")
  if (lowerPath.includes("autofill")) tags.push("autofill")

  return tags
}

/**
 * Categorize multiple files and return statistics
 */
export function categorizeFiles(
  files: Array<{ file_path: string; file_name: string }>,
): {
  categories: Map<FileCategory, number>
  subcategories: Map<string, number>
  results: Array<{ file: string; category: CategoryResult }>
} {
  const categories = new Map<FileCategory, number>()
  const subcategories = new Map<string, number>()
  const results: Array<{ file: string; category: CategoryResult }> = []

  for (const file of files) {
    const result = categorizeFile(file.file_path, file.file_name)
    results.push({ file: path.join(file.file_path, file.file_name), category: result })

    // Update category count
    categories.set(result.category, (categories.get(result.category) || 0) + 1)

    // Update subcategory count
    if (result.subcategory) {
      subcategories.set(result.subcategory, (subcategories.get(result.subcategory) || 0) + 1)
    }
  }

  return { categories, subcategories, results }
}

/**
 * Get high-value files (likely to contain sensitive data)
 */
export function getHighValueFiles(
  files: Array<{ file_path: string; file_name: string }>,
): Array<{ file: string; category: CategoryResult; priority: number }> {
  const categorized = categorizeFiles(files)
  const highValue: Array<{ file: string; category: CategoryResult; priority: number }> = []

  // Priority scores for each category
  const priorityScores: Record<FileCategory, number> = {
    [FileCategory.CRYPTO_WALLET]: 10,
    [FileCategory.AUTHENTICATION]: 9,
    [FileCategory.DEVELOPER]: 8,
    [FileCategory.FINANCIAL]: 8,
    [FileCategory.MESSAGING]: 7,
    [FileCategory.CORPORATE]: 7,
    [FileCategory.VPN_FTP]: 6,
    [FileCategory.GAMING]: 5,
    [FileCategory.EMAIL]: 5,
    [FileCategory.SOCIAL_MEDIA]: 4,
    [FileCategory.OTHER]: 1,
  }

  for (const result of categorized.results) {
    const priority = priorityScores[result.category.category] * result.category.confidence
    if (priority >= 5) {
      // Only include medium to high priority
      highValue.push({
        file: result.file,
        category: result.category,
        priority,
      })
    }
  }

  // Sort by priority (highest first)
  highValue.sort((a, b) => b.priority - a.priority)

  return highValue
}
