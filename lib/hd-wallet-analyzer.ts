/**
 * HD Wallet Derivation Path Analyzer
 *
 * Analyzes seed phrases to:
 * - Derive multiple addresses from seed
 * - Identify derivation path patterns
 * - Detect wallet software by path pattern
 * - Correlate addresses to parent seed
 *
 * Note: This uses simplified detection. For production, integrate:
 * - @scure/bip32 for proper BIP32 derivation
 * - @scure/bip39 for seed phrase to master key
 * - @noble/secp256k1 for Ethereum key derivation
 * - @solana/web3.js for Solana derivation
 */

export interface DerivationPath {
  path: string
  purpose: number  // Usually 44 for BIP44
  coinType: number // 60 = ETH, 0 = BTC, 501 = SOL
  account: number
  change: number
  addressIndex: number
}

export interface DerivedAddress {
  address: string
  publicKey: string
  derivationPath: string
  pathObject: DerivationPath
  blockchain: string
  addressIndex: number
}

export interface HDWalletAnalysis {
  seedPhrase: string
  masterFingerprint?: string
  detectedPattern: string // e.g., "MetaMask", "Trust Wallet", "Ledger"
  primaryBlockchain: string
  derivedAddresses: DerivedAddress[]
  totalAddressesFound: number
  gapLimit: number // Last index found before 20 consecutive empty addresses
  estimatedTotalAddresses: number
  derivationPaths: {
    ethereum: string[]
    bitcoin: string[]
    solana: string[]
    other: string[]
  }
}

export interface WalletSoftwarePattern {
  name: string
  paths: string[]
  description: string
}

/**
 * Known wallet software derivation patterns
 */
export const WALLET_PATTERNS: WalletSoftwarePattern[] = [
  {
    name: "MetaMask",
    paths: ["m/44'/60'/0'/0/x"],
    description: "Ethereum-only wallet, BIP44 standard"
  },
  {
    name: "Trust Wallet",
    paths: ["m/44'/60'/0'/0/x", "m/44'/0'/0'/0/x", "m/44'/714'/0'/0/x"],
    description: "Multi-chain wallet, supports ETH, BTC, BNB"
  },
  {
    name: "Phantom",
    paths: ["m/44'/501'/x'/0'"],
    description: "Solana wallet with account-based derivation"
  },
  {
    name: "Ledger Live",
    paths: ["m/44'/60'/x'/0/0", "m/44'/0'/x'/0/0", "m/84'/0'/x'/0/0"],
    description: "Hardware wallet, uses account-level derivation"
  },
  {
    name: "Exodus",
    paths: ["m/44'/60'/0'/0/x", "m/44'/0'/0'/0/x", "m/44'/2'/0'/0/x"],
    description: "Multi-chain wallet supporting 50+ assets"
  },
  {
    name: "Coinbase Wallet",
    paths: ["m/44'/60'/0'/0/x"],
    description: "Similar to MetaMask, Ethereum-focused"
  },
  {
    name: "Electrum",
    paths: ["m/44'/0'/0'/0/x", "m/49'/0'/0'/0/x", "m/84'/0'/0'/0/x"],
    description: "Bitcoin wallet, supports multiple address types"
  }
]

/**
 * Common derivation paths by blockchain
 */
export const COMMON_DERIVATION_PATHS: Record<string, string[]> = {
  ETH: [
    "m/44'/60'/0'/0/x",  // Standard Ethereum (MetaMask, Trust Wallet)
    "m/44'/60'/x'/0/0",  // Ledger Live Ethereum
    "m/44'/61'/0'/0/x",  // Ethereum Classic
  ],
  BTC: [
    "m/44'/0'/0'/0/x",   // BIP44 Legacy Bitcoin
    "m/49'/0'/0'/0/x",   // BIP49 Nested SegWit
    "m/84'/0'/0'/0/x",   // BIP84 Native SegWit (Bech32)
    "m/44'/0'/x'/0/0",   // Ledger Live Bitcoin
  ],
  SOL: [
    "m/44'/501'/x'/0'",  // Phantom, Solflare (account-based)
    "m/44'/501'/0'/0'",  // Alternative Solana path
  ],
  BNB: [
    "m/44'/714'/0'/0/x", // Binance Chain
  ],
  LTC: [
    "m/44'/2'/0'/0/x",   // Litecoin
    "m/49'/2'/0'/0/x",   // Litecoin SegWit
  ],
  DOGE: [
    "m/44'/3'/0'/0/x",   // Dogecoin
  ],
  MATIC: [
    "m/44'/60'/0'/0/x",  // Polygon (same as Ethereum)
  ]
}

/**
 * Parse derivation path string into object
 */
export function parseDerivationPath(path: string): DerivationPath | null {
  // Match: m/44'/60'/0'/0/0
  const match = path.match(/^m\/(\d+)'?\/(\d+)'?\/(\d+)'?\/(\d+)'?\/(\d+)'?$/)

  if (!match) return null

  return {
    path: path,
    purpose: parseInt(match[1]),
    coinType: parseInt(match[2]),
    account: parseInt(match[3]),
    change: parseInt(match[4]),
    addressIndex: parseInt(match[5])
  }
}

/**
 * Generate derivation path from components
 */
export function generateDerivationPath(
  coinType: number,
  account: number = 0,
  change: number = 0,
  addressIndex: number = 0,
  purpose: number = 44
): string {
  return `m/${purpose}'/${coinType}'/${account}'/${change}/${addressIndex}`
}

/**
 * Get blockchain name from coin type
 */
export function getCoinTypeBlockchain(coinType: number): string {
  const coinTypes: Record<number, string> = {
    0: "BTC",
    2: "LTC",
    3: "DOGE",
    60: "ETH",
    61: "ETC",
    118: "ATOM",
    144: "XRP",
    145: "BCH",
    501: "SOL",
    714: "BNB",
    931: "MATIC",
  }

  return coinTypes[coinType] || `COIN_${coinType}`
}

/**
 * Identify wallet software by derivation path pattern
 */
export function identifyWalletSoftware(paths: string[]): WalletSoftwarePattern[] {
  const matches: WalletSoftwarePattern[] = []

  for (const walletPattern of WALLET_PATTERNS) {
    let matchCount = 0

    for (const walletPath of walletPattern.paths) {
      const pathRegex = walletPath.replace('/x', '/\\d+').replace(/'/g, "'?")
      const regex = new RegExp(`^${pathRegex}$`)

      for (const foundPath of paths) {
        if (regex.test(foundPath)) {
          matchCount++
          break
        }
      }
    }

    // If at least one path matches, consider it a match
    if (matchCount > 0) {
      matches.push(walletPattern)
    }
  }

  return matches
}

/**
 * Estimate total addresses from gap analysis
 *
 * BIP44 Gap Limit: If 20 consecutive addresses are unused, stop scanning
 */
export function estimateTotalAddresses(foundAddresses: DerivedAddress[]): number {
  if (foundAddresses.length === 0) return 0

  // Group by derivation path pattern (excluding index)
  const pathGroups: Record<string, number[]> = {}

  for (const addr of foundAddresses) {
    const pathBase = addr.derivationPath.replace(/\/\d+$/, '/x')
    if (!pathGroups[pathBase]) {
      pathGroups[pathBase] = []
    }
    pathGroups[pathBase].push(addr.addressIndex)
  }

  // For each path pattern, find the highest index
  let totalEstimate = 0

  for (const [pathBase, indices] of Object.entries(pathGroups)) {
    const maxIndex = Math.max(...indices)

    // Estimate: max index + gap limit
    // If we found address at index 50, likely scanned up to ~70
    const estimate = maxIndex + 20
    totalEstimate += estimate
  }

  return totalEstimate
}

/**
 * Analyze which addresses are "side wallets" from same seed
 *
 * This function would ideally:
 * 1. Take seed phrase
 * 2. Derive addresses for common paths (0-100 for each path)
 * 3. Match against addresses found in wallet data
 * 4. Return correlation
 *
 * NOTE: Actual cryptographic derivation requires libraries like:
 * - @scure/bip32, @scure/bip39, @noble/secp256k1
 *
 * For now, this is a simplified pattern-based analyzer
 */
export function analyzeSeedDerivation(
  seedPhrase: string,
  foundAddresses: string[], // Addresses found in wallet data
  blockchain: string = "ETH"
): {
  potentialPaths: string[]
  estimatedAddresses: number
  detectedPattern: string
} {
  const potentialPaths: string[] = []

  // Based on blockchain, suggest common paths to check
  const commonPaths = COMMON_DERIVATION_PATHS[blockchain] || []

  for (const pathTemplate of commonPaths) {
    // Generate potential paths (0-20 for quick check)
    for (let i = 0; i < 20; i++) {
      const path = pathTemplate.replace('/x', `/${i}`)
      potentialPaths.push(path)
    }
  }

  // Identify likely wallet software
  const matches = identifyWalletSoftware(commonPaths)
  const detectedPattern = matches.length > 0 ? matches[0].name : "Unknown"

  return {
    potentialPaths,
    estimatedAddresses: foundAddresses.length * 2, // Conservative estimate
    detectedPattern
  }
}

/**
 * Format derivation path for display
 */
export function formatDerivationPath(path: string): string {
  const parsed = parseDerivationPath(path)
  if (!parsed) return path

  const blockchain = getCoinTypeBlockchain(parsed.coinType)
  return `${blockchain}: ${path} (Account ${parsed.account}, Index ${parsed.addressIndex})`
}

/**
 * Get derivation path explanation
 */
export function explainDerivationPath(path: string): string {
  const parsed = parseDerivationPath(path)
  if (!parsed) return "Invalid derivation path"

  const blockchain = getCoinTypeBlockchain(parsed.coinType)

  let explanation = `BIP${parsed.purpose} ${blockchain} derivation:\n`
  explanation += `- Account: ${parsed.account}\n`
  explanation += `- Chain: ${parsed.change === 0 ? "External (receiving)" : "Internal (change)"}\n`
  explanation += `- Address Index: ${parsed.addressIndex}\n`

  // Add wallet software hints
  const matches = identifyWalletSoftware([path])
  if (matches.length > 0) {
    explanation += `\nLikely from: ${matches.map(m => m.name).join(", ")}`
  }

  return explanation
}

/**
 * Detect if multiple addresses share same seed based on pattern
 *
 * Heuristic: If we see addresses at sequential indices on same path,
 * they likely share a seed
 */
export function detectSharedSeed(addresses: DerivedAddress[]): Map<string, DerivedAddress[]> {
  const seedGroups = new Map<string, DerivedAddress[]>()

  // Group by path pattern (excluding index)
  const pathGroups = new Map<string, DerivedAddress[]>()

  for (const addr of addresses) {
    const pathBase = addr.derivationPath.replace(/\/\d+$/, '/x')
    if (!pathGroups.has(pathBase)) {
      pathGroups.set(pathBase, [])
    }
    pathGroups.get(pathBase)!.push(addr)
  }

  // For each path pattern, check if indices are sequential
  let seedGroupId = 1

  for (const [pathBase, addrs] of pathGroups.entries()) {
    if (addrs.length < 2) continue

    // Sort by index
    const sorted = addrs.sort((a, b) => a.addressIndex - b.addressIndex)

    // Check for patterns (even gaps of 1-5 suggest same seed)
    const indices = sorted.map(a => a.addressIndex)
    const gaps = []

    for (let i = 1; i < indices.length; i++) {
      gaps.push(indices[i] - indices[i - 1])
    }

    const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length

    // If average gap is small (1-10), likely same seed
    if (avgGap <= 10) {
      seedGroups.set(`seed_${seedGroupId}_${pathBase}`, sorted)
      seedGroupId++
    }
  }

  return seedGroups
}
