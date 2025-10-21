import { NextRequest, NextResponse } from "next/server"
import { exportSeedPhrases } from "@/lib/messaging-export"
import path from "path"
import { readFile, mkdir } from "fs/promises"
import { existsSync } from "fs"

/**
 * GET /api/v1/wallets/export/seeds
 * Export all wallet seed phrases to a downloadable file
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
    const filename = `wallet_seeds_${timestamp}.txt`
    const outputPath = path.join(exportsDir, filename)

    // Export seed phrases
    const result = await exportSeedPhrases(outputPath)

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
    console.error("Error exporting wallet seeds:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to export wallet seeds",
      },
      { status: 500 },
    )
  }
}
