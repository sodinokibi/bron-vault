/**
 * Password Export Utilities
 *
 * Export passwords, emails, and usernames for breach database correlation
 * and hashcat wordlist generation
 */

import { RowDataPacket } from "mysql2"
import { executeQuery } from "./db"
import { writeFile } from "fs/promises"
import path from "path"

/**
 * Password statistics
 */
export interface PasswordStats {
  password: string
  count: number
  percentage: number
}

/**
 * Email/Username information for breach database lookups
 */
export interface BreachLookupData {
  email?: string
  username?: string
  domain?: string
  email_domain?: string
  source_device_id: string
}

/**
 * Export result
 */
export interface ExportResult {
  success: boolean
  file_path?: string
  total_records: number
  unique_records?: number
  error?: string
}

/**
 * Get all unique passwords from logs
 */
export async function getUniquePasswords(deviceId?: string): Promise<string[]> {
  let query = `
    SELECT DISTINCT password
    FROM credentials
    WHERE password IS NOT NULL
      AND password != ''
  `

  const params: any[] = []

  if (deviceId) {
    query += " AND device_id = ?"
    params.push(deviceId)
  }

  query += " ORDER BY password"

  const rows = (await executeQuery(query, params)) as RowDataPacket[]
  return rows.map((row) => row.password)
}

/**
 * Get password frequency statistics
 */
export async function getPasswordStats(deviceId?: string): Promise<PasswordStats[]> {
  let query = `
    SELECT
      password,
      COUNT(*) as count
    FROM credentials
    WHERE password IS NOT NULL
      AND password != ''
  `

  const params: any[] = []

  if (deviceId) {
    query += " AND device_id = ?"
    params.push(deviceId)
  }

  query += `
    GROUP BY password
    ORDER BY count DESC
  `

  const rows = (await executeQuery(query, params)) as RowDataPacket[]

  // Calculate percentages
  const total = rows.reduce((sum, row) => sum + row.count, 0)

  return rows.map((row) => ({
    password: row.password,
    count: row.count,
    percentage: (row.count / total) * 100,
  }))
}

/**
 * Export passwords to hashcat-compatible wordlist
 * One password per line, no duplicates
 */
export async function exportPasswordsForHashcat(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const passwords = await getUniquePasswords(deviceId)

    if (passwords.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No passwords found",
      }
    }

    // Write to file (one password per line)
    const content = passwords.join("\n")
    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: passwords.length,
      unique_records: passwords.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export password statistics with frequency counts
 * Useful for identifying common passwords
 */
export async function exportPasswordStatistics(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const stats = await getPasswordStats(deviceId)

    if (stats.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No passwords found",
      }
    }

    // Create output with format: count | percentage | password
    const lines = stats.map(
      (s) => `${s.count}\t${s.percentage.toFixed(2)}%\t${s.password}`,
    )
    const header = "COUNT\tPERCENTAGE\tPASSWORD"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: stats.length,
      unique_records: stats.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Get all email addresses from credentials
 */
export async function getEmailsForBreachLookup(deviceId?: string): Promise<BreachLookupData[]> {
  let query = `
    SELECT
      username as email,
      domain,
      email_domain,
      device_id as source_device_id
    FROM credentials
    WHERE is_email = TRUE
      AND username IS NOT NULL
  `

  const params: any[] = []

  if (deviceId) {
    query += " AND device_id = ?"
    params.push(deviceId)
  }

  query += " GROUP BY username, domain, email_domain, device_id"

  const rows = (await executeQuery(query, params)) as RowDataPacket[]

  return rows.map((row) => ({
    email: row.email,
    domain: row.domain,
    email_domain: row.email_domain,
    source_device_id: row.source_device_id,
  }))
}

/**
 * Get all usernames (non-email) from credentials
 */
export async function getUsernamesForBreachLookup(
  deviceId?: string,
): Promise<BreachLookupData[]> {
  let query = `
    SELECT
      username,
      domain,
      device_id as source_device_id
    FROM credentials
    WHERE (is_email = FALSE OR is_email IS NULL)
      AND username IS NOT NULL
      AND username != ''
  `

  const params: any[] = []

  if (deviceId) {
    query += " AND device_id = ?"
    params.push(deviceId)
  }

  query += " GROUP BY username, domain, device_id"

  const rows = (await executeQuery(query, params)) as RowDataPacket[]

  return rows.map((row) => ({
    username: row.username,
    domain: row.domain,
    source_device_id: row.source_device_id,
  }))
}

/**
 * Export emails for breach database lookup
 * Format: email|domain|email_domain (pipe-separated for easy parsing)
 */
export async function exportEmailsForBreachDB(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const emails = await getEmailsForBreachLookup(deviceId)

    if (emails.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No emails found",
      }
    }

    // Create output with pipe-separated format
    const lines = emails.map(
      (e) => `${e.email}|${e.domain || ""}|${e.email_domain || ""}`,
    )
    const header = "EMAIL|DOMAIN|EMAIL_DOMAIN"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: emails.length,
      unique_records: emails.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export usernames for breach database lookup
 * Format: username|domain (pipe-separated for easy parsing)
 */
export async function exportUsernamesForBreachDB(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const usernames = await getUsernamesForBreachLookup(deviceId)

    if (usernames.length === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No usernames found",
      }
    }

    // Create output with pipe-separated format
    const lines = usernames.map((u) => `${u.username}|${u.domain || ""}`)
    const header = "USERNAME|DOMAIN"
    const content = [header, ...lines].join("\n")

    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: usernames.length,
      unique_records: usernames.length,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export combined email and username list (just the values)
 * Useful for quick breach database lookups
 */
export async function exportCombinedIdentifiers(
  outputPath: string,
  deviceId?: string,
): Promise<ExportResult> {
  try {
    const emails = await getEmailsForBreachLookup(deviceId)
    const usernames = await getUsernamesForBreachLookup(deviceId)

    const identifiers = new Set<string>()

    // Add all emails
    emails.forEach((e) => {
      if (e.email) identifiers.add(e.email)
    })

    // Add all usernames
    usernames.forEach((u) => {
      if (u.username) identifiers.add(u.username)
    })

    if (identifiers.size === 0) {
      return {
        success: false,
        total_records: 0,
        error: "No identifiers found",
      }
    }

    const content = Array.from(identifiers).sort().join("\n")
    await writeFile(outputPath, content, "utf-8")

    return {
      success: true,
      file_path: outputPath,
      total_records: identifiers.size,
      unique_records: identifiers.size,
    }
  } catch (err) {
    return {
      success: false,
      total_records: 0,
      error: err instanceof Error ? err.message : "Unknown error",
    }
  }
}

/**
 * Export complete breach lookup package
 * Creates multiple files in a directory for comprehensive analysis
 */
export async function exportBreachLookupPackage(
  outputDir: string,
  deviceId?: string,
): Promise<{
  success: boolean
  files: ExportResult[]
  total_files: number
}> {
  const files: ExportResult[] = []

  // Export passwords for hashcat
  const passwordsResult = await exportPasswordsForHashcat(
    path.join(outputDir, "passwords.txt"),
    deviceId,
  )
  files.push(passwordsResult)

  // Export password statistics
  const statsResult = await exportPasswordStatistics(
    path.join(outputDir, "password-stats.txt"),
    deviceId,
  )
  files.push(statsResult)

  // Export emails for breach DB
  const emailsResult = await exportEmailsForBreachDB(
    path.join(outputDir, "emails.txt"),
    deviceId,
  )
  files.push(emailsResult)

  // Export usernames for breach DB
  const usernamesResult = await exportUsernamesForBreachDB(
    path.join(outputDir, "usernames.txt"),
    deviceId,
  )
  files.push(usernamesResult)

  // Export combined identifiers
  const combinedResult = await exportCombinedIdentifiers(
    path.join(outputDir, "identifiers.txt"),
    deviceId,
  )
  files.push(combinedResult)

  const successCount = files.filter((f) => f.success).length

  return {
    success: successCount > 0,
    files,
    total_files: files.length,
  }
}
