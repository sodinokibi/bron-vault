/**
 * Public Key Extraction & Validation
 *
 * Comprehensive public key extraction for all major blockchains
 * Supports multiple formats: hex, base58, compressed, uncompressed
 */

export interface PublicKey {
  publicKey: string
  format: 'hex' | 'base58' | 'compressed' | 'uncompressed'
  chain: 'ETH' | 'SOL' | 'BTC' | 'SUI' | 'COSMOS' | 'NEAR' | 'APTOS' | 'UNKNOWN'
  length: number
  isValid: boolean
  derivedAddress?: string
}

export interface PublicKeyExtractionResult {
  publicKeys: PublicKey[]
  totalFound: number
  byChain: {
    ETH: number
    SOL: number
    BTC: number
    SUI: number
    COSMOS: number
    NEAR: number
    APTOS: number
    UNKNOWN: number
  }
}

/**
 * Ethereum/EVM Public Key Validation
 * Format: 64 bytes (128 hex chars) uncompressed OR 33 bytes (66 hex chars) compressed
 */
export function isValidEthereumPublicKey(pubKey: string): boolean {
  // Remove 0x prefix if present
  const cleaned = pubKey.toLowerCase().replace(/^0x/, '')

  // Uncompressed: 64 bytes (128 hex chars)
  // Compressed: 33 bytes (66 hex chars) starting with 02 or 03
  if (cleaned.length === 128) {
    return /^[0-9a-f]{128}$/i.test(cleaned)
  }

  if (cleaned.length === 66) {
    return /^(02|03)[0-9a-f]{64}$/i.test(cleaned)
  }

  return false
}

/**
 * Solana Public Key Validation
 * Format: 32 bytes base58 encoded (43-44 chars)
 */
export function isValidSolanaPublicKey(pubKey: string): boolean {
  // Must be 32-44 chars (base58)
  if (pubKey.length < 32 || pubKey.length > 44) return false

  // Check base58 alphabet (no 0, O, I, l)
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(pubKey)) return false

  // Skip known system programs
  const systemPrograms = [
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'So11111111111111111111111111111111111111112',
  ]
  if (systemPrograms.includes(pubKey)) return false

  return true
}

/**
 * Bitcoin Public Key Validation
 * Format: Compressed (33 bytes = 66 hex chars) OR Uncompressed (65 bytes = 130 hex chars)
 */
export function isValidBitcoinPublicKey(pubKey: string): boolean {
  const cleaned = pubKey.toLowerCase().replace(/^0x/, '')

  // Compressed: 33 bytes starting with 02 or 03
  if (cleaned.length === 66) {
    return /^(02|03)[0-9a-f]{64}$/i.test(cleaned)
  }

  // Uncompressed: 65 bytes starting with 04
  if (cleaned.length === 130) {
    return /^04[0-9a-f]{128}$/i.test(cleaned)
  }

  return false
}

/**
 * Sui Public Key Validation
 * Format: 32 bytes (64 hex chars)
 */
export function isValidSuiPublicKey(pubKey: string): boolean {
  const cleaned = pubKey.toLowerCase().replace(/^0x/, '')

  // 32 bytes = 64 hex chars
  if (cleaned.length === 64) {
    return /^[0-9a-f]{64}$/i.test(cleaned)
  }

  return false
}

/**
 * Cosmos Public Key Validation
 * Format: 33 bytes compressed (66 hex chars) OR base64
 */
export function isValidCosmosPublicKey(pubKey: string): boolean {
  // Hex format
  const cleaned = pubKey.toLowerCase().replace(/^0x/, '')
  if (cleaned.length === 66) {
    return /^(02|03)[0-9a-f]{64}$/i.test(cleaned)
  }

  // Base64 format (44 chars)
  if (pubKey.length === 44 && /^[A-Za-z0-9+/]+=*$/.test(pubKey)) {
    return true
  }

  return false
}

/**
 * NEAR Public Key Validation
 * Format: ed25519:[base58] (example: ed25519:H9k5eiU4xXS3M4z8HzKJSLaZdqGdGe...)
 */
export function isValidNearPublicKey(pubKey: string): boolean {
  if (!pubKey.startsWith('ed25519:')) return false

  const keyPart = pubKey.substring(8)
  return keyPart.length >= 43 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(keyPart)
}

/**
 * Aptos Public Key Validation
 * Format: 32 bytes (64 hex chars)
 */
export function isValidAptosPublicKey(pubKey: string): boolean {
  const cleaned = pubKey.toLowerCase().replace(/^0x/, '')

  if (cleaned.length === 64) {
    return /^[0-9a-f]{64}$/i.test(cleaned)
  }

  return false
}

/**
 * Detect blockchain from public key format
 */
export function detectChainFromPublicKey(pubKey: string): PublicKey['chain'] {
  // NEAR has explicit prefix
  if (pubKey.startsWith('ed25519:')) {
    return 'NEAR'
  }

  const cleaned = pubKey.replace(/^0x/, '')

  // Solana: base58, 32-44 chars
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(pubKey) && isValidSolanaPublicKey(pubKey)) {
    return 'SOL'
  }

  // Hex formats
  if (/^[0-9a-f]+$/i.test(cleaned)) {
    // Ethereum uncompressed: 128 hex chars
    if (cleaned.length === 128 && isValidEthereumPublicKey(pubKey)) {
      return 'ETH'
    }

    // Ethereum/Bitcoin/Cosmos compressed: 66 hex chars
    if (cleaned.length === 66) {
      if (cleaned.startsWith('02') || cleaned.startsWith('03')) {
        // Could be ETH, BTC, or COSMOS - default to ETH
        return 'ETH'
      }
    }

    // Bitcoin uncompressed: 130 hex chars
    if (cleaned.length === 130 && cleaned.startsWith('04') && isValidBitcoinPublicKey(pubKey)) {
      return 'BTC'
    }

    // Sui/Aptos: 64 hex chars
    if (cleaned.length === 64) {
      // Could be either - we'll mark as UNKNOWN and let context decide
      return 'UNKNOWN'
    }
  }

  return 'UNKNOWN'
}

/**
 * Extract public keys from text content (wallet data, JSON, etc.)
 */
export function extractPublicKeysFromText(content: string): PublicKey[] {
  const publicKeys: PublicKey[] = []
  const seen = new Set<string>()

  // Pattern 1: Hex public keys (various lengths)
  // Ethereum uncompressed: 128 hex
  const ethUncompressed = content.match(/(?:0x)?[a-fA-F0-9]{128}\b/g)
  if (ethUncompressed) {
    for (const pk of ethUncompressed) {
      const cleaned = pk.replace(/^0x/, '')
      if (!seen.has(cleaned) && isValidEthereumPublicKey(pk)) {
        seen.add(cleaned)
        publicKeys.push({
          publicKey: cleaned,
          format: 'uncompressed',
          chain: 'ETH',
          length: 64,
          isValid: true
        })
      }
    }
  }

  // Compressed keys (ETH/BTC/Cosmos): 66 hex
  const compressed66 = content.match(/(?:0x)?[a-fA-F0-9]{66}\b/g)
  if (compressed66) {
    for (const pk of compressed66) {
      const cleaned = pk.replace(/^0x/, '')
      if (!seen.has(cleaned)) {
        // Determine chain
        let chain: PublicKey['chain'] = 'UNKNOWN'
        if (isValidEthereumPublicKey(pk)) chain = 'ETH'
        else if (isValidBitcoinPublicKey(pk)) chain = 'BTC'
        else if (isValidCosmosPublicKey(pk)) chain = 'COSMOS'

        if (chain !== 'UNKNOWN') {
          seen.add(cleaned)
          publicKeys.push({
            publicKey: cleaned,
            format: 'compressed',
            chain,
            length: 33,
            isValid: true
          })
        }
      }
    }
  }

  // Bitcoin uncompressed: 130 hex
  const btcUncompressed = content.match(/(?:0x)?04[a-fA-F0-9]{128}\b/g)
  if (btcUncompressed) {
    for (const pk of btcUncompressed) {
      const cleaned = pk.replace(/^0x/, '')
      if (!seen.has(cleaned) && isValidBitcoinPublicKey(pk)) {
        seen.add(cleaned)
        publicKeys.push({
          publicKey: cleaned,
          format: 'uncompressed',
          chain: 'BTC',
          length: 65,
          isValid: true
        })
      }
    }
  }

  // 64 hex chars (Sui/Aptos/generic)
  const hex64 = content.match(/(?:0x)?[a-fA-F0-9]{64}\b/g)
  if (hex64) {
    for (const pk of hex64) {
      const cleaned = pk.replace(/^0x/, '')
      if (!seen.has(cleaned)) {
        // Try to determine chain
        let chain: PublicKey['chain'] = 'UNKNOWN'
        if (isValidSuiPublicKey(pk)) chain = 'SUI'
        else if (isValidAptosPublicKey(pk)) chain = 'APTOS'

        seen.add(cleaned)
        publicKeys.push({
          publicKey: cleaned,
          format: 'hex',
          chain,
          length: 32,
          isValid: true
        })
      }
    }
  }

  // Pattern 2: Solana base58 public keys (32-44 chars)
  const solanaRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g
  const solanaCandidates = content.match(solanaRegex)
  if (solanaCandidates) {
    for (const pk of solanaCandidates) {
      if (!seen.has(pk) && isValidSolanaPublicKey(pk)) {
        seen.add(pk)
        publicKeys.push({
          publicKey: pk,
          format: 'base58',
          chain: 'SOL',
          length: 32,
          isValid: true
        })
      }
    }
  }

  // Pattern 3: NEAR public keys (ed25519:...)
  const nearRegex = /ed25519:[1-9A-HJ-NP-Za-km-z]{43,}/g
  const nearKeys = content.match(nearRegex)
  if (nearKeys) {
    for (const pk of nearKeys) {
      if (!seen.has(pk) && isValidNearPublicKey(pk)) {
        seen.add(pk)
        publicKeys.push({
          publicKey: pk,
          format: 'base58',
          chain: 'NEAR',
          length: 32,
          isValid: true
        })
      }
    }
  }

  return publicKeys
}

/**
 * Extract public keys from JSON object (recursive)
 */
export function extractPublicKeysFromJSON(obj: any): PublicKey[] {
  const publicKeys: PublicKey[] = []
  const seen = new Set<string>()

  function search(current: any) {
    if (!current || typeof current !== 'object') return

    // Check each key-value pair
    for (const [key, value] of Object.entries(current)) {
      const lowerKey = key.toLowerCase()

      // Look for keys that suggest public key
      if (
        lowerKey.includes('public') ||
        lowerKey.includes('pubkey') ||
        lowerKey === 'pub' ||
        lowerKey === 'pk'
      ) {
        if (typeof value === 'string' && value.length >= 32) {
          // Extract from this value
          const extracted = extractPublicKeysFromText(value)
          for (const pk of extracted) {
            if (!seen.has(pk.publicKey)) {
              seen.add(pk.publicKey)
              publicKeys.push(pk)
            }
          }
        }
      }

      // Also check for Solana-specific patterns
      if (lowerKey === 'address' && typeof value === 'string') {
        if (isValidSolanaPublicKey(value)) {
          if (!seen.has(value)) {
            seen.add(value)
            publicKeys.push({
              publicKey: value,
              format: 'base58',
              chain: 'SOL',
              length: 32,
              isValid: true
            })
          }
        }
      }

      // Recurse into nested objects
      if (typeof value === 'object' && value !== null) {
        search(value)
      }
    }
  }

  search(obj)
  return publicKeys
}

/**
 * Analyze and summarize public key extraction results
 */
export function analyzePublicKeys(publicKeys: PublicKey[]): PublicKeyExtractionResult {
  const byChain = {
    ETH: 0,
    SOL: 0,
    BTC: 0,
    SUI: 0,
    COSMOS: 0,
    NEAR: 0,
    APTOS: 0,
    UNKNOWN: 0
  }

  for (const pk of publicKeys) {
    byChain[pk.chain]++
  }

  return {
    publicKeys,
    totalFound: publicKeys.length,
    byChain
  }
}

/**
 * Deduplicate public keys
 */
export function deduplicatePublicKeys(publicKeys: PublicKey[]): PublicKey[] {
  const seen = new Map<string, PublicKey>()

  for (const pk of publicKeys) {
    const key = pk.publicKey.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, pk)
    }
  }

  return Array.from(seen.values())
}
