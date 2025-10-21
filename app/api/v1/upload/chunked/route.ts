import { type NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile, unlink, readdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"
import { validateRequest } from "@/lib/auth"
import { queueUploadJob } from "@/lib/upload-queue"

// Route segment config for large file uploads
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes max per chunk

// Chunked upload handler
export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Extract chunk metadata from headers
    const uploadId = request.headers.get("X-Upload-ID")
    const chunkNumber = parseInt(request.headers.get("X-Chunk-Number") || "0")
    const totalChunks = parseInt(request.headers.get("X-Total-Chunks") || "1")
    const filename = request.headers.get("X-Filename") || "upload.zip"
    const chunkHash = request.headers.get("X-Chunk-Hash") || null // Optional: for integrity check

    // Validate inputs
    if (!uploadId) {
      return NextResponse.json({ error: "Missing X-Upload-ID header" }, { status: 400 })
    }

    if (isNaN(chunkNumber) || isNaN(totalChunks)) {
      return NextResponse.json({ error: "Invalid chunk numbers" }, { status: 400 })
    }

    if (chunkNumber >= totalChunks || chunkNumber < 0) {
      return NextResponse.json({ error: "Invalid chunk number" }, { status: 400 })
    }

    // Create chunks directory
    const chunksDir = path.join(process.cwd(), "uploads", "chunks", uploadId)
    if (!existsSync(chunksDir)) {
      await mkdir(chunksDir, { recursive: true })
    }

    // Save chunk
    const chunkPath = path.join(chunksDir, `chunk_${chunkNumber.toString().padStart(5, "0")}`)
    const bytes = await request.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Optional: Verify chunk integrity
    if (chunkHash) {
      const calculatedHash = crypto.createHash("sha256").update(buffer).digest("hex")
      if (calculatedHash !== chunkHash) {
        return NextResponse.json({ error: "Chunk integrity check failed" }, { status: 400 })
      }
    }

    await writeFile(chunkPath, buffer)

    console.log(`📦 Saved chunk ${chunkNumber + 1}/${totalChunks} for upload ${uploadId}`)

    // Check if this is the last chunk
    if (chunkNumber === totalChunks - 1) {
      // Wait a bit to ensure all chunks are written
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Verify all chunks are present
      const files = await readdir(chunksDir)
      const chunkFiles = files.filter((f) => f.startsWith("chunk_")).sort()

      if (chunkFiles.length !== totalChunks) {
        return NextResponse.json(
          {
            error: `Missing chunks: expected ${totalChunks}, got ${chunkFiles.length}`,
            received: chunkFiles.length,
            expected: totalChunks,
          },
          { status: 400 },
        )
      }

      console.log(`🔗 Reassembling ${totalChunks} chunks for ${filename}...`)

      // Reassemble file
      const finalPath = path.join(process.cwd(), "uploads", `${uploadId}_${filename}`)
      const writeStream = require("fs").createWriteStream(finalPath)

      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = path.join(chunksDir, `chunk_${i.toString().padStart(5, "0")}`)
        const chunkData = await readFile(chunkFile)
        writeStream.write(chunkData)
      }

      writeStream.end()

      // Wait for write to complete
      await new Promise((resolve, reject) => {
        writeStream.on("finish", resolve)
        writeStream.on("error", reject)
      })

      console.log(`✅ File reassembled: ${finalPath}`)

      // Clean up chunks
      for (const chunkFile of chunkFiles) {
        await unlink(path.join(chunksDir, chunkFile))
      }

      try {
        await unlink(chunksDir) // Remove empty directory
      } catch (err) {
        // Directory might not be empty or already deleted
        console.log("Could not remove chunks directory:", err)
      }

      console.log(`🧹 Cleaned up ${chunkFiles.length} chunk files`)

      // Queue for processing
      const uploadBatch = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const jobId = await queueUploadJob({
        filePath: finalPath,
        userId: user.userId,
        username: user.username,
        filename,
        uploadBatch,
      })

      console.log(`📋 Queued upload job: ${jobId}`)

      return NextResponse.json({
        success: true,
        uploadId,
        jobId,
        status: "complete",
        message: "Upload complete, processing queued",
        statusUrl: `/api/v1/jobs/${jobId}`,
      })
    }

    // Return progress for non-final chunks
    return NextResponse.json({
      success: true,
      uploadId,
      chunk: chunkNumber + 1,
      total: totalChunks,
      status: "in_progress",
      progress: ((chunkNumber + 1) / totalChunks) * 100,
    })
  } catch (error) {
    console.error("❌ Chunked upload error:", error)
    return NextResponse.json(
      {
        error: "Upload failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// GET endpoint to check upload status
export async function GET(request: NextRequest) {
  try {
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get("uploadId")

    if (!uploadId) {
      return NextResponse.json({ error: "Missing uploadId parameter" }, { status: 400 })
    }

    const chunksDir = path.join(process.cwd(), "uploads", "chunks", uploadId)

    if (!existsSync(chunksDir)) {
      return NextResponse.json({
        exists: false,
        chunksReceived: 0,
      })
    }

    const files = await readdir(chunksDir)
    const chunkFiles = files.filter((f) => f.startsWith("chunk_"))

    return NextResponse.json({
      exists: true,
      chunksReceived: chunkFiles.length,
    })
  } catch (error) {
    console.error("❌ Upload status check error:", error)
    return NextResponse.json(
      {
        error: "Status check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
