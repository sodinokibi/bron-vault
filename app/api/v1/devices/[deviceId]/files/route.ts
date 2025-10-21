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

    // Get all files for tree view
    const files = (await executeQuery(
      `SELECT file_path, file_name, parent_path, is_directory, file_size,
              CASE WHEN content IS NOT NULL OR local_file_path IS NOT NULL THEN 1 ELSE 0 END as has_content
       FROM files
       WHERE device_id = ?
       ORDER BY file_path`,
      [deviceId]
    )) as any[]

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total: files.length,
      files,
    })
  } catch (error) {
    console.error("Error fetching files:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch files",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
