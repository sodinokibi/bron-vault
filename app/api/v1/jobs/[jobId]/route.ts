import { type NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { getJobStatus, getUploadJob } from "@/lib/upload-queue"

// Route segment config
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET job status
export async function GET(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    // Validate authentication
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = params

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
    }

    // Get job status
    const status = await getJobStatus(jobId)

    if (!status) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Return job status
    return NextResponse.json({
      success: true,
      job: {
        id: status.jobId,
        state: status.state,
        progress: status.progress,
        data: {
          filename: status.data.filename,
          uploadBatch: status.data.uploadBatch,
        },
        result: status.result,
        error: status.failedReason,
        timestamps: {
          created: status.timestamp,
          started: status.processedOn,
          finished: status.finishedOn,
        },
      },
    })
  } catch (error) {
    console.error("❌ Job status error:", error)
    return NextResponse.json(
      {
        error: "Failed to get job status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// DELETE job (cancel if in progress, remove if completed/failed)
export async function DELETE(request: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    // Validate authentication
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { jobId } = params

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 })
    }

    // Get job
    const job = await getUploadJob(jobId)

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // Check job state
    const state = await job.getState()

    if (state === "active" || state === "waiting") {
      // Cancel job
      await job.remove()
      return NextResponse.json({
        success: true,
        message: "Job cancelled",
        jobId,
      })
    } else {
      // Remove completed/failed job
      await job.remove()
      return NextResponse.json({
        success: true,
        message: "Job removed",
        jobId,
      })
    }
  } catch (error) {
    console.error("❌ Job deletion error:", error)
    return NextResponse.json(
      {
        error: "Failed to delete job",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
