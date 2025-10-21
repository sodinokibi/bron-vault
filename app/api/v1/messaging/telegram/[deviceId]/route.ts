import { NextRequest, NextResponse } from "next/server"
import { getTelegramSessionsByDevice } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/messaging/telegram/[deviceId]
 * Get all Telegram sessions for a specific device
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

    const sessions = await getTelegramSessionsByDevice(deviceId)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: sessions.length,
      sessions,
    })
  } catch (error) {
    console.error("Error fetching Telegram sessions:", error)
    return NextResponse.json(
      { error: "Failed to fetch Telegram sessions" },
      { status: 500 },
    )
  }
}
