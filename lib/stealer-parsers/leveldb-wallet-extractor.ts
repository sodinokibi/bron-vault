/**
 * Enhanced LevelDB Wallet Extractor
 *
 * Uses proper LevelDB library for accurate extraction from browser extensions
 * Supports: MetaMask, Phantom, Coinbase Wallet, Trust Wallet, etc.
 *
 * Install required dependency:
 * npm install level classic-level
 */

import { ClassicLevel } from 'classic-level'
import { existsSync } from 'fs'
import path from 'path'
import { createHash } from 'crypto'
import {
  extractPublicKeysFromText,
  extractPublicKeysFromJSON,
  deduplicatePublicKeys,
  type PublicKey
} from './public-key-extractor'

export interface WalletAddress {
  address: string
  chain: 'ETH' | 'SOL' | 'BTC' | 'SUI' | 'MATIC' | 'BSC' | 'UNKNOWN'
  type?: 'HD' | 'Hardware' | 'Imported' | 'ReadOnly'
  index?: number
  derivationPath?: string
}

export interface VaultHash {
  hash: string
  hashcatMode: string
  iterations: number
  kdf: string
  canCrack: boolean
}

export interface ExtractedWalletData {
  walletName: string
  extensionId: string
  addresses: WalletAddress[]
  vaultHash?: VaultHash
  accountNames: string[]
  publicKeys: PublicKey[]
  networkConfigs: any[]
  totalAddresses: number
}

/**
 * Open LevelDB database with recovery support
 */
async function openLevelDB(dbPath: string): Promise<ClassicLevel<string, any> | null> {
  try {
    const db = new ClassicLevel(dbPath, {
      valueEncoding: 'utf8',
      createIfMissing: false,
      errorIfExists: false
    })

    await db.open()
    return db
  } catch (err) {
    console.error(`Failed to open LevelDB at ${dbPath}:`, err)
    return null
  }
}

/**
 * Extract MetaMask wallet data with vault hash
 */
export async function extractMetaMaskData(extensionPath: string): Promise<ExtractedWalletData> {
  const result: ExtractedWalletData = {
    walletName: 'MetaMask',
    extensionId: 'nkbihfbeogaeaoehlefnkodbefgpgknn',
    addresses: [],
    accountNames: [],
    publicKeys: [],
    networkConfigs: [],
    totalAddresses: 0
  }

  const db = await openLevelDB(extensionPath)
  if (!db) return result

  try {
    // Iterate through all keys
    for await (const [key, value] of db.iterator()) {
      try {
        // Parse value as JSON if possible
        let parsedValue: any = value
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            parsedValue = JSON.parse(value)
          } catch (e) {
            // Keep as string
          }
        }

        // Extract AccountTracker data (compressed format)
        if (typeof value === 'string' && value.includes('AccountTracker')) {
          extractMetaMaskAccountTracker(value, result)
        }

        // Extract KeyringController vault (for vault hash)
        if (typeof value === 'string' && value.includes('KeyringController')) {
          extractMetaMaskVault(value, result)
        }

        // Extract from JSON objects
        if (typeof parsedValue === 'object' && parsedValue !== null) {
          extractMetaMaskFromJSON(parsedValue, result)

          // Extract public keys from JSON
          const publicKeys = extractPublicKeysFromJSON(parsedValue)
          result.publicKeys.push(...publicKeys)
        }

        // Extract public keys from text values
        if (typeof value === 'string' && value.length > 32) {
          const publicKeys = extractPublicKeysFromText(value)
          result.publicKeys.push(...publicKeys)
        }

      } catch (err) {
        // Skip invalid entries
      }
    }

    await db.close()
  } catch (err) {
    console.error('Error iterating MetaMask database:', err)
  }

  // Deduplicate public keys
  result.publicKeys = deduplicatePublicKeys(result.publicKeys)
  result.totalAddresses = result.addresses.length
  return result
}

/**
 * Extract from MetaMask AccountTracker (compressed format)
 */
function extractMetaMaskAccountTracker(data: string, result: ExtractedWalletData): void {
  // Look for compressed format: "sM0x..."
  const compressedIdx = data.indexOf('sM0x')
  if (compressedIdx >= 0) {
    const section = data.substring(compressedIdx + 2)
    const ethAddrRegex = /0x[a-fA-F0-9]{40}/g
    const addresses = section.match(ethAddrRegex)

    if (addresses) {
      addresses.forEach((addr, index) => {
        if (isValidEVMAddress(addr)) {
          // Guess type based on position
          let type: 'HD' | 'Hardware' | 'Imported' = 'HD'
          if (index < 2) type = 'Hardware'
          else if (index >= 8) type = 'Imported'

          result.addresses.push({
            address: addr.toLowerCase(),
            chain: 'ETH',
            type,
            index
          })
        }
      })
    }
    return
  }

  // Try JSON parsing
  try {
    const parsed = JSON.parse(data)
    if (parsed.AccountTracker?.accounts) {
      let index = 0
      for (const addr in parsed.AccountTracker.accounts) {
        if (isValidEVMAddress(addr)) {
          result.addresses.push({
            address: addr.toLowerCase(),
            chain: 'ETH',
            type: 'HD',
            index: index++
          })
        }
      }
    }
  } catch (e) {
    // Not JSON
  }
}

/**
 * Extract MetaMask vault hash for hashcat
 */
function extractMetaMaskVault(data: string, result: ExtractedWalletData): void {
  try {
    const parsed = JSON.parse(data)
    const keyringController = parsed.KeyringController

    if (!keyringController?.vault) return

    const vaultStr = typeof keyringController.vault === 'string'
      ? keyringController.vault
      : JSON.stringify(keyringController.vault)

    const vault = JSON.parse(vaultStr)

    if (!vault.data || !vault.salt || !vault.iv) return

    const vaultData = vault.data
    const salt = vault.salt
    const iv = vault.iv

    // Get iterations (default 600000 for newer MetaMask)
    let iterations = 600000
    if (vault.keyMetadata?.params?.iterations) {
      iterations = vault.keyMetadata.params.iterations
    }

    // Generate hashcat-compatible hash
    let hash: string
    let mode: string

    if (iterations !== 600000) {
      // Custom iterations format
      hash = `$metamask$${iterations}$${salt}$${iv}$${vaultData}`
      mode = '-m 26620'
    } else {
      // Standard format
      hash = `$metamask$${salt}$${iv}$${vaultData}`
      mode = '-m 26600'
    }

    result.vaultHash = {
      hash,
      hashcatMode: mode,
      iterations,
      kdf: 'pbkdf2',
      canCrack: true
    }

  } catch (e) {
    // Failed to parse vault
  }
}

/**
 * Extract from MetaMask JSON objects
 */
function extractMetaMaskFromJSON(obj: any, result: ExtractedWalletData): void {
  if (obj.address && typeof obj.address === 'string' && isValidEVMAddress(obj.address)) {
    result.addresses.push({
      address: obj.address.toLowerCase(),
      chain: 'ETH',
      type: 'HD'
    })
  }

  if (obj.name && typeof obj.name === 'string') {
    result.accountNames.push(obj.name)
  }

  // Recurse into nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      extractMetaMaskFromJSON(value, result)
    }
  }
}

/**
 * Extract Phantom wallet data with multi-chain support
 */
export async function extractPhantomData(extensionPath: string): Promise<ExtractedWalletData> {
  const result: ExtractedWalletData = {
    walletName: 'Phantom',
    extensionId: 'bfnaelmomeimhlpmgjnjophhpkkoljpa',
    addresses: [],
    accountNames: [],
    publicKeys: [],
    networkConfigs: [],
    totalAddresses: 0
  }

  const db = await openLevelDB(extensionPath)
  if (!db) return result

  try {
    for await (const [key, value] of db.iterator()) {
      try {
        // Look for vault accounts key
        if (key === '.phantom-labs.vault.accounts') {
          extractPhantomVaultAccounts(value, result)
        }

        // Look for encryption keys (for vault hash)
        if (key.includes('.phantom-labs.encryptionKeys') ||
            key.includes('.phantom-labs.vault.encryptedKey')) {
          extractPhantomVaultHash(value, result)
        }

        // Extract public keys from all values
        if (typeof value === 'string') {
          // Try JSON parsing first
          let parsedValue: any = value
          if (value.startsWith('{') || value.startsWith('[')) {
            try {
              parsedValue = JSON.parse(value)
              if (typeof parsedValue === 'object' && parsedValue !== null) {
                const publicKeys = extractPublicKeysFromJSON(parsedValue)
                result.publicKeys.push(...publicKeys)
              }
            } catch (e) {
              // Not JSON, try text extraction
            }
          }

          // Extract from text
          if (value.length > 32) {
            const publicKeys = extractPublicKeysFromText(value)
            result.publicKeys.push(...publicKeys)
          }
        }

      } catch (err) {
        // Skip invalid entries
      }
    }

    await db.close()
  } catch (err) {
    console.error('Error iterating Phantom database:', err)
  }

  // Deduplicate public keys
  result.publicKeys = deduplicatePublicKeys(result.publicKeys)
  result.totalAddresses = result.addresses.length
  return result
}

/**
 * Extract Phantom vault accounts (multi-chain)
 */
function extractPhantomVaultAccounts(data: string, result: ExtractedWalletData): void {
  try {
    const vaultData = JSON.parse(data)

    if (!vaultData.accounts || !Array.isArray(vaultData.accounts)) return

    for (const account of vaultData.accounts) {
      // Skip read-only accounts (watched addresses)
      if (account.type === 'readOnly') {
        continue
      }

      // Direct Solana public key
      if (account.publicKey && isValidSolanaAddress(account.publicKey)) {
        result.addresses.push({
          address: account.publicKey,
          chain: 'SOL',
          type: account.type === 'hardware' ? 'Hardware' : 'HD'
        })
      }

      // Multi-chain support via Chains object
      if (account.chains) {
        // Solana chain
        if (account.chains.solana?.publicKey) {
          const pubKey = account.chains.solana.publicKey
          if (typeof pubKey === 'string' && isValidSolanaAddress(pubKey)) {
            result.addresses.push({
              address: pubKey,
              chain: 'SOL',
              type: 'HD'
            })
          }
        }

        // Ethereum chain (CAIP eip155)
        if (account.chains.eip155?.publicKey) {
          const pubKey = account.chains.eip155.publicKey
          if (typeof pubKey === 'string' && isValidEVMAddress(pubKey)) {
            result.addresses.push({
              address: pubKey.toLowerCase(),
              chain: 'ETH',
              type: 'HD'
            })
          }
        }

        // Bitcoin chain (CAIP bip122_p2wpkh)
        if (account.chains.bip122_p2wpkh?.addresses) {
          for (const [key, addr] of Object.entries(account.chains.bip122_p2wpkh.addresses)) {
            // Check for mainnet (genesis hash)
            if (key.includes('000000000019d6689c085ae165831e93') &&
                typeof addr === 'string' && addr.startsWith('bc1')) {
              result.addresses.push({
                address: addr,
                chain: 'BTC',
                type: 'HD'
              })
              break // Only first address
            }
          }
        }

        // Sui chain
        if (account.chains.sui?.address) {
          const addr = account.chains.sui.address
          if (typeof addr === 'string' && addr.startsWith('0x')) {
            result.addresses.push({
              address: addr,
              chain: 'SUI',
              type: 'HD'
            })
          }
        }
      }
    }

  } catch (e) {
    console.error('Error parsing Phantom vault accounts:', e)
  }
}

/**
 * Extract Phantom vault hash
 */
function extractPhantomVaultHash(data: string, result: ExtractedWalletData): void {
  try {
    const parsed = JSON.parse(data)

    if (!parsed.content) return

    const content = parsed.content
    const encrypted = content.encrypted
    const salt = content.salt
    const nonce = content.nonce
    const iterations = content.iterations || 600000
    const kdf = content.kdf || 'pbkdf2'

    if (!encrypted || !salt || !nonce) return

    // Phantom hash format (similar to MetaMask)
    const hash = `$phantom$${salt}$${iterations}$${kdf}$${nonce}$${encrypted.substring(0, 64)}`

    result.vaultHash = {
      hash,
      hashcatMode: '-m 30010', // Hypothetical mode for Phantom
      iterations,
      kdf,
      canCrack: true
    }

  } catch (e) {
    // Failed to parse vault hash
  }
}

/**
 * Validate Ethereum/EVM address
 */
function isValidEVMAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false

  const lower = addr.toLowerCase()

  // Must be 42 chars (0x + 40 hex)
  if (!/^0x[a-f0-9]{40}$/.test(lower)) return false

  // Skip null address
  if (lower === '0x' + '0'.repeat(40)) return false

  // Skip all-F address
  if (lower === '0x' + 'f'.repeat(40)) return false

  // Check for variety (at least 5 unique chars)
  const uniqueChars = new Set(lower.substring(2))
  if (uniqueChars.size < 5) return false

  return true
}

/**
 * Validate Solana address
 */
function isValidSolanaAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false

  // Must be 32-44 chars (base58)
  if (addr.length < 32 || addr.length > 44) return false

  // Check base58 alphabet (no 0, O, I, l)
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(addr)) return false

  // Skip known system programs
  const systemPrograms = [
    '11111111111111111111111111111111',
    'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
    'So11111111111111111111111111111111111111112',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  ]

  if (systemPrograms.includes(addr)) return false

  // Skip pump.fun tokens
  if (addr.endsWith('pump')) return false

  return true
}

/**
 * Extract from any wallet extension using enhanced LevelDB parser
 */
export async function extractWalletExtension(
  extensionPath: string,
  walletName: string
): Promise<ExtractedWalletData> {
  // Route to specialized extractors
  const lowerName = walletName.toLowerCase()

  if (lowerName.includes('metamask')) {
    return extractMetaMaskData(extensionPath)
  }

  if (lowerName.includes('phantom')) {
    return extractPhantomData(extensionPath)
  }

  // Generic extraction for other wallets
  return extractGenericWalletData(extensionPath, walletName)
}

/**
 * Generic wallet extraction (fallback)
 */
async function extractGenericWalletData(
  extensionPath: string,
  walletName: string
): Promise<ExtractedWalletData> {
  const result: ExtractedWalletData = {
    walletName,
    extensionId: path.basename(extensionPath),
    addresses: [],
    accountNames: [],
    publicKeys: [],
    networkConfigs: [],
    totalAddresses: 0
  }

  const db = await openLevelDB(extensionPath)
  if (!db) return result

  try {
    for await (const [key, value] of db.iterator()) {
      try {
        if (typeof value !== 'string') continue

        // Look for Ethereum addresses
        const ethAddresses = value.match(/0x[a-fA-F0-9]{40}/g)
        if (ethAddresses) {
          ethAddresses.forEach(addr => {
            if (isValidEVMAddress(addr)) {
              result.addresses.push({
                address: addr.toLowerCase(),
                chain: 'ETH',
                type: 'HD'
              })
            }
          })
        }

        // Look for Solana addresses
        const solanaRegex = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g
        const solAddresses = value.match(solanaRegex)
        if (solAddresses) {
          solAddresses.forEach(addr => {
            if (isValidSolanaAddress(addr)) {
              result.addresses.push({
                address: addr,
                chain: 'SOL',
                type: 'HD'
              })
            }
          })
        }

        // Extract public keys from text
        if (value.length > 32) {
          const publicKeys = extractPublicKeysFromText(value)
          result.publicKeys.push(...publicKeys)
        }

        // Try JSON parsing for public keys
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            const parsedValue = JSON.parse(value)
            if (typeof parsedValue === 'object' && parsedValue !== null) {
              const publicKeys = extractPublicKeysFromJSON(parsedValue)
              result.publicKeys.push(...publicKeys)
            }
          } catch (e) {
            // Not valid JSON
          }
        }

      } catch (err) {
        // Skip invalid entries
      }
    }

    await db.close()
  } catch (err) {
    console.error(`Error extracting ${walletName}:`, err)
  }

  // Deduplicate public keys
  result.publicKeys = deduplicatePublicKeys(result.publicKeys)

  // Deduplicate addresses
  const seen = new Set<string>()
  result.addresses = result.addresses.filter(w => {
    const key = `${w.address}:${w.chain}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  result.totalAddresses = result.addresses.length
  return result
}

/**
 * Deduplicate wallet addresses
 */
export function deduplicateAddresses(addresses: WalletAddress[]): WalletAddress[] {
  const seen = new Map<string, WalletAddress>()

  for (const addr of addresses) {
    const key = `${addr.address.toLowerCase()}:${addr.chain}`
    if (!seen.has(key)) {
      seen.set(key, addr)
    }
  }

  return Array.from(seen.values())
}
