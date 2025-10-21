import { NextRequest, NextResponse } from "next/server"
import { getDiscordValidationStats } from "@/lib/db-messaging-helpers"

/**
 * GET /api/v1/messaging/discord/validation-stats
 * Get Discord token validation statistics
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await getDiscordValidationStats()

    const validationRate =
      stats.total_tokens > 0
        ? ((stats.validated_tokens / stats.total_tokens) * 100).toFixed(1)
        : 0

    const validRate =
      stats.validated_tokens > 0
        ? ((stats.valid_tokens / stats.validated_tokens) * 100).toFixed(1)
        : 0

    return NextResponse.json({
      success: true,
      stats: {
        total_tokens: stats.total_tokens,
        validated_tokens: stats.validated_tokens,
        valid_tokens: stats.valid_tokens,
        invalid_tokens: stats.invalid_tokens,
        unvalidated_tokens: stats.unvalidated_tokens,
        nitro_tokens: stats.nitro_tokens,
        tokens_with_servers: stats.tokens_with_servers,
      },
      percentages: {
        validation_rate: parseFloat(validationRate as string),
        valid_rate: parseFloat(validRate as string),
      },
      insights: {
        need_validation: stats.unvalidated_tokens,
        active_accounts: stats.valid_tokens,
        premium_accounts: stats.nitro_tokens,
        social_accounts: stats.tokens_with_servers,
      },
    })
  } catch (error) {
    console.error("Error fetching Discord validation stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch validation statistics" },
      { status: 500 },
    )
  }
}
