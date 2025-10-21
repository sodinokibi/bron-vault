import { type NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { getQueueStats } from "@/lib/upload-queue"

// Route segment config
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET queue statistics
export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get queue stats
    const stats = await getQueueStats()

    return NextResponse.json({
      success: true,
      stats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ Queue stats error:", error)
    return NextResponse.json(
      {
        error: "Failed to get queue stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
