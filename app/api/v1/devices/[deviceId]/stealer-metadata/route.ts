import { NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { validateRequest } from "@/lib/auth"

/**
 * GET /api/v1/devices/[deviceId]/stealer-metadata
 * Get stealer malware metadata for a device
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

    // Get stealer metadata
    const metadata = await executeQuery(
      `
      SELECT
        sm.id,
        sm.device_id,
        sm.stealer_family,
        sm.stealer_version,
        sm.build_id,
        sm.detection_confidence,
        sm.indicators,
        sm.created_at,
        d.device_name,
        d.upload_date
      FROM stealer_metadata sm
      JOIN devices d ON sm.device_id = d.device_id
      WHERE sm.device_id = ?
      LIMIT 1
    `,
      [deviceId]
    )

    if (!Array.isArray(metadata) || metadata.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No stealer metadata found for this device"
      }, { status: 404 })
    }

    const data = metadata[0]

    // Parse JSON indicators if stored as string
    let indicators = data.indicators
    if (typeof indicators === "string") {
      try {
        indicators = JSON.parse(indicators)
      } catch {
        indicators = []
      }
    }

    // Find similar devices with same stealer family
    const similarDevices = await executeQuery(
      `
      SELECT
        d.device_id,
        d.device_name,
        d.upload_date,
        d.total_credentials,
        sm.stealer_version,
        sm.detection_confidence
      FROM stealer_metadata sm
      JOIN devices d ON sm.device_id = d.device_id
      WHERE sm.stealer_family = ?
        AND sm.device_id != ?
      ORDER BY sm.created_at DESC
      LIMIT 10
    `,
      [data.stealer_family, deviceId]
    )

    // Get threat intelligence based on stealer family
    const threatIntel = getThreatIntelligence(data.stealer_family)

    return NextResponse.json({
      success: true,
      metadata: {
        id: data.id,
        device_id: data.device_id,
        device_name: data.device_name,
        stealer_family: data.stealer_family,
        stealer_version: data.stealer_version,
        build_id: data.build_id,
        detection_confidence: data.detection_confidence,
        confidence_percentage: Math.round(data.detection_confidence * 100),
        indicators: Array.isArray(indicators) ? indicators : [],
        upload_date: data.upload_date,
        created_at: data.created_at
      },
      similar_devices: similarDevices,
      threat_intelligence: threatIntel
    })
  } catch (error) {
    console.error("Error fetching stealer metadata:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch stealer metadata"
      },
      { status: 500 }
    )
  }
}

/**
 * Get threat intelligence for known stealer families
 */
function getThreatIntelligence(stealerFamily: string) {
  const intel: Record<string, any> = {
    Redline: {
      threat_level: "High",
      active_since: "2020",
      primary_targets: ["Credentials", "Cryptocurrency Wallets", "Browser Data"],
      known_c2_infrastructure: "Telegram-based C2",
      typical_distribution: ["Malicious downloads", "Cracked software", "Phishing"],
      mitigation: [
        "Reset all passwords for compromised accounts",
        "Enable 2FA on all critical accounts",
        "Scan system with updated AV",
        "Monitor for unauthorized access to crypto wallets"
      ],
      iocs: [
        "UserInformation.txt file",
        "Specific Browsers/ directory structure",
        "Telegram-based exfiltration"
      ]
    },
    Raccoon: {
      threat_level: "High",
      active_since: "2019",
      primary_targets: ["Credentials", "Cookies", "Cryptocurrency Wallets"],
      known_c2_infrastructure: "HTTP-based C2",
      typical_distribution: ["Email attachments", "Malvertising", "Exploit kits"],
      mitigation: [
        "Change all passwords immediately",
        "Revoke all active sessions",
        "Check for unauthorized transactions",
        "Full system reimage recommended"
      ],
      iocs: [
        "System Info.txt file",
        "RC4 encrypted configuration",
        "Specific HTTP C2 patterns"
      ]
    },
    StealC: {
      threat_level: "High",
      active_since: "2023",
      primary_targets: ["Browser Data", "Cryptocurrency", "Discord Tokens"],
      known_c2_infrastructure: "Modern HTTP/S C2",
      typical_distribution: ["Malicious GitHub repos", "YouTube video descriptions"],
      mitigation: [
        "Reset Discord tokens",
        "Check crypto wallet activity",
        "Review recent browser sessions",
        "Update security software"
      ],
      iocs: [
        "Modern stealer patterns",
        "Crypto wallet targeting",
        "Discord token extraction"
      ]
    },
    Lumma: {
      threat_level: "High",
      active_since: "2022",
      primary_targets: ["Credentials", "2FA Codes", "Crypto Wallets"],
      known_c2_infrastructure: "Telegram + Custom C2",
      typical_distribution: ["Fake crack sites", "Malicious ads"],
      mitigation: [
        "Disable compromised 2FA seeds",
        "Reset all passwords",
        "Monitor crypto transactions",
        "Check for persistent malware"
      ],
      iocs: [
        "2FA authenticator extraction",
        "Advanced crypto wallet targeting",
        "Screenshot capabilities"
      ]
    },
    Vidar: {
      threat_level: "High",
      active_since: "2018",
      primary_targets: ["Browser Data", "Crypto Wallets", "Email Credentials"],
      known_c2_infrastructure: "Various C2 methods",
      typical_distribution: ["Cracked software", "Fake updates"],
      mitigation: [
        "Assume full credential compromise",
        "Check crypto wallet activity immediately",
        "Reset email passwords",
        "Enable MFA everywhere possible"
      ],
      iocs: [
        "Similar to Redline structure",
        "Aggressive crypto wallet targeting",
        "Email credential focus"
      ]
    },
    Aurora: {
      threat_level: "Medium-High",
      active_since: "2021",
      primary_targets: ["Browser Credentials", "Session Cookies"],
      known_c2_infrastructure: "HTTP-based",
      typical_distribution: ["Phishing campaigns", "Malicious downloads"],
      mitigation: [
        "Clear all browser sessions",
        "Reset passwords",
        "Review account activity logs"
      ],
      iocs: [
        "Specific file naming patterns",
        "Session cookie targeting"
      ]
    },
    Meta: {
      threat_level: "High",
      active_since: "2022",
      primary_targets: ["Credentials", "Wallets", "System Info"],
      known_c2_infrastructure: "Modern C2",
      typical_distribution: ["Various vectors"],
      mitigation: [
        "Full credential reset",
        "Crypto wallet security check",
        "System cleanup"
      ],
      iocs: [
        "Meta-specific patterns",
        "Advanced evasion techniques"
      ]
    },
    Mars: {
      threat_level: "Medium-High",
      active_since: "2021",
      primary_targets: ["Browser Data", "Credentials"],
      known_c2_infrastructure: "HTTP C2",
      typical_distribution: ["Cracked software"],
      mitigation: [
        "Password reset campaign",
        "Browser data cleanup"
      ],
      iocs: [
        "Mars-specific file structure"
      ]
    },
    FormBook: {
      threat_level: "High",
      active_since: "2016",
      primary_targets: ["Keylogging", "Form Data", "Screenshots"],
      known_c2_infrastructure: "HTTP-based C2",
      typical_distribution: ["Email spam", "Malicious documents"],
      mitigation: [
        "Assume keystroke logging occurred",
        "Reset all passwords immediately",
        "Check for sensitive data exposure",
        "Full malware removal required"
      ],
      iocs: [
        "Grabbed_Data.txt file",
        "Keylogger component",
        "Screenshot capabilities"
      ]
    },
    Unknown: {
      threat_level: "Unknown",
      active_since: "N/A",
      primary_targets: ["Unable to determine"],
      known_c2_infrastructure: "Unknown",
      typical_distribution: ["Unknown"],
      mitigation: [
        "Treat as high-risk compromise",
        "Reset all credentials as precaution",
        "Full system analysis recommended"
      ],
      iocs: [
        "Generic stealer patterns detected"
      ]
    }
  }

  return intel[stealerFamily] || intel.Unknown
}
