import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { checkAPIPermission } from "@/lib/api-auth"
import { queueUploadJob } from "@/lib/upload-queue"
import { detectArchiveType, getSupportedExtensionsDisplay } from "@/lib/archive-handler"
import { initializeDatabase } from "@/lib/mysql"

// Route segment config
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

/**
 * POST /api/v1/external/upload
 * Upload archive file using API key authentication
 *
 * This endpoint accepts:
 * 1. Binary upload (Content-Type: application/octet-stream)
 * 2. Multipart form data (for compatibility)
 *
 * Headers:
 * - X-API-Key: Your API key (required)
 * - X-Filename: Filename with extension (required)
 * - X-Archive-Password: Password for encrypted archives (optional)
 * - Content-Type: application/octet-stream or multipart/form-data
 */
export async function POST(request: NextRequest) {
  try {
    // Check API key and permissions
    const authResult = await checkAPIPermission(request, "upload")

    if (!authResult.authorized || !authResult.user) {
      return NextResponse.json(
        {
          error: authResult.error || "Unauthorized",
        },
        { status: 401 },
      )
    }

    const user = authResult.user

    await initializeDatabase()

    // Get filename from header
    const filename = request.headers.get("X-Filename")
    if (!filename) {
      return NextResponse.json(
        {
          error: "Missing X-Filename header",
          hint: "Provide filename with extension, e.g., 'logs.zip'",
        },
        { status: 400 },
      )
    }

    // Get optional password
    const password = request.headers.get("X-Archive-Password") || null

    // Detect archive type
    const archiveType = detectArchiveType(filename)
    if (!archiveType) {
      return NextResponse.json(
        {
          error: `Unsupported file format. Supported formats: ${getSupportedExtensionsDisplay()}`,
          filename,
        },
        { status: 400 },
      )
    }

    console.log(`📦 API Upload: ${filename} (${archiveType}) from user ${user.userId}`)
    if (password) {
      console.log(`🔐 Password provided for encrypted archive`)
    }

    // Create uploads directory
    const uploadsDir = path.join(process.cwd(), "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Read file data
    const contentType = request.headers.get("content-type") || ""
    let fileData: Buffer

    if (contentType.includes("multipart/form-data")) {
      // Handle multipart form data
      const formData = await request.formData()
      const file = formData.get("file") as File

      if (!file) {
        return NextResponse.json({ error: "No file in form data" }, { status: 400 })
      }

      const bytes = await file.arrayBuffer()
      fileData = Buffer.from(bytes)
    } else {
      // Handle binary upload
      const bytes = await request.arrayBuffer()
      fileData = Buffer.from(bytes)
    }

    if (fileData.length === 0) {
      return NextResponse.json({ error: "Empty file" }, { status: 400 })
    }

    console.log(`📊 File size: ${fileData.length} bytes (${(fileData.length / 1024 / 1024).toFixed(2)} MB)`)

    // Save file
    const uploadBatch = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const filePath = path.join(uploadsDir, `${uploadBatch}_${filename}`)
    await writeFile(filePath, fileData)

    console.log(`💾 File saved: ${filePath}`)

    // Queue for processing
    const jobId = await queueUploadJob({
      filePath,
      userId: user.userId,
      username: user.username,
      filename,
      uploadBatch,
      password,
      archiveType,
    })

    console.log(`📋 Upload job queued: ${jobId}`)

    return NextResponse.json({
      success: true,
      job_id: jobId,
      filename,
      archive_type: archiveType,
      size_bytes: fileData.length,
      size_mb: parseFloat((fileData.length / 1024 / 1024).toFixed(2)),
      status_url: `/api/v1/jobs/${jobId}`,
      message: "Upload queued for processing",
    })
  } catch (error) {
    console.error("❌ API upload error:", error)
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/**
 * GET /api/v1/external/upload
 * Get upload endpoint information
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: "/api/v1/external/upload",
    method: "POST",
    authentication: "API Key (X-API-Key header)",
    supported_formats: getSupportedExtensionsDisplay(),
    required_headers: {
      "X-API-Key": "Your API key",
      "X-Filename": "Filename with extension (e.g., logs.zip)",
    },
    optional_headers: {
      "X-Archive-Password": "Password for encrypted archives",
      "Content-Type": "application/octet-stream or multipart/form-data",
    },
    example_curl: `curl -X POST https://your-domain.com/api/v1/external/upload \\
  -H "X-API-Key: bv_your_api_key_here" \\
  -H "X-Filename: logs.zip" \\
  -H "X-Archive-Password: infected" \\
  -H "Content-Type: application/octet-stream" \\
  --data-binary "@logs.zip"`,
    response: {
      success: true,
      job_id: "upload_1234567890_abc123",
      filename: "logs.zip",
      archive_type: ".zip",
      size_bytes: 1048576,
      size_mb: 1.0,
      status_url: "/api/v1/jobs/upload_1234567890_abc123",
      message: "Upload queued for processing",
    },
  })
}
