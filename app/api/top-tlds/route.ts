import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { getCachedData, setCachedData } from "@/lib/cache-helper"

export async function GET(request: NextRequest) {
  console.log("🔍 [TOP-TLDS] API called")

  // Validate authentication
  const user = await validateRequest(request)
  console.log("🔍 [TOP-TLDS] Auth validation result:", user ? "SUCCESS" : "FAILED")

  if (!user) {
    console.log("❌ [TOP-TLDS] Unauthorized - no valid user found")
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("📊 [TOP-TLDS] Loading top TLDs for user:", (user as any).username || "<unknown>")

    // Check cache first (Redis primary, MySQL fallback)
    console.log("📊 [TOP-TLDS] Checking cache...")
    const cached = await getCachedData<any>("top_tlds")

    if (cached) {
      console.log("📊 [TOP-TLDS] Using cached top TLDs")
      return NextResponse.json(cached)
    }

    console.log("📊 [TOP-TLDS] Calculating fresh top TLDs...")

    // Get top TLDs from credentials table
    const topTlds = await executeQuery(`
      SELECT 
        tld,
        COUNT(*) as count,
        COUNT(DISTINCT device_id) as affected_devices
      FROM credentials 
      WHERE tld IS NOT NULL 
        AND tld != ''
        AND tld NOT LIKE '%localhost%'
        AND tld NOT LIKE '%127.0.0.1%'
        AND tld NOT LIKE '%192.168%'
        AND tld NOT LIKE '%10.%'
      GROUP BY tld 
      ORDER BY count DESC, affected_devices DESC
      LIMIT 10
    `)

    console.log(
      `📊 [TOP-TLDS] Found ${Array.isArray(topTlds) ? (topTlds as any[]).length : "?"} top TLDs`,
    )
    console.log("📊 [TOP-TLDS] Sample data:", Array.isArray(topTlds) ? (topTlds as any[]).slice(0, 2) : topTlds)

    // Cache for 10 minutes (Redis primary, MySQL fallback)
    console.log("📊 [TOP-TLDS] Caching results...")
    await setCachedData("top_tlds", topTlds, { ttlMinutes: 10 })

    console.log("📊 [TOP-TLDS] Returning fresh data")
    return NextResponse.json(topTlds)
  } catch (error) {
    console.error("❌ [TOP-TLDS] Error:", error)
    return NextResponse.json(
      {
        error: "Failed to get top TLDs",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
