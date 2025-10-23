#!/usr/bin/env tsx

/**
 * Folder Watcher Service
 *
 * Monitors a directory for new stealer log archives and automatically processes them.
 *
 * Usage:
 *   npm run watcher
 *   # or
 *   tsx scripts/start-folder-watcher.ts
 *
 * Configuration via environment variables (see .env.example):
 *   WATCHER_FOLDER_PATH - Directory to monitor (required)
 *   WATCHER_PROCESSED_PATH - Where to move processed files (optional)
 *   WATCHER_FAILED_PATH - Where to move failed files (optional)
 *   WATCHER_AUTO_DELETE - Delete files after processing (default: false)
 *   WATCHER_DEBOUNCE_MS - Wait time before processing (default: 3000)
 *   WATCHER_USER_ID - User ID for processing (default: "system")
 *   WATCHER_USERNAME - Username for processing (default: "folder-watcher")
 */

import { config } from "dotenv"
import path from "path"
import { startFolderWatcherFromEnv } from "../lib/folder-watcher"

// Load environment variables
config()

async function main() {
  console.log("=" .repeat(60))
  console.log("🚀 Bron-Vault Folder Watcher Service")
  console.log("=" .repeat(60))
  console.log("")

  try {
    // Validate environment
    if (!process.env.WATCHER_FOLDER_PATH) {
      console.error("❌ Error: WATCHER_FOLDER_PATH environment variable is required")
      console.error("")
      console.error("Please set it in your .env file:")
      console.error("  WATCHER_FOLDER_PATH=/path/to/incoming/logs")
      console.error("")
      process.exit(1)
    }

    // Start watcher
    const watcher = await startFolderWatcherFromEnv()

    console.log("")
    console.log("✅ Folder watcher is now running!")
    console.log("   Press Ctrl+C to stop")
    console.log("")

  } catch (error) {
    console.error("❌ Failed to start folder watcher:")
    console.error(error)
    process.exit(1)
  }
}

main()
