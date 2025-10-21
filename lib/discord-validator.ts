/**
 * Discord Token Validator
 *
 * Validates Discord tokens against the Discord API and extracts user information
 */

export interface DiscordUserInfo {
  id: string
  username: string
  discriminator: string
  global_name?: string | null
  avatar?: string | null
  email?: string | null
  phone?: string | null
  verified?: boolean
  mfa_enabled?: boolean
  premium_type?: number // 0 = None, 1 = Nitro Classic, 2 = Nitro
  flags?: number
  public_flags?: number
  locale?: string
  bio?: string
}

export interface DiscordValidationResult {
  is_valid: boolean
  user_info?: DiscordUserInfo
  server_count?: number
  friend_count?: number
  account_created_timestamp?: number
  error_message?: string
  validation_timestamp: number
  rate_limited: boolean
}

/**
 * Validate a Discord token and get user information
 */
export async function validateDiscordToken(
  token: string,
): Promise<DiscordValidationResult> {
  const timestamp = Date.now()

  try {
    // Call Discord API to get user info
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      method: "GET",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    })

    // Check if rate limited
    if (userResponse.status === 429) {
      const retryAfter = userResponse.headers.get("retry-after")
      console.warn(`Discord API rate limited. Retry after: ${retryAfter}s`)
      return {
        is_valid: false,
        rate_limited: true,
        error_message: `Rate limited. Retry after ${retryAfter}s`,
        validation_timestamp: timestamp,
      }
    }

    // Check if unauthorized (invalid token)
    if (userResponse.status === 401) {
      return {
        is_valid: false,
        rate_limited: false,
        error_message: "Invalid or expired token",
        validation_timestamp: timestamp,
      }
    }

    // Check if forbidden (banned/locked account)
    if (userResponse.status === 403) {
      return {
        is_valid: false,
        rate_limited: false,
        error_message: "Account banned or locked",
        validation_timestamp: timestamp,
      }
    }

    // Check for other errors
    if (!userResponse.ok) {
      return {
        is_valid: false,
        rate_limited: false,
        error_message: `Discord API error: ${userResponse.status} ${userResponse.statusText}`,
        validation_timestamp: timestamp,
      }
    }

    const userData: DiscordUserInfo = await userResponse.json()

    // Get guild (server) count
    let serverCount: number | undefined
    try {
      const guildsResponse = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        method: "GET",
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      })

      if (guildsResponse.ok) {
        const guilds = await guildsResponse.json()
        serverCount = Array.isArray(guilds) ? guilds.length : undefined
      }
    } catch (error) {
      // Non-critical error, continue without server count
      console.warn("Failed to fetch guild count:", error)
    }

    // Get friend/relationship count
    let friendCount: number | undefined
    try {
      const relationshipsResponse = await fetch(
        "https://discord.com/api/v10/users/@me/relationships",
        {
          method: "GET",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
        },
      )

      if (relationshipsResponse.ok) {
        const relationships = await relationshipsResponse.json()
        if (Array.isArray(relationships)) {
          // Filter for actual friends (type 1)
          friendCount = relationships.filter((r: any) => r.type === 1).length
        }
      }
    } catch (error) {
      // Non-critical error, continue without friend count
      console.warn("Failed to fetch relationship count:", error)
    }

    // Calculate account creation timestamp from snowflake ID
    let accountCreatedTimestamp: number | undefined
    if (userData.id) {
      try {
        const snowflake = BigInt(userData.id)
        const discordEpoch = 1420070400000n // Discord epoch in milliseconds
        const timestamp = Number((snowflake >> 22n) + discordEpoch)
        accountCreatedTimestamp = timestamp
      } catch (error) {
        console.warn("Failed to parse account creation timestamp:", error)
      }
    }

    return {
      is_valid: true,
      user_info: userData,
      server_count: serverCount,
      friend_count: friendCount,
      account_created_timestamp: accountCreatedTimestamp,
      validation_timestamp: timestamp,
      rate_limited: false,
    }
  } catch (error) {
    console.error("Error validating Discord token:", error)
    return {
      is_valid: false,
      rate_limited: false,
      error_message: error instanceof Error ? error.message : "Unknown error",
      validation_timestamp: timestamp,
    }
  }
}

/**
 * Validate multiple Discord tokens with rate limiting
 */
export async function validateDiscordTokensBatch(
  tokens: string[],
  delayMs: number = 1000, // Delay between requests to avoid rate limiting
  onProgress?: (current: number, total: number, result: DiscordValidationResult) => void,
): Promise<Map<string, DiscordValidationResult>> {
  const results = new Map<string, DiscordValidationResult>()

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    // Validate token
    const result = await validateDiscordToken(token)
    results.set(token, result)

    // Call progress callback
    if (onProgress) {
      onProgress(i + 1, tokens.length, result)
    }

    // If rate limited, wait longer
    if (result.rate_limited) {
      console.warn(`Rate limited at token ${i + 1}/${tokens.length}. Waiting 60 seconds...`)
      await sleep(60000) // Wait 1 minute if rate limited
    } else if (i < tokens.length - 1) {
      // Wait between requests to avoid rate limiting
      await sleep(delayMs)
    }
  }

  return results
}

/**
 * Helper function to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Get Nitro type as string
 */
export function getNitroTypeString(premiumType?: number): string {
  if (!premiumType || premiumType === 0) return "None"
  if (premiumType === 1) return "Nitro Classic"
  if (premiumType === 2) return "Nitro"
  if (premiumType === 3) return "Nitro Basic"
  return "Unknown"
}

/**
 * Get account age in days
 */
export function getAccountAge(accountCreatedTimestamp?: number): number | null {
  if (!accountCreatedTimestamp) return null
  const now = Date.now()
  const ageMs = now - accountCreatedTimestamp
  return Math.floor(ageMs / (1000 * 60 * 60 * 24))
}

/**
 * Format Discord user for display
 */
export function formatDiscordUser(userInfo?: DiscordUserInfo): string {
  if (!userInfo) return "Unknown"

  // New format (no discriminator) or old format (#0000)
  if (userInfo.discriminator === "0" || !userInfo.discriminator) {
    return `@${userInfo.username}`
  } else {
    return `${userInfo.username}#${userInfo.discriminator}`
  }
}
