/**
 * LevelDB Parser for Browser Extension Data
 *
 * Extracts data from LevelDB files used by browser extensions
 * (MetaMask, Phantom, and other crypto wallets)
 */

import { readFileSync, readdirSync, existsSync } from "fs"
import path from "path"

export interface LevelDBEntry {
  key: string
  value: any
  raw_key: Buffer
  raw_value: Buffer
}

export interface ParsedWalletData {
  addresses: string[]
  publicKeys: string[]
  accountNames: string[]
  networkConfigs: any[]
  vaultData: any[]
  rawEntries: LevelDBEntry[]
}

/**
 * Parse LevelDB files from extension directory
 *
 * LevelDB uses .log and .ldb files which contain key-value pairs
 * We'll do a best-effort parsing of the binary data
 */
export function parseLevelDBExtension(extensionPath: string, extensionName: string): ParsedWalletData {
  const result: ParsedWalletData = {
    addresses: [],
    publicKeys: [],
    accountNames: [],
    networkConfigs: [],
    vaultData: [],
    rawEntries: []
  }

  if (!existsSync(extensionPath)) {
    return result
  }

  try {
    const files = readdirSync(extensionPath)

    // Look for LevelDB files (.log, .ldb)
    const dbFiles = files.filter(f => f.endsWith('.log') || f.endsWith('.ldb'))

    for (const file of dbFiles) {
      const filePath = path.join(extensionPath, file)

      try {
        const buffer = readFileSync(filePath)

        // Parse entries from buffer
        const entries = extractEntriesFromBuffer(buffer)
        result.rawEntries.push(...entries)

        // Extract wallet-specific data
        for (const entry of entries) {
          extractWalletData(entry, result, extensionName)
        }
      } catch (err) {
        // Skip files that can't be read
        console.error(`Error reading ${file}:`, err)
      }
    }
  } catch (err) {
    console.error(`Error parsing LevelDB for ${extensionName}:`, err)
  }

  return result
}

/**
 * Extract key-value entries from LevelDB buffer
 *
 * LevelDB format (simplified):
 * - Records are stored with length-prefixed keys and values
 * - We'll scan for JSON objects and valid UTF-8 strings
 */
function extractEntriesFromBuffer(buffer: Buffer): LevelDBEntry[] {
  const entries: LevelDBEntry[] = []
  const bufferStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 10 * 1024 * 1024)) // Limit to 10MB

  // Method 1: Look for JSON objects
  const jsonMatches = bufferStr.match(/\{[^{}]*"[^"]+"\s*:\s*[^{}]*\}/g)
  if (jsonMatches) {
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match)
        entries.push({
          key: 'json_object',
          value: parsed,
          raw_key: Buffer.from('json_object'),
          raw_value: Buffer.from(match)
        })
      } catch (err) {
        // Not valid JSON
      }
    }
  }

  // Method 2: Scan for hex keys followed by JSON values (common pattern)
  const hexKeyJsonPattern = /([0-9a-f]{8,64})\x00*(\{[^\x00]+\})/gi
  let match
  while ((match = hexKeyJsonPattern.exec(bufferStr)) !== null) {
    try {
      const key = match[1]
      const value = JSON.parse(match[2])
      entries.push({
        key,
        value,
        raw_key: Buffer.from(key),
        raw_value: Buffer.from(match[2])
      })
    } catch (err) {
      // Skip invalid entries
    }
  }

  // Method 3: Scan binary data for key-value patterns
  for (let i = 0; i < buffer.length - 8; i++) {
    // Look for varint length prefix (common in LevelDB)
    const keyLen = readVarint(buffer, i)
    if (keyLen > 0 && keyLen < 1024 && i + keyLen < buffer.length) {
      const keyStart = i + varintLength(keyLen)
      const keyEnd = keyStart + keyLen
      const key = buffer.slice(keyStart, keyEnd)

      // Try to read value after key
      const valueLenPos = keyEnd
      if (valueLenPos + 4 < buffer.length) {
        const valueLen = readVarint(buffer, valueLenPos)
        if (valueLen > 0 && valueLen < 100 * 1024) { // Max 100KB per value
          const valueStart = valueLenPos + varintLength(valueLen)
          const valueEnd = valueStart + valueLen

          if (valueEnd < buffer.length) {
            const valueBuffer = buffer.slice(valueStart, valueEnd)

            // Try to parse as UTF-8
            try {
              const keyStr = key.toString('utf-8')
              const valueStr = valueBuffer.toString('utf-8')

              // Check if valid UTF-8
              if (isValidUTF8String(keyStr) && isValidUTF8String(valueStr)) {
                let parsedValue: any = valueStr

                // Try to parse as JSON
                if (valueStr.startsWith('{') || valueStr.startsWith('[')) {
                  try {
                    parsedValue = JSON.parse(valueStr)
                  } catch (err) {
                    // Keep as string
                  }
                }

                entries.push({
                  key: keyStr,
                  value: parsedValue,
                  raw_key: key,
                  raw_value: valueBuffer
                })
              }
            } catch (err) {
              // Skip invalid UTF-8
            }
          }
        }
      }
    }
  }

  return entries
}

/**
 * Read varint from buffer (LevelDB uses varints for length encoding)
 */
function readVarint(buffer: Buffer, offset: number): number {
  let result = 0
  let shift = 0
  let byte: number

  do {
    if (offset >= buffer.length) return 0
    byte = buffer[offset++]
    result |= (byte & 0x7f) << shift
    shift += 7
  } while (byte & 0x80 && shift < 64)

  return result
}

/**
 * Get length of varint encoding
 */
function varintLength(value: number): number {
  if (value < 128) return 1
  if (value < 16384) return 2
  if (value < 2097152) return 3
  if (value < 268435456) return 4
  return 5
}

/**
 * Check if string is valid UTF-8
 */
function isValidUTF8String(str: string): boolean {
  // Check if string contains mostly printable characters
  const printableChars = str.replace(/[\x20-\x7E\n\r\t]/g, '').length
  return printableChars / str.length < 0.3 // Allow up to 30% non-printable
}

/**
 * Extract wallet data from LevelDB entry
 */
function extractWalletData(entry: LevelDBEntry, result: ParsedWalletData, extensionName: string): void {
  const { key, value } = entry

  if (typeof value === 'string') {
    // Look for Ethereum addresses
    const ethAddresses = value.match(/0x[a-fA-F0-9]{40}/g)
    if (ethAddresses) {
      result.addresses.push(...ethAddresses)
    }

    // Look for public keys (hex strings 64-132 chars)
    const pubKeys = value.match(/(?:0x)?[a-fA-F0-9]{64,132}/g)
    if (pubKeys) {
      result.publicKeys.push(...pubKeys.filter(k => !ethAddresses?.includes(k)))
    }
  }

  if (typeof value === 'object' && value !== null) {
    // MetaMask specific patterns
    if (extensionName === 'MetaMask') {
      extractMetaMaskData(key, value, result)
    }

    // Phantom specific patterns
    if (extensionName === 'Phantom') {
      extractPhantomData(key, value, result)
    }

    // Generic wallet data extraction
    extractGenericWalletData(value, result)
  }
}

/**
 * Extract MetaMask specific data
 */
function extractMetaMaskData(key: string, value: any, result: ParsedWalletData): void {
  // MetaMask stores data in specific keys
  if (key.includes('vault') || key.includes('KeyringController')) {
    result.vaultData.push(value)
  }

  // Look for account data
  if (value.address && typeof value.address === 'string') {
    result.addresses.push(value.address)
  }

  if (value.name && typeof value.name === 'string') {
    result.accountNames.push(value.name)
  }

  // Network configurations
  if (value.chainId || value.rpcUrl || value.networkId) {
    result.networkConfigs.push(value)
  }
}

/**
 * Extract Phantom specific data
 */
function extractPhantomData(key: string, value: any, result: ParsedWalletData): void {
  // Phantom stores Solana addresses
  if (value.publicKey || value.address) {
    const addr = value.publicKey || value.address
    if (typeof addr === 'string') {
      result.addresses.push(addr)
    }
  }

  // Account names
  if (value.name && typeof value.name === 'string') {
    result.accountNames.push(value.name)
  }
}

/**
 * Extract generic wallet data from nested object
 */
function extractGenericWalletData(obj: any, result: ParsedWalletData): void {
  if (typeof obj !== 'object' || obj === null) return

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()

    // Look for address fields
    if ((lowerKey.includes('address') || lowerKey.includes('account')) && typeof value === 'string') {
      // Ethereum address
      if (value.match(/^0x[a-fA-F0-9]{40}$/)) {
        result.addresses.push(value)
      }
      // Solana address
      else if (value.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)) {
        result.addresses.push(value)
      }
    }

    // Look for public keys
    if (lowerKey.includes('public') && typeof value === 'string') {
      if (value.match(/^(?:0x)?[a-fA-F0-9]{64,132}$/)) {
        result.publicKeys.push(value)
      }
    }

    // Look for account names
    if (lowerKey.includes('name') && typeof value === 'string' && value.length < 100) {
      result.accountNames.push(value)
    }

    // Recurse into nested objects
    if (typeof value === 'object' && value !== null) {
      extractGenericWalletData(value, result)
    }
  }
}

/**
 * Get all unique values from parsed data
 */
export function getUniqueValues(data: ParsedWalletData): ParsedWalletData {
  return {
    addresses: [...new Set(data.addresses)],
    publicKeys: [...new Set(data.publicKeys)],
    accountNames: [...new Set(data.accountNames)],
    networkConfigs: data.networkConfigs,
    vaultData: data.vaultData,
    rawEntries: data.rawEntries
  }
}
