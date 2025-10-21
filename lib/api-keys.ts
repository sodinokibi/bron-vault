import crypto from "crypto"
import { executeQuery } from "./mysql"

/**
 * API Key prefix for easy identification
 */
const API_KEY_PREFIX = "bv_"
const API_KEY_LENGTH = 64 // characters after prefix

/**
 * API Key permissions
 */
export type APIPermission = "upload" | "search" | "download" | "stats" | "admin"

export interface APIKey {
  id: number
  user_id: string
  api_key: string
  name: string
  description: string | null
  is_active: boolean
  created_at: Date
  last_used_at: Date | null
  expires_at: Date | null
  permissions: APIPermission[] | null
}

export interface APIKeyCreateData {
  userId: string
  name: string
  description?: string
  expiresInDays?: number | null
  permissions?: APIPermission[]
}

/**
 * Generate a new API key
 */
export function generateAPIKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH / 2) // 2 hex chars per byte
  const key = randomBytes.toString("hex")
  return `${API_KEY_PREFIX}${key}`
}

/**
 * Validate API key format
 */
export function isValidAPIKeyFormat(apiKey: string): boolean {
  if (!apiKey || typeof apiKey !== "string") {
    return false
  }

  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return false
  }

  const keyPart = apiKey.substring(API_KEY_PREFIX.length)
  if (keyPart.length !== API_KEY_LENGTH) {
    return false
  }

  // Check if it's valid hex
  return /^[0-9a-f]+$/i.test(keyPart)
}

/**
 * Create a new API key
 */
export async function createAPIKey(data: APIKeyCreateData): Promise<string> {
  const apiKey = generateAPIKey()

  const expiresAt = data.expiresInDays
    ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000)
    : null

  const permissionsJSON = data.permissions ? JSON.stringify(data.permissions) : null

  await executeQuery(
    `INSERT INTO api_keys (user_id, api_key, name, description, expires_at, permissions)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userId, apiKey, data.name, data.description || null, expiresAt, permissionsJSON],
  )

  console.log(`✅ Created API key: ${data.name} for user ${data.userId}`)

  return apiKey
}

/**
 * Validate API key and return user info
 */
export async function validateAPIKey(apiKey: string | null): Promise<{
  userId: string
  username: string
  permissions: APIPermission[]
} | null> {
  if (!apiKey || !isValidAPIKeyFormat(apiKey)) {
    return null
  }

  const result = await executeQuery(
    `SELECT ak.user_id, ak.is_active, ak.expires_at, ak.permissions
     FROM api_keys ak
     WHERE ak.api_key = ?`,
    [apiKey],
  )

  if (!Array.isArray(result) || result.length === 0) {
    return null
  }

  const keyData = result[0] as any

  // Check if active
  if (!keyData.is_active) {
    console.log("⚠️ API key is inactive")
    return null
  }

  // Check if expired
  if (keyData.expires_at) {
    const expiresAt = new Date(keyData.expires_at)
    if (expiresAt < new Date()) {
      console.log("⚠️ API key has expired")
      return null
    }
  }

  // Update last_used_at
  await executeQuery(`UPDATE api_keys SET last_used_at = NOW() WHERE api_key = ?`, [apiKey])

  // Parse permissions
  let permissions: APIPermission[] = []
  if (keyData.permissions) {
    try {
      permissions = JSON.parse(keyData.permissions)
    } catch (err) {
      console.error("Failed to parse API key permissions:", err)
    }
  }

  return {
    userId: keyData.user_id,
    username: keyData.user_id, // For now, use user_id as username
    permissions,
  }
}

/**
 * Check if API key has a specific permission
 */
export function hasPermission(permissions: APIPermission[] | null, required: APIPermission): boolean {
  if (!permissions || permissions.length === 0) {
    // No permissions specified means full access
    return true
  }

  return permissions.includes(required) || permissions.includes("admin")
}

/**
 * List all API keys for a user
 */
export async function listAPIKeys(userId: string): Promise<APIKey[]> {
  const result = await executeQuery(
    `SELECT id, user_id, api_key, name, description, is_active, created_at, last_used_at, expires_at, permissions
     FROM api_keys
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
  )

  if (!Array.isArray(result)) {
    return []
  }

  return result.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    api_key: row.api_key,
    name: row.name,
    description: row.description,
    is_active: Boolean(row.is_active),
    created_at: new Date(row.created_at),
    last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    permissions: row.permissions ? JSON.parse(row.permissions) : null,
  }))
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeAPIKey(apiKey: string, userId: string): Promise<boolean> {
  const result = await executeQuery(
    `UPDATE api_keys SET is_active = FALSE WHERE api_key = ? AND user_id = ?`,
    [apiKey, userId],
  )

  if (Array.isArray(result)) {
    return false
  }

  const affected = (result as any).affectedRows || 0
  if (affected > 0) {
    console.log(`✅ Revoked API key: ${apiKey}`)
    return true
  }

  return false
}

/**
 * Delete an API key permanently
 */
export async function deleteAPIKey(apiKey: string, userId: string): Promise<boolean> {
  const result = await executeQuery(`DELETE FROM api_keys WHERE api_key = ? AND user_id = ?`, [apiKey, userId])

  if (Array.isArray(result)) {
    return false
  }

  const affected = (result as any).affectedRows || 0
  if (affected > 0) {
    console.log(`✅ Deleted API key: ${apiKey}`)
    return true
  }

  return false
}

/**
 * Get API key details (without sensitive key value)
 */
export async function getAPIKeyInfo(apiKey: string, userId: string): Promise<APIKey | null> {
  const result = await executeQuery(
    `SELECT id, user_id, api_key, name, description, is_active, created_at, last_used_at, expires_at, permissions
     FROM api_keys
     WHERE api_key = ? AND user_id = ?`,
    [apiKey, userId],
  )

  if (!Array.isArray(result) || result.length === 0) {
    return null
  }

  const row = result[0] as any

  return {
    id: row.id,
    user_id: row.user_id,
    api_key: row.api_key,
    name: row.name,
    description: row.description,
    is_active: Boolean(row.is_active),
    created_at: new Date(row.created_at),
    last_used_at: row.last_used_at ? new Date(row.last_used_at) : null,
    expires_at: row.expires_at ? new Date(row.expires_at) : null,
    permissions: row.permissions ? JSON.parse(row.permissions) : null,
  }
}

/**
 * Mask API key for display (show only last 8 chars)
 */
export function maskAPIKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return "****"
  }

  const visibleChars = 8
  const masked = "*".repeat(apiKey.length - visibleChars)
  return masked + apiKey.slice(-visibleChars)
}

/**
 * Clean up expired API keys
 */
export async function cleanupExpiredAPIKeys(): Promise<number> {
  const result = await executeQuery(`UPDATE api_keys SET is_active = FALSE WHERE expires_at < NOW() AND is_active = TRUE`)

  if (Array.isArray(result)) {
    return 0
  }

  const affected = (result as any).affectedRows || 0
  if (affected > 0) {
    console.log(`🧹 Deactivated ${affected} expired API keys`)
  }

  return affected
}
