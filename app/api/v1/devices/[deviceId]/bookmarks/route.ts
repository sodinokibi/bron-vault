import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { sanitizeDeviceId, sanitizePaginationParams } from "@/lib/input-sanitization"

export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Sanitize device ID
    const deviceId = sanitizeDeviceId(params.deviceId)

    // Parse pagination parameters
    const { searchParams } = new URL(request.url)
    const { limit, offset } = sanitizePaginationParams({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    })

    const browser = searchParams.get("browser") || ""
    const folder = searchParams.get("folder") || ""

    // Build WHERE clause
    let whereClause = "WHERE device_id = ?"
    const queryParams: any[] = [deviceId]

    if (browser) {
      whereClause += " AND browser LIKE ?"
      queryParams.push(`%${browser}%`)
    }

    if (folder) {
      whereClause += " AND folder LIKE ?"
      queryParams.push(`%${folder}%`)
    }

    // Get total count
    const countResult = (await executeQuery(
      `SELECT COUNT(*) as total FROM bookmarks ${whereClause}`,
      queryParams
    )) as any[]

    const total = countResult[0]?.total || 0

    // Get bookmarks with pagination
    const bookmarks = (await executeQuery(
      `SELECT * FROM bookmarks
       ${whereClause}
       ORDER BY date_added DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )) as any[]

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total,
      limit,
      offset,
      bookmarks,
    })
  } catch (error) {
    console.error("Error fetching bookmarks:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch bookmarks",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
