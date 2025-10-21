import { Queue, Worker, Job } from "bullmq"
import { getRedisConnection } from "./redis"
import { executeQuery } from "./mysql"
import { processArchiveFile } from "./multi-format-processor"
import { detectArchiveType, type ArchiveFormat } from "./archive-handler"

// Job data interface
export interface UploadJobData {
  filePath: string
  userId: string
  username: string
  filename: string
  uploadBatch: string
  sessionId?: string
  password?: string | null
  archiveType?: ArchiveFormat
}

// Job result interface
export interface UploadJobResult {
  success: boolean
  devicesProcessed: number
  totalFiles: number
  totalCredentials: number
  totalDomains: number
  totalUrls: number
  error?: string
}

// Create upload queue
const connection = getRedisConnection()

export const uploadQueue = new Queue<UploadJobData, UploadJobResult>("uploads", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
    },
  },
})

// Queue upload job
export async function queueUploadJob(data: UploadJobData): Promise<string> {
  const job = await uploadQueue.add("process-upload", data, {
    jobId: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  })

  console.log(`📋 Upload job queued: ${job.id}`)
  return job.id as string
}

// Get job by ID
export async function getUploadJob(jobId: string): Promise<Job<UploadJobData, UploadJobResult> | undefined> {
  return await uploadQueue.getJob(jobId)
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await uploadQueue.getJob(jobId)

  if (!job) {
    return null
  }

  const state = await job.getState()
  const progress = job.progress || 0
  const data = job.data
  const result = job.returnvalue

  return {
    jobId: job.id,
    state,
    progress,
    data,
    result,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }
}

// Process upload job (worker)
let uploadWorker: Worker<UploadJobData, UploadJobResult> | null = null

export function startUploadWorker() {
  if (uploadWorker) {
    console.log("⚠️ Upload worker already running")
    return uploadWorker
  }

  console.log("🔨 Starting upload worker...")

  uploadWorker = new Worker<UploadJobData, UploadJobResult>(
    "uploads",
    async (job: Job<UploadJobData, UploadJobResult>) => {
      const { filePath, userId, username, filename, uploadBatch, sessionId, password, archiveType } = job.data

      console.log(`🚀 Processing upload job ${job.id}: ${filename}`)

      try {
        // Update progress
        await job.updateProgress(5)

        // Detect archive type if not provided
        const detectedType = archiveType || detectArchiveType(filename)

        if (!detectedType) {
          throw new Error(`Unsupported archive format: ${filename}`)
        }

        console.log(`📦 Archive type: ${detectedType}`)

        // Process the archive file
        const result = await processArchiveFile(
          filePath,
          detectedType,
          uploadBatch,
          password || null,
          async (progress, message) => {
            await job.updateProgress(progress)
            console.log(`[Job ${job.id}] Progress ${progress}%: ${message}`)
          },
        )

        await job.updateProgress(100)

        console.log(`✅ Upload job ${job.id} completed successfully`)

        return {
          success: true,
          devicesProcessed: result.devicesProcessed,
          totalFiles: result.totalFiles,
          totalCredentials: result.totalCredentials,
          totalDomains: result.totalDomains,
          totalUrls: result.totalUrls,
        }
      } catch (error) {
        console.error(`❌ Upload job ${job.id} failed:`, error)

        return {
          success: false,
          devicesProcessed: 0,
          totalFiles: 0,
          totalCredentials: 0,
          totalDomains: 0,
          totalUrls: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        }
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 uploads simultaneously (adjust based on server resources)
      limiter: {
        max: 5, // Max 5 jobs
        duration: 60000, // per minute
      },
    },
  )

  // Worker event handlers
  uploadWorker.on("completed", (job) => {
    console.log(`✅ Job ${job.id} completed`)
  })

  uploadWorker.on("failed", (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err)
  })

  uploadWorker.on("error", (err) => {
    console.error("❌ Worker error:", err)
  })

  uploadWorker.on("active", (job) => {
    console.log(`▶️ Job ${job.id} is now active`)
  })

  console.log("✅ Upload worker started successfully")

  return uploadWorker
}

// Stop worker (for graceful shutdown)
export async function stopUploadWorker() {
  if (uploadWorker) {
    console.log("🛑 Stopping upload worker...")
    await uploadWorker.close()
    uploadWorker = null
    console.log("✅ Upload worker stopped")
  }
}

// Clean old jobs
export async function cleanOldJobs() {
  const cleaned = await uploadQueue.clean(3600000, 100) // Clean jobs older than 1 hour
  console.log(`🧹 Cleaned ${cleaned.length} old jobs`)
  return cleaned
}

// Get queue statistics
export async function getQueueStats() {
  const waiting = await uploadQueue.getWaitingCount()
  const active = await uploadQueue.getActiveCount()
  const completed = await uploadQueue.getCompletedCount()
  const failed = await uploadQueue.getFailedCount()
  const delayed = await uploadQueue.getDelayedCount()

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  }
}
