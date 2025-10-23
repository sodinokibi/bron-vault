import chokidar from "chokidar"
import path from "path"
import fs from "fs/promises"
import { existsSync } from "fs"
import { processUploadedFile } from "./upload-processor"
import { loadArchivePasswords } from "./archive-handler"

interface WatcherConfig {
  watchPath: string
  processedPath?: string
  failedPath?: string
  archiveExtensions?: string[]
  debounceMs?: number
  autoDelete?: boolean
}

interface WatcherStats {
  filesProcessed: number
  filesSucceeded: number
  filesFailed: number
  startTime: Date
  lastProcessed: Date | null
}

export class FolderWatcher {
  private watcher: chokidar.FSWatcher | null = null
  private config: Required<WatcherConfig>
  private processing = new Set<string>()
  private stats: WatcherStats
  private passwords: string[] = []

  constructor(config: WatcherConfig) {
    this.config = {
      watchPath: config.watchPath,
      processedPath: config.processedPath || path.join(config.watchPath, "../processed"),
      failedPath: config.failedPath || path.join(config.watchPath, "../failed"),
      archiveExtensions: config.archiveExtensions || [".zip", ".rar", ".7z", ".tar", ".gz"],
      debounceMs: config.debounceMs || 3000,
      autoDelete: config.autoDelete ?? false,
    }

    this.stats = {
      filesProcessed: 0,
      filesSucceeded: 0,
      filesFailed: 0,
      startTime: new Date(),
      lastProcessed: null,
    }
  }

  async start() {
    console.log("🔍 Starting folder watcher...")
    console.log(`📁 Watch path: ${this.config.watchPath}`)
    console.log(`✅ Processed path: ${this.config.processedPath}`)
    console.log(`❌ Failed path: ${this.config.failedPath}`)
    console.log(`🗑️  Auto-delete: ${this.config.autoDelete}`)

    // Ensure directories exist
    await this.ensureDirectories()

    // Load archive passwords
    this.passwords = await loadArchivePasswords()
    console.log(`🔑 Loaded ${this.passwords.length} archive passwords`)

    // Initialize watcher
    this.watcher = chokidar.watch(this.config.watchPath, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: false, // Process existing files
      awaitWriteFinish: {
        stabilityThreshold: this.config.debounceMs,
        pollInterval: 100,
      },
    })

    this.watcher
      .on("add", (filePath) => this.handleNewFile(filePath))
      .on("error", (error) => console.error(`❌ Watcher error: ${error}`))
      .on("ready", () => console.log("✅ Folder watcher ready"))

    console.log("👀 Watching for new archive files...")
  }

  async stop() {
    console.log("🛑 Stopping folder watcher...")
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    console.log("✅ Folder watcher stopped")
  }

  getStats(): WatcherStats {
    return { ...this.stats }
  }

  private async ensureDirectories() {
    const dirs = [this.config.watchPath, this.config.processedPath, this.config.failedPath]

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true })
        console.log(`📁 Created directory: ${dir}`)
      }
    }
  }

  private async handleNewFile(filePath: string) {
    // Check if file is an archive
    const ext = path.extname(filePath).toLowerCase()
    if (!this.config.archiveExtensions.includes(ext)) {
      console.log(`⏭️  Skipping non-archive file: ${path.basename(filePath)}`)
      return
    }

    // Check if already processing
    if (this.processing.has(filePath)) {
      console.log(`⏳ Already processing: ${path.basename(filePath)}`)
      return
    }

    // Check if file exists (may have been deleted)
    if (!existsSync(filePath)) {
      console.log(`⚠️  File no longer exists: ${path.basename(filePath)}`)
      return
    }

    console.log(`\n📦 New archive detected: ${path.basename(filePath)}`)
    this.processing.add(filePath)

    try {
      await this.processFile(filePath)
      this.stats.filesSucceeded++
      console.log(`✅ Successfully processed: ${path.basename(filePath)}`)
    } catch (error) {
      this.stats.filesFailed++
      console.error(`❌ Failed to process: ${path.basename(filePath)}`)
      console.error(error)
      await this.moveToFailed(filePath, error)
    } finally {
      this.processing.delete(filePath)
      this.stats.filesProcessed++
      this.stats.lastProcessed = new Date()
      this.logStats()
    }
  }

  private async processFile(filePath: string) {
    const fileName = path.basename(filePath)
    const fileStats = await fs.stat(filePath)
    const fileSizeKB = Math.round(fileStats.size / 1024)

    console.log(`📊 File size: ${fileSizeKB} KB`)
    console.log(`🔄 Processing with upload processor...`)

    // Use the existing upload processor
    // Note: In production, you'd want to pass actual user context
    // For now, we'll use a system user or configured default
    const result = await processUploadedFile({
      filePath,
      filename: fileName,
      userId: process.env.WATCHER_USER_ID || "system",
      username: process.env.WATCHER_USERNAME || "folder-watcher",
      password: null, // Will try common passwords automatically
      sessionId: `watcher-${Date.now()}`,
    })

    if (!result.success) {
      throw new Error(result.error || "Processing failed")
    }

    console.log(`✅ Extracted ${result.extracted_count || 0} files`)
    console.log(`📝 Device ID: ${result.device_id || "N/A"}`)

    // Move to processed or delete
    if (this.config.autoDelete) {
      await fs.unlink(filePath)
      console.log(`🗑️  Deleted: ${fileName}`)
    } else {
      await this.moveToProcessed(filePath)
    }
  }

  private async moveToProcessed(filePath: string) {
    const fileName = path.basename(filePath)
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const newPath = path.join(this.config.processedPath, `${timestamp}_${fileName}`)

    await fs.rename(filePath, newPath)
    console.log(`📁 Moved to processed: ${fileName}`)
  }

  private async moveToFailed(filePath: string, error: any) {
    try {
      const fileName = path.basename(filePath)
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const newPath = path.join(this.config.failedPath, `${timestamp}_${fileName}`)

      // Create error log file
      const errorLogPath = newPath + ".error.txt"
      const errorLog = `
File: ${fileName}
Time: ${new Date().toISOString()}
Error: ${error.message || String(error)}

Stack Trace:
${error.stack || "N/A"}
      `.trim()

      await fs.writeFile(errorLogPath, errorLog)

      // Move the file
      if (existsSync(filePath)) {
        await fs.rename(filePath, newPath)
        console.log(`📁 Moved to failed: ${fileName}`)
      }
    } catch (moveError) {
      console.error(`❌ Failed to move file to failed directory:`, moveError)
    }
  }

  private logStats() {
    const uptime = Math.round((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)
    const successRate = this.stats.filesProcessed > 0
      ? Math.round((this.stats.filesSucceeded / this.stats.filesProcessed) * 100)
      : 0

    console.log(`\n📊 Watcher Stats:`)
    console.log(`   Uptime: ${uptime} minutes`)
    console.log(`   Processed: ${this.stats.filesProcessed}`)
    console.log(`   Succeeded: ${this.stats.filesSucceeded}`)
    console.log(`   Failed: ${this.stats.filesFailed}`)
    console.log(`   Success Rate: ${successRate}%`)
    if (this.stats.lastProcessed) {
      console.log(`   Last Processed: ${this.stats.lastProcessed.toISOString()}`)
    }
    console.log("")
  }
}

/**
 * Start folder watcher from environment configuration
 */
export async function startFolderWatcherFromEnv() {
  const watchPath = process.env.WATCHER_FOLDER_PATH

  if (!watchPath) {
    throw new Error("WATCHER_FOLDER_PATH environment variable is required")
  }

  const watcher = new FolderWatcher({
    watchPath,
    processedPath: process.env.WATCHER_PROCESSED_PATH,
    failedPath: process.env.WATCHER_FAILED_PATH,
    debounceMs: parseInt(process.env.WATCHER_DEBOUNCE_MS || "3000"),
    autoDelete: process.env.WATCHER_AUTO_DELETE === "true",
  })

  await watcher.start()

  // Handle graceful shutdown
  const cleanup = async () => {
    console.log("\n⚠️  Received shutdown signal")
    await watcher.stop()
    process.exit(0)
  }

  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)

  return watcher
}
