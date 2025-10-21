import { NextRequest, NextResponse } from "next/server"
import { export2FAData } from "@/lib/messaging-export"
import path from "path"
import { readFile, mkdir } from "fs/promises"
import { existsSync } from "fs"

/**
 * GET /api/v1/messaging/2fa/export
 * Export all 2FA/authenticator data to a downloadable file
 */
export async function GET(request: NextRequest) {
  try {
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(process.cwd(), "exports")
    if (!existsSync(exportsDir)) {
      await mkdir(exportsDir, { recursive: true })
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const filename = `2fa_secrets_${timestamp}.txt`
    const outputPath = path.join(exportsDir, filename)

    // Export 2FA data
    const result = await export2FAData(outputPath)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Export failed",
        },
        { status: 400 },
      )
    }

    // Read the file and return as download
    const fileContent = await readFile(outputPath, "utf-8")

    return new NextResponse(fileContent, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Error exporting 2FA data:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export 2FA data",
      },
      { status: 500 },
    )
  }
}
