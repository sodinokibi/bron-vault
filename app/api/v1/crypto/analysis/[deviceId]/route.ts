import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/crypto/analysis/[deviceId]
 *
 * Comprehensive crypto analysis for a device including:
 * - Crypto wallets (extensions, desktop, addresses)
 * - Crypto-related browser history (exchanges, DeFi, NFTs)
 * - Crypto-related cookie sessions
 * - Software that indicates crypto activity
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { deviceId } = params

    // Get device info
    const deviceResults = await executeQuery<any>(
      `SELECT device_id, device_name, upload_date FROM devices WHERE device_id = ? LIMIT 1`,
      [deviceId]
    )

    if (!deviceResults || deviceResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    const device = deviceResults[0]

    // Get crypto wallets with HD wallet and Ledger Live fields
    const wallets = await executeQuery<any>(
      `SELECT
        wallet_type,
        wallet_name,
        address,
        blockchain,
        file_path,
        private_key IS NOT NULL as has_private_key,
        seed_phrase IS NOT NULL as has_seed_phrase,
        public_key,
        account_name,
        extension_id,
        derivation_path,
        seed_id,
        address_index,
        wallet_software,
        ledger_device_model,
        ledger_balance_usd,
        ledger_operations_count
       FROM crypto_wallets
       WHERE device_id = ?
       ORDER BY
         CASE WHEN wallet_type = 'hardware_wallet' THEN 0 ELSE 1 END,
         seed_id DESC,
         address_index ASC,
         wallet_type,
         wallet_name`,
      [deviceId]
    )

    // Get wallet summary
    const walletSummary = await executeQuery<any>(
      `SELECT
        wallet_type,
        wallet_name,
        blockchain,
        COUNT(*) as count
       FROM crypto_wallets
       WHERE device_id = ?
       GROUP BY wallet_type, wallet_name, blockchain`,
      [deviceId]
    )

    // Get crypto-related browser history
    const cryptoHistory = await getCryptoRelatedHistory(deviceId)

    // Get crypto-related cookie sessions
    const cryptoSessions = await executeQuery<any>(
      `SELECT
        service,
        service_category,
        account_identifier,
        session_valid,
        expires_at,
        browser
       FROM cookie_sessions
       WHERE device_id = ?
       AND service_category = 'crypto'
       ORDER BY service`,
      [deviceId]
    )

    // Get crypto-related software
    const cryptoSoftware = await executeQuery<any>(
      `SELECT
        name,
        version,
        install_location
       FROM software
       WHERE device_id = ?
       AND (
         LOWER(name) LIKE '%wallet%' OR
         LOWER(name) LIKE '%metamask%' OR
         LOWER(name) LIKE '%exodus%' OR
         LOWER(name) LIKE '%electrum%' OR
         LOWER(name) LIKE '%binance%' OR
         LOWER(name) LIKE '%coinbase%' OR
         LOWER(name) LIKE '%crypto%' OR
         LOWER(name) LIKE '%bitcoin%' OR
         LOWER(name) LIKE '%ethereum%'
       )
       ORDER BY name`,
      [deviceId]
    )

    // Calculate statistics
    const stats = {
      total_wallets: wallets?.length || 0,
      unique_wallet_types: new Set(wallets?.map((w: any) => w.wallet_name)).size,
      wallets_with_keys: wallets?.filter((w: any) => w.has_private_key || w.has_seed_phrase).length || 0,
      unique_blockchains: new Set(wallets?.filter((w: any) => w.blockchain).map((w: any) => w.blockchain)).size,
      total_crypto_history: cryptoHistory.length,
      total_crypto_sessions: cryptoSessions?.length || 0,
      total_crypto_software: cryptoSoftware?.length || 0,
      crypto_activity_score: calculateCryptoActivityScore({
        wallets: wallets?.length || 0,
        history: cryptoHistory.length,
        sessions: cryptoSessions?.length || 0,
        software: cryptoSoftware?.length || 0
      })
    }

    // Group wallets by type and blockchain
    const walletsByType = groupBy(wallets || [], 'wallet_type')
    const walletsByBlockchain = groupBy(wallets?.filter((w: any) => w.blockchain) || [], 'blockchain')
    const walletsByName = groupBy(wallets || [], 'wallet_name')

    // HD Wallet Analysis - Group by seed_id to find side wallets
    const walletsBySeed = groupBy(wallets?.filter((w: any) => w.seed_id) || [], 'seed_id')
    const seedGroups = Object.entries(walletsBySeed).map(([seed_id, seedWallets]) => ({
      seed_id,
      count: seedWallets.length,
      wallet_software: seedWallets[0]?.wallet_software || 'Unknown',
      blockchains: [...new Set(seedWallets.map((w: any) => w.blockchain).filter(Boolean))],
      addresses: seedWallets.filter((w: any) => w.address).map((w: any) => ({
        address: w.address,
        blockchain: w.blockchain,
        derivation_path: w.derivation_path,
        address_index: w.address_index
      })),
      has_keys: seedWallets.some((w: any) => w.has_private_key || w.has_seed_phrase)
    })).sort((a, b) => b.count - a.count)

    // HD Wallet Statistics
    const hdWalletStats = {
      total_seed_groups: seedGroups.length,
      total_hd_addresses: seedGroups.reduce((sum, g) => sum + g.count, 0),
      seeds_with_multiple_addresses: seedGroups.filter(g => g.count > 1).length,
      max_addresses_per_seed: Math.max(0, ...seedGroups.map(g => g.count)),
      wallet_software_detected: new Set(wallets?.filter((w: any) => w.wallet_software).map((w: any) => w.wallet_software)).size
    }

    // Ledger Live Detection & Statistics
    const ledgerWallets = wallets?.filter((w: any) => w.wallet_type === 'hardware_wallet' && w.wallet_name === 'Ledger Live') || []
    const hasLedger = ledgerWallets.length > 0
    const ledgerStats = hasLedger ? {
      detected: true,
      total_accounts: ledgerWallets.length,
      device_model: ledgerWallets[0]?.ledger_device_model || 'Unknown',
      total_balance_usd: ledgerWallets
        .filter((w: any) => w.ledger_balance_usd)
        .reduce((sum: number, w: any) => sum + parseFloat(w.ledger_balance_usd || '0'), 0),
      currencies: [...new Set(ledgerWallets.map((w: any) => w.blockchain).filter(Boolean))],
      total_operations: ledgerWallets
        .filter((w: any) => w.ledger_operations_count)
        .reduce((sum: number, w: any) => sum + (w.ledger_operations_count || 0), 0),
      accounts: ledgerWallets.map((w: any) => ({
        currency: w.blockchain,
        address: w.address,
        derivation_path: w.derivation_path,
        balance_usd: w.ledger_balance_usd,
        operations_count: w.ledger_operations_count,
        account_name: w.account_name
      }))
    } : {
      detected: false
    }

    // Group history by category
    const historyByCategory = groupBy(cryptoHistory, 'category')

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_name: device.device_name,
      upload_date: device.upload_date,
      stats,
      wallets: {
        all: wallets || [],
        by_type: walletsByType,
        by_blockchain: walletsByBlockchain,
        by_name: walletsByName,
        by_seed: walletsBySeed,
        summary: walletSummary || []
      },
      hd_wallets: {
        seed_groups: seedGroups,
        stats: hdWalletStats
      },
      ledger_live: ledgerStats,
      crypto_history: {
        all: cryptoHistory,
        by_category: historyByCategory,
        top_sites: getTopSites(cryptoHistory)
      },
      crypto_sessions: cryptoSessions || [],
      crypto_software: cryptoSoftware || []
    })

  } catch (error: any) {
    console.error("Error fetching crypto analysis:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch crypto analysis",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Get crypto-related browser history
 */
async function getCryptoRelatedHistory(deviceId: string): Promise<any[]> {
  const cryptoKeywords = [
    // Exchanges
    'binance', 'coinbase', 'kraken', 'bitfinex', 'bitstamp', 'gemini', 'crypto.com',
    'kucoin', 'bybit', 'okx', 'gate.io', 'huobi', 'bittrex', 'poloniex',
    // DeFi
    'uniswap', 'sushiswap', 'pancakeswap', 'curve', 'aave', 'compound', 'makerdao',
    'yearn', '1inch', 'balancer', 'synthetix', 'convex', 'lido', 'rocketpool',
    // Wallets
    'metamask', 'phantom', 'trust', 'exodus', 'ledger', 'trezor',
    // NFT
    'opensea', 'rarible', 'blur', 'looksrare', 'x2y2', 'magiceden',
    // Blockchain explorers
    'etherscan', 'bscscan', 'polygonscan', 'arbiscan', 'optimistic.etherscan',
    'solscan', 'explorer.solana', 'blockchain.com',
    // Other
    'coingecko', 'coinmarketcap', 'defillama', 'dexscreener', 'dune'
  ]

  const conditions = cryptoKeywords.map(() => 'LOWER(url) LIKE ?').join(' OR ')
  const params = [deviceId, ...cryptoKeywords.map(kw => `%${kw}%`)]

  const results = await executeQuery<any>(
    `SELECT
      url,
      title,
      visit_count,
      last_visit_time,
      browser
     FROM browser_history
     WHERE device_id = ?
     AND (${conditions})
     ORDER BY visit_count DESC, last_visit_time DESC
     LIMIT 500`,
    params
  )

  if (!results) return []

  // Categorize URLs
  return results.map((row: any) => {
    const url = row.url.toLowerCase()
    let category = 'Other'

    if (url.includes('binance') || url.includes('coinbase') || url.includes('kraken') ||
        url.includes('bitfinex') || url.includes('gemini') || url.includes('crypto.com') ||
        url.includes('kucoin') || url.includes('bybit') || url.includes('okx')) {
      category = 'Exchange'
    } else if (url.includes('uniswap') || url.includes('sushiswap') || url.includes('pancakeswap') ||
               url.includes('curve') || url.includes('aave') || url.includes('compound')) {
      category = 'DeFi'
    } else if (url.includes('opensea') || url.includes('rarible') || url.includes('blur') ||
               url.includes('looksrare') || url.includes('magiceden')) {
      category = 'NFT'
    } else if (url.includes('etherscan') || url.includes('bscscan') || url.includes('polygonscan') ||
               url.includes('solscan') || url.includes('explorer') || url.includes('blockchain.com')) {
      category = 'Explorer'
    } else if (url.includes('metamask') || url.includes('phantom') || url.includes('trust') ||
               url.includes('exodus') || url.includes('ledger')) {
      category = 'Wallet'
    }

    return {
      ...row,
      category
    }
  })
}

/**
 * Calculate crypto activity score (0-100)
 */
function calculateCryptoActivityScore(data: {
  wallets: number
  history: number
  sessions: number
  software: number
}): number {
  let score = 0

  // Wallets (0-40 points)
  score += Math.min(40, data.wallets * 5)

  // History (0-30 points)
  score += Math.min(30, data.history * 0.3)

  // Sessions (0-20 points)
  score += Math.min(20, data.sessions * 4)

  // Software (0-10 points)
  score += Math.min(10, data.software * 2)

  return Math.round(score)
}

/**
 * Group array by key
 */
function groupBy(array: any[], key: string): Record<string, any[]> {
  return array.reduce((result, item) => {
    const groupKey = item[key] || 'unknown'
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, any[]>)
}

/**
 * Get top visited crypto sites
 */
function getTopSites(history: any[]): Array<{ domain: string; visits: number; category: string }> {
  const domains: Record<string, { visits: number; category: string }> = {}

  for (const item of history) {
    try {
      const url = new URL(item.url)
      const domain = url.hostname

      if (!domains[domain]) {
        domains[domain] = { visits: 0, category: item.category }
      }
      domains[domain].visits += item.visit_count || 1
    } catch (err) {
      // Invalid URL
    }
  }

  return Object.entries(domains)
    .map(([domain, data]) => ({ domain, ...data }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20)
}
