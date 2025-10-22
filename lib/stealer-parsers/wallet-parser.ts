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
import { parseLevelDBExtension, getUniqueValues } from "../leveldb-parser"

/**
 * Crypto wallet data interface
 */
export interface CryptoWallet {
  wallet_type: "browser_extension" | "desktop_app" | "mobile" | "other"
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
        wallets.push({
          wallet_type: walletType,
          wallet_name: walletName,
          seed_phrase: seed.trim(),
          file_path: filePath,
          extension_id: extensionId,
        })
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

  // Find seed phrases in text files
  const textFileWallets = findSeedPhrasesInTextFiles(logDirectory)
  allWallets.push(...textFileWallets)

  return allWallets
}
