import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatorDataByDevice } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/messaging/2fa/[deviceId]
 * Get all 2FA/Authenticator data for a specific device
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

    const authData = await getAuthenticatorDataByDevice(deviceId)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: authData.length,
      authenticator_data: authData,
    })
  } catch (error) {
    console.error("Error fetching 2FA data:", error)
    return NextResponse.json({ error: "Failed to fetch 2FA data" }, { status: 500 })
  }
}
