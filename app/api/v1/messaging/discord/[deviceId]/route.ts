import { NextRequest, NextResponse } from "next/server"
import { getDiscordTokensByDevice } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/messaging/discord/[deviceId]
 * Get all Discord tokens for a specific device
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

    const tokens = await getDiscordTokensByDevice(deviceId)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: tokens.length,
      tokens,
    })
  } catch (error) {
    console.error("Error fetching Discord tokens:", error)
    return NextResponse.json(
      { error: "Failed to fetch Discord tokens" },
      { status: 500 },
    )
  }
}
