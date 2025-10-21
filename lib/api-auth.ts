import { NextRequest } from "next/server"
import { validateAPIKey, hasPermission, type APIPermission } from "./api-keys"

/**
 * Validate API key from request headers
 */
export async function validateAPIKeyRequest(request: NextRequest): Promise<{
  userId: string
  username: string
  permissions: APIPermission[]
} | null> {
  // Try to get API key from headers
  const apiKey = request.headers.get("X-API-Key") || request.headers.get("Authorization")?.replace("Bearer ", "")

  if (!apiKey) {
    return null
  }

  return await validateAPIKey(apiKey)
}

/**
 * Check if request has required permission
 */
export async function checkAPIPermission(
  request: NextRequest,
  requiredPermission: APIPermission,
): Promise<{
  authorized: boolean
  user?: {
    userId: string
    username: string
    permissions: APIPermission[]
  }
  error?: string
}> {
  const user = await validateAPIKeyRequest(request)

  if (!user) {
    return {
      authorized: false,
      error: "Invalid or missing API key",
    }
  }

  if (!hasPermission(user.permissions, requiredPermission)) {
    return {
      authorized: false,
      user,
      error: `Missing required permission: ${requiredPermission}`,
    }
  }

  return {
    authorized: true,
    user,
  }
}

/**
 * Helper to extract API key from request
 */
export function getAPIKeyFromRequest(request: NextRequest): string | null {
  // Try X-API-Key header first
  const apiKeyHeader = request.headers.get("X-API-Key")
  if (apiKeyHeader) {
    return apiKeyHeader
  }

  // Try Authorization header with Bearer token
  const authHeader = request.headers.get("Authorization")
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7)
  }

  return null
}
