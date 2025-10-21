/**
 * Stealer Parser Types and Interfaces
 *
 * Defines common data structures for all stealer parsers
 */

// Supported stealer families
export enum StealerFamily {
  STEALC = "StealC",
  LUMMA = "Lumma",
  REDLINE = "Redline",
  RACCOON = "Raccoon",
  VIDAR = "Vidar",
  AURORA = "Aurora",
  META = "Meta",
  MARS = "Mars",
  FORMBOOK = "FormBook",
  UNKNOWN = "Unknown",
}

// Browser history data structure
export interface BrowserHistory {
  url: string
  title?: string
  visit_count: number
  last_visit_time: number // Chrome WebKit timestamp
  browser: string
  profile?: string
  file_path: string
}

// Download history data structure
export interface Download {
  url: string
  file_path?: string
  file_name?: string
  total_bytes?: number
  start_time?: number // Chrome WebKit timestamp
  end_time?: number
  state?: string // "complete", "interrupted", "in_progress"
  browser: string
  profile?: string
  source_file: string
}

// Bookmark data structure
export interface Bookmark {
  url: string
  title?: string
  date_added?: number // Chrome WebKit timestamp
  folder?: string // Bookmark folder path
  browser: string
  profile?: string
  file_path: string
}

// Cookie data structure
export interface Cookie {
  host_key: string
  name: string
  value: string
  path: string
  expires_utc: number
  is_secure: boolean
  is_httponly: boolean
  same_site?: string
  browser?: string
  profile?: string
  file_path: string
}

// Browser extension data structure
export interface BrowserExtension {
  extension_id: string
  extension_name: string
  extension_type: string // MetaMask, Authenticator, PasswordManager, etc.
  version?: string
  browser: string
  profile?: string
  data?: Record<string, any> // Extension-specific data (seeds, private keys, etc.)
  file_path: string
}

// Autofill data structure
export interface AutofillData {
  field_name: string
  field_value: string
  times_used?: number
  browser: string
  profile?: string
  file_path: string
}

// Credit card data structure
export interface CreditCard {
  card_number_encrypted: string
  card_number_last4: string
  cardholder_name: string
  expiration_month: number
  expiration_year: number
  browser: string
  profile?: string
  file_path: string
}

// Crypto wallet data structure
export interface CryptoWallet {
  wallet_type: string // MetaMask, Exodus, Electrum, etc.
  wallet_name?: string
  wallet_address?: string
  private_key?: string
  seed_phrase?: string
  browser?: string
  file_path: string
}

// Messenger token data structure
export interface MessengerToken {
  messenger_type: string // Discord, Telegram, WhatsApp, Signal, etc.
  username?: string
  user_id?: string
  token: string
  email?: string
  phone?: string
  file_path: string
}

// FTP/SSH credentials data structure
export interface FTPCredential {
  protocol: string // FTP, SFTP, SSH
  host: string
  port?: number
  username: string
  password: string
  software?: string // FileZilla, WinSCP, etc.
  file_path: string
}

// Gaming session data structure
export interface GamingSession {
  platform: string // Steam, Epic, Origin, Battle.net, etc.
  username?: string
  email?: string
  session_token: string
  file_path: string
}

// Password/credential data structure (existing)
export interface Credential {
  url: string
  domain: string
  tld: string
  username: string
  password: string
  browser?: string
  file_path: string
}

// Stealer metadata
export interface StealerMetadata {
  stealer_family: StealerFamily
  stealer_version?: string
  build_id?: string
  detection_confidence: number // 0-1
  indicators: string[] // File paths, patterns that identified this stealer
}

// Complete parsed data from a device
export interface ParsedStealerData {
  metadata: StealerMetadata
  credentials: Credential[]
  cookies: Cookie[]
  extensions: BrowserExtension[]
  autofill: AutofillData[]
  credit_cards: CreditCard[]
  crypto_wallets: CryptoWallet[]
  messenger_tokens: MessengerToken[]
  ftp_credentials: FTPCredential[]
  gaming_sessions: GamingSession[]
  history: BrowserHistory[]
  downloads: Download[]
  bookmarks: Bookmark[]
  files: ParsedFile[]
}

// File data structure
export interface ParsedFile {
  file_path: string
  file_name: string
  parent_path: string
  is_directory: boolean
  file_size: number
  content?: string
  local_file_path?: string
}

// Base parser interface that all stealer parsers must implement
export interface StealerParser {
  // Identify if this parser can handle the given directory structure
  canParse(files: ParsedFile[]): { canParse: boolean; confidence: number }

  // Parse the files and extract all data
  parse(files: ParsedFile[], deviceId: string): Promise<ParsedStealerData>

  // Get parser metadata
  getMetadata(): {
    name: string
    family: StealerFamily
    version?: string
    description: string
  }
}

// Browser detection helpers
export const BROWSER_PATHS = {
  CHROME: [
    "Google/Chrome",
    "Chrome",
    "BraveSoftware/Brave-Browser",
    "Chromium",
  ],
  FIREFOX: ["Mozilla/Firefox", "Firefox"],
  EDGE: ["Microsoft/Edge", "Edge"],
  OPERA: ["Opera Software/Opera Stable", "Opera"],
  BRAVE: ["BraveSoftware/Brave-Browser", "Brave"],
  YANDEX: ["Yandex/YandexBrowser"],
  VIVALDI: ["Vivaldi"],
} as const

// Common file patterns for different data types
export const FILE_PATTERNS = {
  PASSWORDS: [
    /passwords?\.txt$/i,
    /pass(words?|es)?\.txt$/i,
    /autofill\.txt$/i,
    /credentials?\.txt$/i,
    /logins?\.txt$/i,
  ],
  COOKIES: [
    /cookies?\.txt$/i,
    /cookies?\.json$/i,
    /Cookies$/i, // SQLite database
    /Network\/Cookies$/i,
  ],
  AUTOFILL: [
    /autofill\.txt$/i,
    /Web Data$/i, // SQLite database
    /formhistory\.sqlite$/i,
  ],
  CREDIT_CARDS: [/credit_?cards?\.txt$/i, /Web Data$/i],
  EXTENSIONS: [
    /Local Extension Settings/i,
    /Extensions/i,
    /nkbihfbeogaeaoehlefnkodbefgpgknn/i, // MetaMask
    /ibnejdfjmmkpcnlpebklmnkoeoihofec/i, // TronLink
  ],
  WALLETS: [
    /wallets?\.txt$/i,
    /Exodus/i,
    /Electrum/i,
    /atomic/i,
    /Coinomi/i,
  ],
  TELEGRAM: [/Telegram Desktop/i, /tdata/i],
  DISCORD: [/discord/i, /Local Storage\/leveldb/i],
  STEAM: [/Steam/i, /ssfn/i, /loginusers\.vdf/i],
  FTP: [
    /FileZilla/i,
    /sitemanager\.xml$/i,
    /recentservers\.xml$/i,
    /WinSCP\.ini$/i,
  ],
} as const

// Crypto wallet extension IDs
export const CRYPTO_EXTENSION_IDS = {
  METAMASK: "nkbihfbeogaeaoehlefnkodbefgpgknn",
  TRONLINK: "ibnejdfjmmkpcnlpebklmnkoeoihofec",
  BINANCE_CHAIN: "fhbohimaelbohpjbbldcngcnapndodjp",
  PHANTOM: "bfnaelmomeimhlpmgjnjophhpkkoljpa",
  COINBASE_WALLET: "hnfanknocfeofbddgcijnmhnfnkdnaad",
  TRUST_WALLET: "egjidjbpglichdcondbcbdnbeeppgdph",
  RONIN_WALLET: "fnjhmkhhmkbjkkabndcnnogagogbneec",
} as const

// Messenger token patterns
export const MESSENGER_PATTERNS = {
  DISCORD: {
    token: /[\w-]{24}\.[\w-]{6}\.[\w-]{27}/,
    leveldb: /Local Storage\/leveldb/i,
  },
  TELEGRAM: {
    tdata: /tdata/i,
    keyData: /key_datas?$/i,
  },
  WHATSAPP: {
    localStorage: /IndexedDB.*whatsapp/i,
  },
} as const
