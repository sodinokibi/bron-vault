import { type NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import {
  createAPIKey,
  listAPIKeys,
  revokeAPIKey,
  deleteAPIKey,
  maskAPIKey,
  type APIPermission,
} from "@/lib/api-keys"

// Route segment config
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/v1/api-keys
 * List all API keys for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Validate JWT authentication (web UI access)
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // List all API keys for this user
    const apiKeys = await listAPIKeys(user.userId)

    // Mask the API keys for security
    const maskedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      api_key_preview: maskAPIKey(key.api_key),
      is_active: key.is_active,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      permissions: key.permissions,
    }))

    return NextResponse.json({
      success: true,
      api_keys: maskedKeys,
    })
  } catch (error) {
    console.error("❌ Error listing API keys:", error)
    return NextResponse.json(
      {
        error: "Failed to list API keys",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/v1/api-keys
 * Create a new API key
 */
export async function POST(request: NextRequest) {
  try {
    // Validate JWT authentication (web UI access)
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { name, description, expiresInDays, permissions } = body

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    if (name.length > 255) {
      return NextResponse.json({ error: "Name is too long (max 255 characters)" }, { status: 400 })
    }

    // Validate permissions if provided
    const validPermissions: APIPermission[] = ["upload", "search", "download", "stats", "admin"]
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        if (!validPermissions.includes(perm)) {
          return NextResponse.json({ error: `Invalid permission: ${perm}` }, { status: 400 })
        }
      }
    }

    // Create the API key
    const apiKey = await createAPIKey({
      userId: user.userId,
      name: name.trim(),
      description: description || null,
      expiresInDays: expiresInDays || null,
      permissions: permissions || null,
    })

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      message: "API key created successfully. Save this key - you won't be able to see it again!",
    })
  } catch (error) {
    console.error("❌ Error creating API key:", error)
    return NextResponse.json(
      {
        error: "Failed to create API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

/**
 * DELETE /api/v1/api-keys
 * Revoke or delete an API key
 */
export async function DELETE(request: NextRequest) {
  try {
    // Validate JWT authentication (web UI access)
    const user = await validateRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get API key from query params
    const { searchParams } = new URL(request.url)
    const apiKey = searchParams.get("api_key")
    const permanent = searchParams.get("permanent") === "true"

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    let success = false
    if (permanent) {
      // Permanently delete
      success = await deleteAPIKey(apiKey, user.userId)
    } else {
      // Just revoke (deactivate)
      success = await revokeAPIKey(apiKey, user.userId)
    }

    if (!success) {
      return NextResponse.json({ error: "API key not found or already revoked" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: permanent ? "API key deleted permanently" : "API key revoked successfully",
    })
  } catch (error) {
    console.error("❌ Error deleting API key:", error)
    return NextResponse.json(
      {
        error: "Failed to delete API key",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
