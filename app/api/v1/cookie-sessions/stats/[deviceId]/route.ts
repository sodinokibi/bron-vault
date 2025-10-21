import { NextRequest, NextResponse } from "next/server"
import { getCookieSessionStats } from "@/lib/db-cookie-helpers"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/cookie-sessions/stats/[deviceId]
 * Get cookie session statistics for a specific device
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

    const stats = await getCookieSessionStats(deviceId)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      stats,
    })
  } catch (error) {
    console.error("Error fetching cookie session stats:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stats",
      },
      { status: 500 },
    )
  }
}
