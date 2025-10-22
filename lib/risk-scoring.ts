/**
 * Risk Scoring System
 *
 * Calculates risk scores for devices based on various factors
 */

export interface RiskFactors {
  hasActiveSessions: boolean
  activeSessionCount: number
  hasHighValueSessions: boolean // email, financial, crypto
  hasCryptoWallets: boolean
  cryptoWalletCount: number
  hasValidDiscordTokens: boolean
  discordTokenCount: number
  credentialCount: number
  hasCreditCards: boolean
  creditCardCount: number
  validCreditCards: number
  stealerFamily: string | null
  stealerThreatLevel?: string // High, Medium, Low
}

export interface RiskScore {
  score: number // 0-100
  level: "Low" | "Medium" | "High" | "Critical"
  color: string
  factors: string[]
  recommendations: string[]
}

/**
 * Calculate comprehensive risk score for a device
 */
export function calculateDeviceRiskScore(factors: RiskFactors): RiskScore {
  let score = 0
  const riskFactors: string[] = []
  const recommendations: string[] = []

  // Active Sessions Risk (0-30 points)
  if (factors.hasActiveSessions) {
    const sessionPoints = Math.min(30, factors.activeSessionCount * 3)
    score += sessionPoints
    riskFactors.push(`${factors.activeSessionCount} active session(s)`)
    recommendations.push("Revoke all active sessions immediately")
  }

  // High-Value Sessions (0-20 points)
  if (factors.hasHighValueSessions) {
    score += 20
    riskFactors.push("High-value sessions detected (email/financial/crypto)")
    recommendations.push("Reset passwords for financial accounts")
    recommendations.push("Enable 2FA on all critical accounts")
  }

  // Crypto Wallets (0-15 points)
  if (factors.hasCryptoWallets) {
    const walletPoints = Math.min(15, factors.cryptoWalletCount * 5)
    score += walletPoints
    riskFactors.push(`${factors.cryptoWalletCount} crypto wallet(s) found`)
    recommendations.push("Move crypto assets to new wallets immediately")
  }

  // Discord Tokens (0-10 points)
  if (factors.hasValidDiscordTokens) {
    const discordPoints = Math.min(10, factors.discordTokenCount * 2)
    score += discordPoints
    riskFactors.push(`${factors.discordTokenCount} Discord token(s)`)
    recommendations.push("Reset Discord password and revoke sessions")
  }

  // Credit Cards (0-15 points)
  if (factors.hasCreditCards) {
    const cardPoints = Math.min(15, factors.validCreditCards * 5)
    score += cardPoints
    riskFactors.push(`${factors.validCreditCards} valid credit card(s)`)
    recommendations.push("Contact bank to freeze/replace cards")
  }

  // Credential Volume (0-10 points)
  if (factors.credentialCount > 0) {
    const credPoints = Math.min(10, Math.floor(factors.credentialCount / 10))
    score += credPoints
    if (factors.credentialCount > 50) {
      riskFactors.push(`Large credential dump (${factors.credentialCount} credentials)`)
      recommendations.push("Initiate organization-wide password reset")
    }
  }

  // Stealer Threat Level (0-10 points)
  if (factors.stealerFamily && factors.stealerThreatLevel === "High") {
    score += 10
    riskFactors.push(`High-threat stealer: ${factors.stealerFamily}`)
    recommendations.push("Full system reimage recommended")
  } else if (factors.stealerThreatLevel === "Medium-High") {
    score += 7
  } else if (factors.stealerThreatLevel === "Medium") {
    score += 5
  }

  // Determine risk level
  let level: "Low" | "Medium" | "High" | "Critical"
  let color: string

  if (score >= 70) {
    level = "Critical"
    color = "text-red-600"
  } else if (score >= 50) {
    level = "High"
    color = "text-orange-600"
  } else if (score >= 25) {
    level = "Medium"
    color = "text-yellow-600"
  } else {
    level = "Low"
    color = "text-green-600"
  }

  return {
    score: Math.min(100, score),
    level,
    color,
    factors: riskFactors,
    recommendations: Array.from(new Set(recommendations)), // Deduplicate
  }
}

/**
 * Get risk badge variant for shadcn Badge component
 */
export function getRiskBadgeVariant(level: string): "default" | "secondary" | "destructive" | "outline" {
  switch (level) {
    case "Critical":
      return "destructive"
    case "High":
      return "destructive"
    case "Medium":
      return "default"
    case "Low":
      return "secondary"
    default:
      return "outline"
  }
}

/**
 * Get background color for risk level
 */
export function getRiskBackgroundColor(level: string): string {
  switch (level) {
    case "Critical":
      return "bg-red-500"
    case "High":
      return "bg-orange-500"
    case "Medium":
      return "bg-yellow-500"
    case "Low":
      return "bg-green-500"
    default:
      return "bg-gray-500"
  }
}

/**
 * Get session risk based on security flags
 */
export interface SessionSecurityFlags {
  httponly: boolean
  secure: boolean
  same_site: string | null
}

export interface SessionRisk {
  score: number // 0-100 (100 = secure, 0 = insecure)
  level: "Secure" | "Low Risk" | "Medium Risk" | "High Risk"
  issues: string[]
}

export function calculateSessionRisk(flags: SessionSecurityFlags): SessionRisk {
  let score = 100
  const issues: string[] = []

  // Missing httponly (cookies can be accessed by JavaScript)
  if (!flags.httponly) {
    score -= 30
    issues.push("Missing httpOnly flag (XSS vulnerable)")
  }

  // Missing secure flag (can be transmitted over HTTP)
  if (!flags.secure) {
    score -= 20
    issues.push("Missing secure flag (MITM vulnerable)")
  }

  // SameSite policy
  if (!flags.same_site || flags.same_site === "none") {
    score -= 20
    issues.push("No SameSite protection (CSRF vulnerable)")
  } else if (flags.same_site === "lax") {
    score -= 10
    issues.push("SameSite=Lax (partial CSRF protection)")
  }

  let level: "Secure" | "Low Risk" | "Medium Risk" | "High Risk"

  if (score >= 90) {
    level = "Secure"
  } else if (score >= 60) {
    level = "Low Risk"
  } else if (score >= 30) {
    level = "Medium Risk"
  } else {
    level = "High Risk"
  }

  return {
    score,
    level,
    issues,
  }
}
