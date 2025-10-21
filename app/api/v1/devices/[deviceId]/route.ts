import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { sanitizeDeviceId } from "@/lib/input-sanitization"

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

    // Get main device info
    const deviceResult = (await executeQuery(
      `SELECT * FROM devices WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    if (!deviceResult || deviceResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    const device = deviceResult[0]

    // Get stealer metadata
    const stealerMetadata = (await executeQuery(
      `SELECT * FROM stealer_metadata WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get file count
    const fileCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM files WHERE device_id = ? AND is_directory = FALSE`,
      [deviceId]
    )) as any[]

    // Get directory count
    const dirCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM files WHERE device_id = ? AND is_directory = TRUE`,
      [deviceId]
    )) as any[]

    // Get credential count
    const credCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM credentials WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get cookie count
    const cookieCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM cookies WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get browser history count
    const historyCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM browser_history WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get bookmarks count
    const bookmarksCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM bookmarks WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get downloads count
    const downloadsCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM downloads WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get Discord tokens count
    const discordCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM discord_tokens WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get Telegram sessions count
    const telegramCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM messenger_tokens WHERE device_id = ? AND messenger_type = 'telegram'`,
      [deviceId]
    )) as any[]

    // Get 2FA count
    const twoFaCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM messenger_tokens WHERE device_id = ? AND messenger_type = 'authenticator'`,
      [deviceId]
    )) as any[]

    // Get crypto wallets count
    const walletsCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM crypto_wallets WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get cookie sessions count
    const sessionsCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM cookie_sessions WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Get high-value session count
    const highValueSessions = (await executeQuery(
      `SELECT COUNT(*) as count FROM cookie_sessions
       WHERE device_id = ? AND session_valid = TRUE
       AND service_category IN ('email', 'financial', 'crypto', 'cloud', 'development')`,
      [deviceId]
    )) as any[]

    // Get software count
    const softwareCount = (await executeQuery(
      `SELECT COUNT(*) as count FROM software WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    // Build comprehensive device object
    const deviceDetails = {
      ...device,
      stealer_info: stealerMetadata.length > 0 ? stealerMetadata[0] : null,
      counts: {
        files: fileCount[0]?.count || 0,
        directories: dirCount[0]?.count || 0,
        credentials: credCount[0]?.count || 0,
        cookies: cookieCount[0]?.count || 0,
        browser_history: historyCount[0]?.count || 0,
        bookmarks: bookmarksCount[0]?.count || 0,
        downloads: downloadsCount[0]?.count || 0,
        discord_tokens: discordCount[0]?.count || 0,
        telegram_sessions: telegramCount[0]?.count || 0,
        two_fa_codes: twoFaCount[0]?.count || 0,
        crypto_wallets: walletsCount[0]?.count || 0,
        cookie_sessions: sessionsCount[0]?.count || 0,
        high_value_sessions: highValueSessions[0]?.count || 0,
        software: softwareCount[0]?.count || 0,
      },
    }

    return NextResponse.json({
      success: true,
      device: deviceDetails,
    })
  } catch (error) {
    console.error("Error fetching device details:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch device details",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
