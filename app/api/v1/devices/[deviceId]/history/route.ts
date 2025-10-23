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
    const searchQuery = searchParams.get("q") || ""
    const categoryFilter = searchParams.get("category") || ""
    const riskFilter = searchParams.get("risk") || ""

    // Build WHERE clause
    let whereClause = "WHERE device_id = ?"
    const queryParams: any[] = [deviceId]

    if (browser) {
      whereClause += " AND browser LIKE ?"
      queryParams.push(`%${browser}%`)
    }

    if (searchQuery) {
      whereClause += " AND (url LIKE ? OR title LIKE ?)"
      queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`)
    }

    if (categoryFilter) {
      const categories = categoryFilter.split(",").map(c => c.trim())
      const categoryConditions = categories.map(() => "primary_category = ?")
      whereClause += ` AND (${categoryConditions.join(" OR ")})`
      queryParams.push(...categories)
    }

    if (riskFilter) {
      const riskLevels = riskFilter.split(",").map(r => r.trim())
      const riskConditions = riskLevels.map(() => "risk_level = ?")
      whereClause += ` AND (${riskConditions.join(" OR ")})`
      queryParams.push(...riskLevels)
    }

    // Get total count
    const countResult = (await executeQuery(
      `SELECT COUNT(*) as total FROM browser_history ${whereClause}`,
      queryParams
    )) as any[]

    const total = countResult[0]?.total || 0

    // Get browser history with pagination
    const history = (await executeQuery(
      `SELECT * FROM browser_history
       ${whereClause}
       ORDER BY visit_time DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )) as any[]

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total,
      limit,
      offset,
      history,
    })
  } catch (error) {
    console.error("Error fetching browser history:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch browser history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
