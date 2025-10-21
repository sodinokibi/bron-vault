/**
 * Input sanitization utilities for user-provided data
 */

/**
 * Sanitize search query input
 * - Trims whitespace
 * - Limits length
 * - Removes/escapes potentially dangerous characters
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 500): string {
  if (typeof query !== "string") {
    throw new Error("Query must be a string")
  }

  // Trim whitespace
  let sanitized = query.trim()

  // Enforce max length
  if (sanitized.length > maxLength) {
    throw new Error(`Query too long. Maximum length is ${maxLength} characters`)
  }

  // Reject empty queries
  if (sanitized.length === 0) {
    throw new Error("Query cannot be empty")
  }

  // Escape SQL LIKE wildcards if they're not intentional
  // MySQL uses % and _ as wildcards in LIKE queries
  // We'll keep them for user convenience but prevent dangerous patterns

  // Reject queries that are ONLY wildcards
  if (/^[%_\s]+$/.test(sanitized)) {
    throw new Error("Query cannot consist only of wildcards")
  }

  // Reject NULL bytes and control characters (except newlines/tabs)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(sanitized)) {
    throw new Error("Query contains invalid characters")
  }

  return sanitized
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  const sanitized = sanitizeSearchQuery(email, 320) // Max email length per RFC

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(sanitized) && !sanitized.includes("@")) {
    console.warn(`Potentially invalid email format: ${sanitized}`)
  }

  return sanitized
}

/**
 * Sanitize domain input
 */
export function sanitizeDomain(domain: string): string {
  const sanitized = sanitizeSearchQuery(domain, 253) // Max domain length per RFC

  // Remove protocol if present
  let cleaned = sanitized.replace(/^https?:\/\//i, "")

  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/g, "")

  // Basic domain format validation (allow wildcards)
  if (!/^[a-zA-Z0-9%_.-]+$/.test(cleaned)) {
    // Check if it's a valid domain pattern with wildcards
    const withoutWildcards = cleaned.replace(/[%_]/g, "")
    if (!/^[a-zA-Z0-9.-]+$/.test(withoutWildcards)) {
      console.warn(`Potentially invalid domain format: ${cleaned}`)
    }
  }

  return cleaned
}

/**
 * Sanitize device ID
 */
export function sanitizeDeviceId(deviceId: string): string {
  if (typeof deviceId !== "string") {
    throw new Error("Device ID must be a string")
  }

  const sanitized = deviceId.trim()

  // Device IDs should be alphanumeric with hyphens/underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error("Invalid device ID format")
  }

  if (sanitized.length > 100) {
    throw new Error("Device ID too long")
  }

  return sanitized
}

/**
 * Sanitize file path for display (prevent path traversal)
 */
export function sanitizeFilePath(filePath: string): string {
  if (typeof filePath !== "string") {
    throw new Error("File path must be a string")
  }

  let sanitized = filePath.trim()

  // Prevent path traversal attacks
  if (sanitized.includes("..")) {
    throw new Error("File path cannot contain '..'")
  }

  // Reject NULL bytes
  if (sanitized.includes("\x00")) {
    throw new Error("File path contains invalid characters")
  }

  if (sanitized.length > 1000) {
    throw new Error("File path too long")
  }

  return sanitized
}

/**
 * Sanitize pagination parameters
 */
export function sanitizePaginationParams(params: {
  limit?: string | number
  offset?: string | number
}): { limit: number; offset: number } {
  let limit = 100
  let offset = 0

  if (params.limit !== undefined) {
    limit = typeof params.limit === "string" ? Number.parseInt(params.limit, 10) : params.limit

    if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
      throw new Error("Limit must be between 1 and 1000")
    }
  }

  if (params.offset !== undefined) {
    offset = typeof params.offset === "string" ? Number.parseInt(params.offset, 10) : params.offset

    if (Number.isNaN(offset) || offset < 0) {
      throw new Error("Offset must be non-negative")
    }
  }

  return { limit, offset }
}
