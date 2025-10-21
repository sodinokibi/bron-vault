import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { sanitizePaginationParams } from "@/lib/input-sanitization"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Parse pagination and filter parameters
    const { searchParams } = new URL(request.url)
    const { limit, offset } = sanitizePaginationParams({
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    })

    const batch = searchParams.get("batch") || ""
    const searchQuery = searchParams.get("q") || ""

    // Build WHERE clause
    let whereClause = "WHERE 1=1"
    const queryParams: any[] = []

    if (batch) {
      whereClause += " AND upload_batch = ?"
      queryParams.push(batch)
    }

    if (searchQuery) {
      whereClause += " AND (device_name LIKE ? OR device_id LIKE ?)"
      queryParams.push(`%${searchQuery}%`, `%${searchQuery}%`)
    }

    // Get total count
    const countResult = (await executeQuery(
      `SELECT COUNT(*) as total FROM devices ${whereClause}`,
      queryParams
    )) as any[]

    const total = countResult[0]?.total || 0

    // Get devices with pagination
    const devices = (await executeQuery(
      `SELECT
        d.device_id,
        d.device_name,
        d.upload_date,
        d.upload_batch,
        d.total_files,
        d.total_credentials,
        d.total_domains,
        d.total_urls,
        s.stealer_family,
        s.confidence
       FROM devices d
       LEFT JOIN stealer_metadata s ON d.device_id = s.device_id
       ${whereClause}
       ORDER BY d.upload_date DESC
       LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset]
    )) as any[]

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      devices,
    })
  } catch (error) {
    console.error("Error fetching devices:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch devices",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
