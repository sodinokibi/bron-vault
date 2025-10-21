#!/usr/bin/env tsx
/**
 * Upload Queue Worker
 *
 * This script starts the BullMQ worker to process upload jobs in the background.
 * It should be run as a separate process from the Next.js server.
 *
 * Usage:
 *   npm run worker           (for production)
 *   npm run worker:dev       (for development with auto-reload)
 *
 * The worker will:
 * - Connect to Redis
 * - Process upload jobs from the queue
 * - Handle retries on failure
 * - Clean up old jobs
 */

import { startUploadWorker, stopUploadWorker, cleanOldJobs, getQueueStats } from "./lib/upload-queue"
import { testRedisConnection, closeRedisConnection } from "./lib/redis"
import { initializeDatabase } from "./lib/mysql"

async function startWorker() {
  console.log("🚀 Starting Bron Vault Upload Worker...")
  console.log("⏰ Started at:", new Date().toISOString())

  try {
    // Test Redis connection
    console.log("📡 Testing Redis connection...")
    const redisOk = await testRedisConnection()

    if (!redisOk) {
      console.error("❌ Redis connection failed. Worker cannot start.")
      console.error(
        "💡 Make sure Redis is running. Start it with: docker run -d -p 6379:6379 redis:latest",
      )
      process.exit(1)
    }

    // Initialize database
    console.log("🗄️ Initializing database...")
    await initializeDatabase()

    // Clean old jobs on startup
    console.log("🧹 Cleaning old jobs...")
    await cleanOldJobs()

    // Get initial queue stats
    const stats = await getQueueStats()
    console.log("📊 Queue statistics:")
    console.log(`   - Waiting: ${stats.waiting}`)
    console.log(`   - Active: ${stats.active}`)
    console.log(`   - Completed: ${stats.completed}`)
    console.log(`   - Failed: ${stats.failed}`)
    console.log(`   - Total: ${stats.total}`)

    // Start the worker
    console.log("🔨 Starting upload worker...")
    const worker = startUploadWorker()

    console.log("✅ Worker started successfully!")
    console.log("👀 Watching for upload jobs...")
    console.log("")
    console.log("Press Ctrl+C to stop the worker")

    // Log stats periodically
    setInterval(async () => {
      const currentStats = await getQueueStats()
      if (currentStats.waiting > 0 || currentStats.active > 0) {
        console.log(
          `📊 [${new Date().toISOString()}] Queue: ${currentStats.waiting} waiting, ${currentStats.active} active, ${currentStats.completed} completed`,
        )
      }
    }, 30000) // Every 30 seconds

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`)

      try {
        await stopUploadWorker()
        await closeRedisConnection()
        console.log("✅ Worker stopped successfully")
        process.exit(0)
      } catch (error) {
        console.error("❌ Error during shutdown:", error)
        process.exit(1)
      }
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
  } catch (error) {
    console.error("❌ Worker startup failed:", error)
    process.exit(1)
  }
}

// Start the worker
startWorker().catch((error) => {
  console.error("❌ Unhandled error:", error)
  process.exit(1)
})
