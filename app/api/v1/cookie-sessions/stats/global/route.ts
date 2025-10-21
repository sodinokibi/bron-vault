import { NextRequest, NextResponse } from "next/server"
import { getGlobalCookieSessionStats } from "@/lib/db-cookie-helpers"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/cookie-sessions/stats/global
 * Get global cookie session statistics across all devices
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const stats = await getGlobalCookieSessionStats()

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error("Error fetching global cookie session stats:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stats",
      },
      { status: 500 },
    )
  }
}
