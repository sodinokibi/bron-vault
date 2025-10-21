import { NextRequest, NextResponse } from "next/server"
import { getCookieSessionsByDevice } from "@/lib/db-cookie-helpers"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/cookie-sessions/[deviceId]
 * Get all cookie sessions for a specific device
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = params

    const sessions = await getCookieSessionsByDevice(deviceId)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: sessions.length,
      sessions,
    })
  } catch (error) {
    console.error("Error fetching cookie sessions:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sessions",
      },
      { status: 500 },
    )
  }
}
