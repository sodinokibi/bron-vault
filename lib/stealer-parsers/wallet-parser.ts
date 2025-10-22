/**
 * Cryptocurrency Wallet Extraction
 *
 * Detects and extracts crypto wallet data from:
 * - Browser extensions (MetaMask, Phantom, Coinbase Wallet, etc.)
 * - Desktop wallets (Exodus, Electrum, Atomic, Jaxx, etc.)
 * - Seed phrases and private keys from text files
 */

import { readFileSync, readdirSync, statSync, existsSync } from "fs"
import path from "path"
import { createHash } from "crypto"
import { parseLevelDBExtension, getUniqueValues } from "../leveldb-parser"
import {
  parseDerivationPath,
  identifyWalletSoftware,
  detectSharedSeed,
  type DerivedAddress
} from "../hd-wallet-analyzer"
import {
  parseLedgerLive,
  hasLedgerLive,
  calculateLedgerRiskScore,
  type LedgerLiveData,
  type LedgerAccount
} from "../ledger-live-parser"

/**
 * Crypto wallet data interface
 */
export interface CryptoWallet {
  wallet_type: "browser_extension" | "desktop_app" | "mobile" | "hardware_wallet" | "other"
  wallet_name: string
  address?: string
  private_key?: string
  seed_phrase?: string
  mnemonic?: string
  keystore_file?: string
  password_hint?: string
  file_path: string
  blockchain?: string
  // Enhanced fields from LevelDB parsing
  public_key?: string
  account_name?: string
  network_config?: any
  vault_data?: any
  extension_id?: string
  // HD Wallet fields
  derivation_path?: string
  seed_id?: string // Hash of seed phrase to group derived addresses
  address_index?: number
  wallet_software?: string // Detected wallet software (MetaMask, Phantom, etc.)
  // Ledger Live specific
  ledger_device_model?: string // Nano S, Nano X, Nano S Plus
  ledger_balance_usd?: string // USD balance (if available)
  ledger_operations_count?: number // Transaction count
}

/**
 * Known wallet browser extensions
 */
const BROWSER_WALLET_EXTENSIONS = {
  // MetaMask
  nkbihfbeogaeaoehlefnkodbefgpgknn: "MetaMask",
  // Phantom
  bfnaelmomeimhlpmgjnjophhpkkoljpa: "Phantom",
  // Coinbase Wallet
  hnfanknocfeofbddgcijnmhnfnkdnaad: "Coinbase Wallet",
  // Trust Wallet
  egjidjbpglichdcondbcbdnbeeppgdph: "Trust Wallet",
  // Binance Wallet
  fhbohimaelbohpjbbldcngcnapndodjp: "Binance Chain Wallet",
  // Exodus
  aholpfdialjgjfhomihkjbmgjidlcdno: "Exodus",
  // Brave Wallet
  odbfpeeihdkbihmopkbjmoonfanlbfcl: "Brave Wallet",
  // Ronin Wallet
  fnjhmkhhmkbjkkabndcnnogagogbneec: "Ronin Wallet",
  // Rabby Wallet
  acmacodkjbdgmoleebolmdjonilkdbch: "Rabby Wallet",
  // Rainbow
  opfgelmcmbiajamepnmloijbpoleiama: "Rainbow",
}

/**
 * Desktop wallet directories to search for
 */
const DESKTOP_WALLETS = [
  { name: "Exodus", paths: ["Exodus"] },
  { name: "Electrum", paths: ["Electrum"] },
  { name: "Atomic", paths: ["atomic", "Atomic Wallet"] },
  { name: "Jaxx Liberty", paths: ["Jaxx Liberty", "jaxx"] },
  { name: "Coinomi", paths: ["Coinomi"] },
  { name: "Guarda", paths: ["Guarda"] },
  { name: "Bitcoin Core", paths: ["Bitcoin"] },
  { name: "Ethereum Wallet", paths: ["Ethereum Wallet"] },
  { name: "Monero", paths: ["Monero"] },
  { name: "Litecoin", paths: ["Litecoin"] },
  { name: "Dogecoin", paths: ["Dogecoin"] },
]

/**
 * Patterns for detecting wallet data
 */
const WALLET_PATTERNS = {
  // BIP39 seed phrases (12, 18, 24 words)
  SEED_PHRASE: /\b([a-z]+\s+){11,23}[a-z]+\b/gi,
  // Ethereum private key (64 hex chars, optionally with 0x prefix)
  ETH_PRIVATE_KEY: /(?:0x)?[a-fA-F0-9]{64}\b/g,
  // Bitcoin private key (WIF format)
  BTC_PRIVATE_KEY_WIF: /[5KL][1-9A-HJ-NP-Za-km-z]{50,51}/g,
  // Ethereum address
  ETH_ADDRESS: /0x[a-fA-F0-9]{40}\b/g,
  // Bitcoin address
  BTC_ADDRESS: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
  // Solana address
  SOL_ADDRESS: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
}

/**
 * Common BIP39 wordlist words (for validation)
 */
const BIP39_WORDS = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract",
  "absurd", "abuse", "access", "accident", "account", "accuse", "achieve", "acid",
  // ... (truncated for brevity, in production include full 2048 word list)
]

/**
 * Validate if text looks like a BIP39 seed phrase
 */
function isBIP39SeedPhrase(text: string): boolean {
  const words = text.toLowerCase().trim().split(/\s+/)

  // Must be 12, 18, or 24 words
  if (![12, 18, 24].includes(words.length)) return false

  // At least 70% of words should be in BIP39 wordlist (simplified check)
  const validWords = words.filter((w) =>
    BIP39_WORDS.some((bip39) => bip39.startsWith(w.substring(0, 4))),
  )

  return validWords.length / words.length >= 0.7
}

/**
 * Detect blockchain from address format
 */
function detectBlockchain(address: string): string | undefined {
  if (!address) return undefined

  // Ethereum address (0x + 40 hex chars)
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return "ETH"
  }

  // Bitcoin address (starts with 1, 3, or bc1)
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) {
    return "BTC"
  }
  if (/^bc1[a-z0-9]{39,59}$/.test(address)) {
    return "BTC"
  }

  // Solana address (32-44 base58 chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return "SOL"
  }

  return undefined
}

/**
 * Generate seed ID from seed phrase (SHA256 hash)
 * Used to group addresses derived from the same seed
 * Returns full 64-character hex hash to avoid collisions
 */
function generateSeedId(seedPhrase: string): string {
  const normalized = seedPhrase.toLowerCase().trim().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * Extract derivation path from wallet data (vault, network config, etc.)
 * Returns derivation path if found, null otherwise
 */
function extractDerivationPath(walletData: any): string | null {
  if (!walletData || typeof walletData !== 'object') return null

  // Check for derivationPath in various formats
  const searchKeys = ['derivationPath', 'derivation_path', 'path', 'hdPath', 'hd_path']

  for (const key of searchKeys) {
    if (walletData[key] && typeof walletData[key] === 'string') {
      const path = walletData[key]
      // Validate it looks like a derivation path (m/44'/60'/0'/0/0)
      if (/^m\/\d+['\/]\d+['\/]\d+['\/]\d+['\/]?\d+['\/]?$/.test(path)) {
        return path
      }
    }
  }

  // Recursively search nested objects
  for (const value of Object.values(walletData)) {
    if (typeof value === 'object' && value !== null) {
      const found = extractDerivationPath(value)
      if (found) return found
    }
  }

  return null
}

/**
 * Detect HD wallet information for a wallet entry
 */
function detectHDWalletInfo(wallet: CryptoWallet): {
  derivation_path?: string
  seed_id?: string
  address_index?: number
  wallet_software?: string
} {
  const result: any = {}

  // Generate seed_id if we have a seed phrase
  if (wallet.seed_phrase) {
    result.seed_id = generateSeedId(wallet.seed_phrase)
  } else if (wallet.mnemonic) {
    result.seed_id = generateSeedId(wallet.mnemonic)
  }

  // Extract derivation path from vault data or network config
  if (wallet.vault_data) {
    const path = extractDerivationPath(wallet.vault_data)
    if (path) {
      result.derivation_path = path

      // Parse the path to extract address index
      const parsed = parseDerivationPath(path)
      if (parsed) {
        result.address_index = parsed.addressIndex

        // Identify wallet software based on path pattern
        const software = identifyWalletSoftware([path])
        if (software.length > 0) {
          result.wallet_software = software[0].name
        }
      }
    }
  }

  // Also check network_config
  if (wallet.network_config && !result.derivation_path) {
    const path = extractDerivationPath(wallet.network_config)
    if (path) {
      result.derivation_path = path

      const parsed = parseDerivationPath(path)
      if (parsed) {
        result.address_index = parsed.addressIndex

        const software = identifyWalletSoftware([path])
        if (software.length > 0) {
          result.wallet_software = software[0].name
        }
      }
    }
  }

  // If we don't have derivation path but have wallet_name, try to infer wallet software
  if (!result.wallet_software && wallet.wallet_name) {
    // Direct mapping from wallet name
    const walletNameLower = wallet.wallet_name.toLowerCase()
    if (walletNameLower.includes('metamask')) {
      result.wallet_software = 'MetaMask'
    } else if (walletNameLower.includes('phantom')) {
      result.wallet_software = 'Phantom'
    } else if (walletNameLower.includes('trust')) {
      result.wallet_software = 'Trust Wallet'
    } else if (walletNameLower.includes('coinbase')) {
      result.wallet_software = 'Coinbase Wallet'
    } else if (walletNameLower.includes('ledger')) {
      result.wallet_software = 'Ledger Live'
    } else if (walletNameLower.includes('exodus')) {
      result.wallet_software = 'Exodus'
    }
  }

  return result
}

/**
 * Parse browser wallet extensions with proper LevelDB parsing
 */
export function parseBrowserWalletExtensions(browserDataPath: string): CryptoWallet[] {
  const wallets: CryptoWallet[] = []

  try {
    // Look for extension directories
    const extensionsPath = path.join(browserDataPath, "Local Extension Settings")
    if (!existsSync(extensionsPath)) return []

    const extensionDirs = readdirSync(extensionsPath, { withFileTypes: true })

    for (const dir of extensionDirs) {
      if (!dir.isDirectory()) continue

      const extensionId = dir.name
      const walletName = BROWSER_WALLET_EXTENSIONS[extensionId as keyof typeof BROWSER_WALLET_EXTENSIONS]

      if (walletName) {
        const extensionPath = path.join(extensionsPath, extensionId)

        try {
          // Use proper LevelDB parser for better extraction
          console.log(`🔍 Parsing ${walletName} extension with LevelDB parser...`)
          const levelDBData = parseLevelDBExtension(extensionPath, walletName)
          const uniqueData = getUniqueValues(levelDBData)

          // Convert LevelDB parsed data to CryptoWallet format
          // Addresses
          for (const address of uniqueData.addresses) {
            const blockchain = detectBlockchain(address)
            wallets.push({
              wallet_type: "browser_extension",
              wallet_name: walletName,
              address: address,
              blockchain: blockchain,
              file_path: extensionPath,
              extension_id: extensionId
            })
          }

          // Public keys
          for (const pubKey of uniqueData.publicKeys) {
            wallets.push({
              wallet_type: "browser_extension",
              wallet_name: walletName,
              public_key: pubKey,
              file_path: extensionPath,
              extension_id: extensionId
            })
          }

          // Account names (combine with addresses if possible)
          for (const accountName of uniqueData.accountNames) {
            // Try to find matching address entry to add name to
            const existingWallet = wallets.find(w =>
              w.extension_id === extensionId &&
              w.wallet_name === walletName &&
              !w.account_name
            )

            if (existingWallet) {
              existingWallet.account_name = accountName
            } else {
              // Create standalone entry for account name
              wallets.push({
                wallet_type: "browser_extension",
                wallet_name: walletName,
                account_name: accountName,
                file_path: extensionPath,
                extension_id: extensionId
              })
            }
          }

          // Network configs
          for (const networkConfig of uniqueData.networkConfigs) {
            wallets.push({
              wallet_type: "browser_extension",
              wallet_name: walletName,
              network_config: networkConfig,
              file_path: extensionPath,
              extension_id: extensionId
            })
          }

          // Vault data (encrypted, but useful for analysis)
          for (const vaultData of uniqueData.vaultData) {
            wallets.push({
              wallet_type: "browser_extension",
              wallet_name: walletName,
              vault_data: JSON.stringify(vaultData),
              file_path: extensionPath,
              extension_id: extensionId
            })
          }

          console.log(`✅ Found ${uniqueData.addresses.length} addresses, ${uniqueData.publicKeys.length} public keys, ${uniqueData.accountNames.length} accounts from ${walletName}`)

        } catch (err) {
          console.error(`⚠️  LevelDB parsing failed for ${walletName}, falling back to basic parsing:`, err)

          // Fallback to basic string-based parsing
          const files = readdirSync(extensionPath)
          for (const file of files) {
            if (file.endsWith(".log") || file.endsWith(".ldb")) {
              const filePath = path.join(extensionPath, file)

              try {
                const buffer = readFileSync(filePath)
                const content = buffer.toString("utf-8", 0, Math.min(buffer.length, 1024 * 1024))

                // Extract wallet data from content (old method)
                extractWalletData(content, filePath, "browser_extension", walletName, wallets, extensionId)
              } catch (err) {
                // Can't read file
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error parsing browser wallet extensions:", err)
  }

  // Post-process: Enrich wallets with HD wallet information
  console.log("🔍 Detecting HD wallet information...")
  for (const wallet of wallets) {
    const hdInfo = detectHDWalletInfo(wallet)
    Object.assign(wallet, hdInfo)
  }

  // Detect shared seeds by grouping wallets with same seed_id
  const walletsWithSeeds = wallets.filter(w => w.seed_id)
  if (walletsWithSeeds.length > 0) {
    const seedGroups = new Map<string, number>()
    for (const wallet of walletsWithSeeds) {
      const count = seedGroups.get(wallet.seed_id!) || 0
      seedGroups.set(wallet.seed_id!, count + 1)
    }

    for (const [seedId, count] of seedGroups.entries()) {
      if (count > 1) {
        console.log(`🔗 Found ${count} addresses sharing seed ${seedId.substring(0, 8)}...`)
      }
    }
  }

  return wallets
}

/**
 * Parse desktop wallet installations
 */
export function parseDesktopWallets(rootPath: string): CryptoWallet[] {
  const wallets: CryptoWallet[] = []

  for (const wallet of DESKTOP_WALLETS) {
    for (const walletPath of wallet.paths) {
      const fullPath = path.join(rootPath, walletPath)

      if (!existsSync(fullPath)) continue

      try {
        // Search for wallet files
        searchWalletFiles(fullPath, wallet.name, wallets)
      } catch (err) {
        // Can't access directory
      }
    }
  }

  // Post-process: Enrich wallets with HD wallet information
  for (const wallet of wallets) {
    const hdInfo = detectHDWalletInfo(wallet)
    Object.assign(wallet, hdInfo)
  }

  return wallets
}

/**
 * Search directory for wallet files
 */
function searchWalletFiles(
  dirPath: string,
  walletName: string,
  wallets: CryptoWallet[],
  depth: number = 0,
): void {
  if (depth > 5) return // Limit recursion

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase()

        // Look for wallet-related files
        if (
          lowerName.includes("wallet") ||
          lowerName.includes("seed") ||
          lowerName.includes("keystore") ||
          lowerName.endsWith(".dat") ||
          lowerName.endsWith(".json") ||
          lowerName.endsWith(".txt")
        ) {
          try {
            const content = readFileSync(fullPath, "utf-8")
            extractWalletData(content, fullPath, "desktop_app", walletName, wallets)
          } catch (err) {
            // Binary file or can't read, check if it's a keystore
            if (lowerName.includes("keystore")) {
              wallets.push({
                wallet_type: "desktop_app",
                wallet_name: walletName,
                keystore_file: fullPath,
                file_path: fullPath,
              })
            }
          }
        }
      } else if (entry.isDirectory()) {
        searchWalletFiles(fullPath, walletName, wallets, depth + 1)
      }
    }
  } catch (err) {
    // Can't read directory
  }
}

/**
 * Extract wallet data from text content
 */
function extractWalletData(
  content: string,
  filePath: string,
  walletType: CryptoWallet["wallet_type"],
  walletName: string,
  wallets: CryptoWallet[],
  extensionId?: string,
): void {
  // Try to parse as JSON first (common for wallet exports)
  try {
    const json = JSON.parse(content)
    extractWalletFromJSON(json, filePath, walletType, walletName, wallets)
  } catch (err) {
    // Not JSON, continue with pattern matching
  }

  // Extract seed phrases
  const seedMatches = content.match(WALLET_PATTERNS.SEED_PHRASE)
  if (seedMatches) {
    for (const seed of seedMatches) {
      if (isBIP39SeedPhrase(seed)) {
        const trimmedSeed = seed.trim()
        const wallet: CryptoWallet = {
          wallet_type: walletType,
          wallet_name: walletName,
          seed_phrase: trimmedSeed,
          file_path: filePath,
          extension_id: extensionId,
          // Generate seed_id immediately for grouping
          seed_id: generateSeedId(trimmedSeed),
        }

        // Detect wallet software from wallet name
        const hdInfo = detectHDWalletInfo(wallet)
        Object.assign(wallet, hdInfo)

        wallets.push(wallet)
      }
    }
  }

  // Extract Ethereum private keys
  const ethPrivateKeys = content.match(WALLET_PATTERNS.ETH_PRIVATE_KEY)
  if (ethPrivateKeys) {
    for (const key of ethPrivateKeys) {
      wallets.push({
        wallet_type: walletType,
        wallet_name: walletName,
        private_key: key,
        blockchain: "ETH",
        file_path: filePath,
        extension_id: extensionId,
      })
    }
  }

  // Extract Bitcoin private keys
  const btcPrivateKeys = content.match(WALLET_PATTERNS.BTC_PRIVATE_KEY_WIF)
  if (btcPrivateKeys) {
    for (const key of btcPrivateKeys) {
      wallets.push({
        wallet_type: walletType,
        wallet_name: walletName,
        private_key: key,
        blockchain: "BTC",
        file_path: filePath,
        extension_id: extensionId,
      })
    }
  }

  // Extract addresses
  const ethAddresses = content.match(WALLET_PATTERNS.ETH_ADDRESS)
  const btcAddresses = content.match(WALLET_PATTERNS.BTC_ADDRESS)

  if (ethAddresses && ethAddresses.length > 0) {
    wallets.push({
      wallet_type: walletType,
      wallet_name: walletName,
      address: ethAddresses[0],
      blockchain: "ETH",
      file_path: filePath,
      extension_id: extensionId,
    })
  }

  if (btcAddresses && btcAddresses.length > 0) {
    wallets.push({
      wallet_type: walletType,
      wallet_name: walletName,
      address: btcAddresses[0],
      blockchain: "BTC",
      file_path: filePath,
      extension_id: extensionId,
    })
  }
}

/**
 * Extract wallet data from JSON
 */
function extractWalletFromJSON(
  json: any,
  filePath: string,
  walletType: CryptoWallet["wallet_type"],
  walletName: string,
  wallets: CryptoWallet[],
): void {
  function search(obj: any) {
    if (typeof obj !== "object" || obj === null) return

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()

      // Check for seed/mnemonic
      if (
        (lowerKey.includes("seed") ||
          lowerKey.includes("mnemonic") ||
          lowerKey.includes("phrase")) &&
        typeof value === "string"
      ) {
        if (isBIP39SeedPhrase(value)) {
          wallets.push({
            wallet_type: walletType,
            wallet_name: walletName,
            seed_phrase: value,
            file_path: filePath,
          })
        }
      }

      // Check for private key
      if (lowerKey.includes("private") && typeof value === "string") {
        wallets.push({
          wallet_type: walletType,
          wallet_name: walletName,
          private_key: value,
          file_path: filePath,
        })
      }

      // Check for address
      if (lowerKey.includes("address") && typeof value === "string") {
        let blockchain: string | undefined
        if (value.startsWith("0x")) blockchain = "ETH"
        else if (value.match(/^[13]/)) blockchain = "BTC"

        wallets.push({
          wallet_type: walletType,
          wallet_name: walletName,
          address: value,
          blockchain,
          file_path: filePath,
        })
      }

      // Recurse
      if (typeof value === "object") {
        search(value)
      }
    }
  }

  search(json)
}

/**
 * Find seed phrases in text files
 */
export function findSeedPhrasesInTextFiles(rootPath: string): CryptoWallet[] {
  const wallets: CryptoWallet[] = []

  function search(currentPath: string, depth: number = 0) {
    if (depth > 10) return

    try {
      const entries = readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isFile() && entry.name.endsWith(".txt")) {
          try {
            const content = readFileSync(fullPath, "utf-8")
            extractWalletData(content, fullPath, "other", "Text File", wallets)
          } catch (err) {
            // Can't read file
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
  return wallets
}

/**
 * Parse Ledger Live installation and convert to CryptoWallet format
 */
function parseLedgerLiveWallets(logDirectory: string): CryptoWallet[] {
  const wallets: CryptoWallet[] = []

  try {
    // Ledger Live data might be in user profile
    const ledgerData = parseLedgerLive(logDirectory)

    if (!ledgerData) {
      return wallets
    }

    console.log(`✅ Ledger Live found: ${ledgerData.total_accounts} accounts, ${ledgerData.currencies.length} currencies`)
    if (ledgerData.total_balance_usd) {
      console.log(`💰 Total portfolio value: $${ledgerData.total_balance_usd}`)
    }

    // Calculate risk score
    const riskScore = calculateLedgerRiskScore(ledgerData)
    console.log(`⚠️  Risk Score: ${riskScore}/100 ${riskScore >= 70 ? '(HIGH VALUE)' : ''}`)

    // Convert each Ledger account to CryptoWallet format
    for (const account of ledgerData.accounts) {
      const wallet: CryptoWallet = {
        wallet_type: "hardware_wallet",
        wallet_name: "Ledger Live",
        address: account.address,
        blockchain: account.currency,
        file_path: ledgerData.installation_path,
        account_name: account.name,
        derivation_path: account.derivation_path,
        address_index: account.account_index,
        wallet_software: `Ledger ${ledgerData.device_info?.model || 'Hardware Wallet'}`,
        ledger_device_model: ledgerData.device_info?.model,
        ledger_balance_usd: account.balance_usd,
        ledger_operations_count: account.operations_count
      }

      // Add HD wallet detection for Ledger accounts
      const hdInfo = detectHDWalletInfo(wallet)
      Object.assign(wallet, hdInfo)

      wallets.push(wallet)

      // For UTXO chains, also add the fresh address if different
      if (account.fresh_address && account.fresh_address !== account.address) {
        wallets.push({
          ...wallet,
          address: account.fresh_address,
          account_name: `${account.name} (Fresh Address)`
        })
      }
    }

    // Log summary
    if (wallets.length > 0) {
      console.log(`🔑 Ledger Live Intelligence:`)
      console.log(`   - ${wallets.length} addresses extracted`)
      console.log(`   - Currencies: ${ledgerData.currencies.join(', ')}`)
      if (ledgerData.device_info?.model) {
        console.log(`   - Device: ${ledgerData.device_info.model}`)
      }
      console.log(`   ⚠️  Note: Private keys are on hardware device (not extractable)`)
      console.log(`   ⚠️  Intelligence value: On-chain monitoring, social engineering, physical theft`)
    }

  } catch (err) {
    console.error(`⚠️  Error parsing Ledger Live: ${err}`)
  }

  return wallets
}

/**
 * Parse all crypto wallet data from stealer log
 */
export function parseAllCryptoWallets(logDirectory: string): CryptoWallet[] {
  const allWallets: CryptoWallet[] = []

  // Parse browser wallet extensions
  // Look in browser data directories
  const browserPaths = [
    "Google/Chrome",
    "Microsoft/Edge",
    "BraveSoftware/Brave-Browser",
    "Opera Software/Opera Stable",
  ]

  for (const browserPath of browserPaths) {
    const fullPath = path.join(logDirectory, browserPath)
    if (existsSync(fullPath)) {
      const browserWallets = parseBrowserWalletExtensions(fullPath)
      allWallets.push(...browserWallets)
    }
  }

  // Parse desktop wallets
  const desktopWallets = parseDesktopWallets(logDirectory)
  allWallets.push(...desktopWallets)

  // Parse Ledger Live (hardware wallet software)
  console.log("🔍 Checking for Ledger Live installation...")
  const ledgerWallets = parseLedgerLiveWallets(logDirectory)
  if (ledgerWallets.length > 0) {
    console.log(`🎯 HIGH-VALUE TARGET: Ledger Live detected with ${ledgerWallets.length} accounts`)
    allWallets.push(...ledgerWallets)
  }

  // Find seed phrases in text files
  const textFileWallets = findSeedPhrasesInTextFiles(logDirectory)
  allWallets.push(...textFileWallets)

  return allWallets
}
