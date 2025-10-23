/**
 * Enhanced Wallet Parser Integration
 *
 * Integrates the enhanced LevelDB extractor with existing wallet-parser.ts
 * Provides backward compatibility while adding vault hash extraction
 */

import { existsSync, readdirSync } from 'fs'
import path from 'path'
import {
  extractWalletExtension,
  deduplicateAddresses,
  type ExtractedWalletData,
  type WalletAddress,
  type VaultHash
} from './leveldb-wallet-extractor'
import { CryptoWallet } from './wallet-parser'

/**
 * Known wallet browser extensions (from wallet-parser.ts)
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
 * Convert extracted wallet data to CryptoWallet format
 */
function convertToCryptoWallet(
  extracted: ExtractedWalletData,
  extensionPath: string
): CryptoWallet[] {
  const wallets: CryptoWallet[] = []

  // Convert addresses
  for (const addr of extracted.addresses) {
    const wallet: CryptoWallet = {
      wallet_type: 'browser_extension',
      wallet_name: extracted.walletName,
      address: addr.address,
      blockchain: addr.chain,
      file_path: extensionPath,
      extension_id: extracted.extensionId
    }

    // Add derivation path if available
    if (addr.derivationPath) {
      wallet.derivation_path = addr.derivationPath
    }

    // Add address index
    if (addr.index !== undefined) {
      wallet.address_index = addr.index
    }

    // Determine wallet software
    wallet.wallet_software = extracted.walletName

    wallets.push(wallet)
  }

  // Add vault data if available
  if (extracted.vaultHash) {
    wallets.push({
      wallet_type: 'browser_extension',
      wallet_name: extracted.walletName,
      vault_data: JSON.stringify({
        hash: extracted.vaultHash.hash,
        hashcat_mode: extracted.vaultHash.hashcatMode,
        iterations: extracted.vaultHash.iterations,
        kdf: extracted.vaultHash.kdf,
        can_crack: extracted.vaultHash.canCrack
      }),
      file_path: extensionPath,
      extension_id: extracted.extensionId,
      wallet_software: extracted.walletName
    })
  }

  // Add account names
  for (const accountName of extracted.accountNames) {
    const existingWallet = wallets.find(w =>
      w.extension_id === extracted.extensionId &&
      !w.account_name
    )

    if (existingWallet) {
      existingWallet.account_name = accountName
    }
  }

  return wallets
}

/**
 * Parse browser wallet extensions with enhanced LevelDB extraction
 *
 * This function replaces parseBrowserWalletExtensions from wallet-parser.ts
 * Uses proper LevelDB library for better accuracy
 */
export async function parseEnhancedBrowserWallets(
  browserDataPath: string
): Promise<CryptoWallet[]> {
  const wallets: CryptoWallet[] = []

  try {
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
          console.log(`🔍 Extracting ${walletName} with enhanced LevelDB parser...`)

          // Use enhanced extractor
          const extracted = await extractWalletExtension(extensionPath, walletName)

          if (extracted.totalAddresses > 0 || extracted.vaultHash) {
            console.log(`✅ ${walletName}: ${extracted.totalAddresses} addresses`)

            if (extracted.vaultHash) {
              console.log(`   🔐 Vault hash extracted (${extracted.vaultHash.hashcatMode})`)
              console.log(`   ⚠️  Can crack with: hashcat ${extracted.vaultHash.hashcatMode} hash.txt wordlist.txt`)
            }

            // Convert to CryptoWallet format
            const converted = convertToCryptoWallet(extracted, extensionPath)
            wallets.push(...converted)
          }

        } catch (err) {
          console.error(`⚠️  Enhanced extraction failed for ${walletName}:`, err)
          // Could fall back to old parser here if needed
        }
      }
    }
  } catch (err) {
    console.error("❌ Error parsing browser wallet extensions:", err)
  }

  return wallets
}

/**
 * Export vault hashes for hashcat cracking
 *
 * Saves vault hashes to a file for offline password cracking
 */
export function exportVaultHashes(wallets: CryptoWallet[]): {
  metamask: string[]
  phantom: string[]
  other: string[]
} {
  const hashes = {
    metamask: [] as string[],
    phantom: [] as string[],
    other: [] as string[]
  }

  for (const wallet of wallets) {
    if (!wallet.vault_data) continue

    try {
      const vaultData = JSON.parse(wallet.vault_data)
      if (!vaultData.hash) continue

      const walletNameLower = wallet.wallet_name.toLowerCase()

      if (walletNameLower.includes('metamask')) {
        hashes.metamask.push(vaultData.hash)
      } else if (walletNameLower.includes('phantom')) {
        hashes.phantom.push(vaultData.hash)
      } else {
        hashes.other.push(vaultData.hash)
      }
    } catch (err) {
      // Skip invalid vault data
    }
  }

  return hashes
}

/**
 * Analyze vault crack-ability
 *
 * Estimates time to crack based on password complexity assumptions
 */
export function analyzeVaultCrackability(vaultData: any): {
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Infeasible'
  estimatedTime: {
    weak: string
    medium: string
    strong: string
  }
  recommendation: string
} {
  const iterations = vaultData.iterations || 600000
  const hashrate = 1_000_000_000 // 1 GH/s (RTX 4090 ballpark)

  // Keyspace estimates
  const weak = Math.pow(62, 8) // 8 char alphanumeric
  const medium = Math.pow(95, 12) // 12 char all printable
  const strong = Math.pow(95, 16) // 16 char all printable

  // Time = keyspace * iterations / hashrate
  const weakTime = (weak * iterations) / hashrate
  const mediumTime = (medium * iterations) / hashrate
  const strongTime = (strong * iterations) / hashrate

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(0)} seconds`
    if (seconds < 3600) return `${(seconds / 60).toFixed(0)} minutes`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`
    if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`
    return `${(seconds / 31536000).toFixed(1)} years`
  }

  let difficulty: 'Easy' | 'Medium' | 'Hard' | 'Infeasible'
  let recommendation: string

  if (iterations < 100000) {
    difficulty = 'Easy'
    recommendation = 'Weak KDF - vulnerable to brute force even with strong passwords'
  } else if (iterations < 600000) {
    difficulty = 'Medium'
    recommendation = 'Moderate KDF - weak passwords crackable'
  } else {
    difficulty = 'Hard'
    recommendation = 'Strong KDF (600k+ iterations) - only weak passwords crackable'
  }

  return {
    difficulty,
    estimatedTime: {
      weak: formatTime(weakTime),
      medium: formatTime(mediumTime),
      strong: formatTime(strongTime)
    },
    recommendation
  }
}

/**
 * Generate vault cracking report
 */
export function generateVaultCrackingReport(wallets: CryptoWallet[]): string {
  const vaultHashes = exportVaultHashes(wallets)
  let report = '# WALLET VAULT CRACKING ANALYSIS\n\n'

  const totalVaults = vaultHashes.metamask.length + vaultHashes.phantom.length + vaultHashes.other.length

  if (totalVaults === 0) {
    return report + 'No vault hashes found.\n'
  }

  report += `## Summary\n\n`
  report += `- Total vault hashes: ${totalVaults}\n`
  report += `- MetaMask: ${vaultHashes.metamask.length}\n`
  report += `- Phantom: ${vaultHashes.phantom.length}\n`
  report += `- Other: ${vaultHashes.other.length}\n\n`

  // MetaMask vaults
  if (vaultHashes.metamask.length > 0) {
    report += `## MetaMask Vaults\n\n`
    report += `**Hashcat Command:**\n\`\`\`bash\n`
    report += `hashcat -m 26600 metamask_hashes.txt wordlist.txt\n`
    report += `# OR for custom iterations:\n`
    report += `hashcat -m 26620 metamask_hashes.txt wordlist.txt\n`
    report += `\`\`\`\n\n`

    vaultHashes.metamask.forEach((hash, i) => {
      report += `### Vault ${i + 1}\n`
      report += `\`\`\`\n${hash}\n\`\`\`\n\n`

      // Analyze crack-ability
      const wallet = wallets.find(w =>
        w.vault_data && JSON.parse(w.vault_data).hash === hash
      )

      if (wallet) {
        try {
          const vaultData = JSON.parse(wallet.vault_data!)
          const analysis = analyzeVaultCrackability(vaultData)

          report += `**Crack-ability:** ${analysis.difficulty}\n\n`
          report += `**Estimated Time:**\n`
          report += `- Weak password (8 char): ${analysis.estimatedTime.weak}\n`
          report += `- Medium password (12 char): ${analysis.estimatedTime.medium}\n`
          report += `- Strong password (16+ char): ${analysis.estimatedTime.strong}\n\n`
          report += `**Recommendation:** ${analysis.recommendation}\n\n`
        } catch (e) {
          // Skip analysis
        }
      }
    })
  }

  // Phantom vaults
  if (vaultHashes.phantom.length > 0) {
    report += `## Phantom Vaults\n\n`
    report += `**Hashcat Command:**\n\`\`\`bash\n`
    report += `hashcat -m 30010 phantom_hashes.txt wordlist.txt\n`
    report += `# Note: Mode 30010 is hypothetical - Phantom may need custom hashcat module\n`
    report += `\`\`\`\n\n`

    vaultHashes.phantom.forEach((hash, i) => {
      report += `### Vault ${i + 1}\n`
      report += `\`\`\`\n${hash}\n\`\`\`\n\n`
    })
  }

  report += `\n---\n\n`
  report += `**DISCLAIMER:** This analysis is for defensive security research and incident response only.\n`
  report += `Use only on systems you own or have explicit authorization to analyze.\n`

  return report
}
