#!/usr/bin/env ts-node
/**
 * Export passwords and identifiers for breach database correlation and hashcat
 *
 * Usage:
 *   npm run export:hashcat [output-dir] [device-id]
 *   npm run export:hashcat ./exports
 *   npm run export:hashcat ./exports abc123
 */

import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import {
  exportBreachLookupPackage,
  exportPasswordsForHashcat,
  exportPasswordStatistics,
  exportEmailsForBreachDB,
  exportUsernamesForBreachDB,
  exportCombinedIdentifiers,
} from "../lib/password-export"

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const outputDir = args[0] || "./exports"
  const deviceId = args[1] || undefined

  console.log("🔐 Password & Breach Database Export Tool")
  console.log("=" .repeat(60))
  console.log(`📁 Output directory: ${outputDir}`)
  console.log(`🖥️  Device filter: ${deviceId || "ALL DEVICES"}`)
  console.log("")

  // Create output directory
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
    console.log(`✅ Created directory: ${outputDir}`)
  }

  console.log("📤 Exporting data...")
  console.log("")

  // Export complete package
  const result = await exportBreachLookupPackage(outputDir, deviceId)

  // Display results
  console.log("=" .repeat(60))
  console.log("📊 Export Results:")
  console.log("=" .repeat(60))

  for (const file of result.files) {
    const fileName = path.basename(file.file_path || "unknown")
    const status = file.success ? "✅" : "❌"
    const records = file.total_records || 0

    console.log(`${status} ${fileName}`)
    if (file.success) {
      console.log(`   Records: ${records.toLocaleString()}`)
      console.log(`   Path: ${file.file_path}`)
    } else {
      console.log(`   Error: ${file.error}`)
    }
    console.log("")
  }

  console.log("=" .repeat(60))
  console.log("💡 Next Steps:")
  console.log("=" .repeat(60))
  console.log("1. Use emails.txt & usernames.txt with dehashed or similar services")
  console.log("2. Combine breach database results with passwords.txt")
  console.log("3. Use combined wordlist with hashcat for password analysis")
  console.log("4. Review password-stats.txt to identify common patterns")
  console.log("")
  console.log("Example hashcat usage:")
  console.log(`  hashcat -m 0 -a 0 hashes.txt ${path.join(outputDir, "passwords.txt")}`)
  console.log("")

  const successCount = result.files.filter((f) => f.success).length
  if (successCount === 0) {
    console.log("⚠️  No data exported. Make sure you have processed some logs first.")
    process.exit(1)
  } else {
    console.log(`✅ Successfully exported ${successCount}/${result.total_files} files!`)
  }
}

main().catch((err) => {
  console.error("❌ Error:", err)
  process.exit(1)
})
