import { readdir, unlink, mkdir, stat, readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import crypto from "crypto"
import { executeQuery } from "./mysql"
import { extractArchive, detectArchiveType, type ArchiveFormat } from "./archive-handler"

// Password escape function
function escapePassword(password: string): string {
  if (!password) return password
  return password
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
}

// Helper to extract URL info
function extractUrlInfo(url: string): { domain: string | null; tld: string | null } {
  try {
    if (!url || url.trim() === "") {
      return { domain: null, tld: null }
    }

    let cleanUrl = url.trim()
    cleanUrl = cleanUrl.replace(/^https?:\/\//, "")
    cleanUrl = cleanUrl.replace(/^www\./, "")

    const hostname = cleanUrl.split("/")[0].split(":")[0].toLowerCase()

    // Check if it's an IP address
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (ipRegex.test(hostname)) {
      return { domain: hostname, tld: null }
    }

    const parts = hostname.split(".")
    const tld = parts.length > 1 ? parts[parts.length - 1] : null

    return { domain: hostname, tld }
  } catch (error) {
    return { domain: null, tld: null }
  }
}

// Extract value from line
function extractValue(line: string): string {
  const colonIndex = line.indexOf(":")
  if (colonIndex === -1) return ""
  return line.substring(colonIndex + 1).trim()
}

// Parse password file content
function parsePasswordFile(
  content: string,
): Array<{
  url: string
  domain: string | null
  tld: string | null
  username: string
  password: string
  browser: string | null
}> {
  const credentials: Array<{
    url: string
    domain: string | null
    tld: string | null
    username: string
    password: string
    browser: string | null
  }> = []

  const lines = content.split(/\r?\n/)
  let currentCredential: Partial<{
    url: string
    username: string
    password: string
    browser: string
  }> = {}

  for (const line of lines) {
    const trimmed = line.trim()

    if (!trimmed) {
      if (currentCredential.url && currentCredential.username && currentCredential.password) {
        const urlInfo = extractUrlInfo(currentCredential.url)
        credentials.push({
          url: currentCredential.url,
          domain: urlInfo.domain,
          tld: urlInfo.tld,
          username: currentCredential.username,
          password: currentCredential.password,
          browser: currentCredential.browser || null,
        })
      }
      currentCredential = {}
      continue
    }

    const lowerLine = trimmed.toLowerCase()

    if (lowerLine.includes("url:") || lowerLine.includes("host:") || lowerLine.includes("hostname:")) {
      currentCredential.url = extractValue(trimmed)
    } else if (lowerLine.includes("username:") || lowerLine.includes("user:") || lowerLine.includes("login:")) {
      currentCredential.username = extractValue(trimmed)
    } else if (lowerLine.includes("password:") || lowerLine.includes("pass:")) {
      const password = extractValue(trimmed)
      try {
        const testEscape = escapePassword(password)
        if (testEscape !== null && testEscape !== undefined) {
          currentCredential.password = password
        }
      } catch (escapeError) {
        console.warn(`Skipping invalid password: ${password.substring(0, 10)}...`)
      }
    } else if (lowerLine.includes("browser:") || lowerLine.includes("soft:") || lowerLine.includes("application:")) {
      currentCredential.browser = extractValue(trimmed)
    }
  }

  // Add the last credential if valid
  if (currentCredential.url && currentCredential.username && currentCredential.password) {
    const urlInfo = extractUrlInfo(currentCredential.url)
    credentials.push({
      url: currentCredential.url,
      domain: urlInfo.domain,
      tld: urlInfo.tld,
      username: currentCredential.username,
      password: currentCredential.password,
      browser: currentCredential.browser || null,
    })
  }

  return credentials
}

// Check if file is a password file
function isPasswordFile(filename: string): boolean {
  const lowerFileName = filename.toLowerCase()
  return (
    lowerFileName === "all passwords.txt" ||
    lowerFileName === "all_passwords.txt" ||
    lowerFileName === "passwords.txt" ||
    lowerFileName === "allpasswords_list.txt" ||
    lowerFileName === "_allpasswords_list.txt"
  )
}

// Check if file is a system file to skip
function isSystemFile(filename: string): boolean {
  const lower = filename.toLowerCase()
  return lower === ".ds_store" || lower.startsWith(".") || lower === "__macosx"
}

// Recursively scan directory for files
async function scanDirectory(
  dirPath: string,
  basePath: string = "",
): Promise<
  Array<{
    path: string
    name: string
    size: number
    isDirectory: boolean
  }>
> {
  const files: Array<{
    path: string
    name: string
    size: number
    isDirectory: boolean
  }> = []

  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    if (isSystemFile(entry.name)) {
      continue
    }

    const fullPath = path.join(dirPath, entry.name)
    const relativePath = path.join(basePath, entry.name)

    if (entry.isDirectory()) {
      const subFiles = await scanDirectory(fullPath, relativePath)
      files.push(...subFiles)
    } else {
      const stats = await stat(fullPath)
      files.push({
        path: relativePath,
        name: entry.name,
        size: stats.size,
        isDirectory: false,
      })
    }
  }

  return files
}

// Extract device name from path
function extractDeviceName(filePath: string): string | null {
  const parts = filePath.split(path.sep).filter((p) => p.length > 0)
  if (parts.length === 0) return null
  return parts[0]
}

/**
 * Process archive file (any supported format)
 */
export async function processArchiveFile(
  archiveFilePath: string,
  archiveType: ArchiveFormat,
  uploadBatch: string,
  password: string | null,
  progressCallback: (progress: number, message: string) => Promise<void>,
) {
  await progressCallback(10, `Initializing ${archiveType} archive processing...`)

  // Create extraction directory
  const today = new Date().toISOString().split("T")[0]
  const extractionDir = path.join(process.cwd(), "uploads", "extracted_files", today, uploadBatch)

  if (!existsSync(extractionDir)) {
    await mkdir(extractionDir, { recursive: true })
  }

  await progressCallback(15, "Extracting archive...")

  // Extract archive
  const customPasswords = password ? [password] : []
  const extractResult = await extractArchive(archiveFilePath, extractionDir, archiveType, customPasswords)

  if (!extractResult.success) {
    throw new Error(extractResult.error || "Failed to extract archive")
  }

  if (extractResult.password) {
    await progressCallback(
      20,
      `✅ Archive extracted successfully with password: ${extractResult.password === "" ? "(no password)" : "***"}`,
    )
  } else {
    await progressCallback(20, "✅ Archive extracted successfully")
  }

  // Scan extracted files
  await progressCallback(25, "Scanning extracted files...")
  const allFiles = await scanDirectory(extractionDir)

  await progressCallback(30, `Found ${allFiles.length} files`)

  // Group files by device
  const deviceMap = new Map<string, typeof allFiles>()

  for (const file of allFiles) {
    const deviceName = extractDeviceName(file.path)
    if (!deviceName) continue

    if (!deviceMap.has(deviceName)) {
      deviceMap.set(deviceName, [])
    }

    deviceMap.get(deviceName)?.push(file)
  }

  const totalDevices = deviceMap.size
  await progressCallback(35, `Identified ${totalDevices} devices`)

  // Process each device
  let deviceIndex = 0
  let totalCredentials = 0
  let totalDomains = new Set<string>()
  let totalUrls = new Set<string>()

  for (const [deviceName, files] of deviceMap.entries()) {
    deviceIndex++
    const deviceProgress = 35 + ((deviceIndex / totalDevices) * 60)

    await progressCallback(deviceProgress, `Processing device ${deviceIndex}/${totalDevices}: ${deviceName}`)

    // Generate device ID
    const deviceNameHash = crypto.createHash("sha256").update(deviceName).digest("hex")
    const deviceId = `${deviceNameHash.substring(0, 16)}_${Date.now()}`

    // Check for duplicate device
    const existingDevice = await executeQuery(
      "SELECT device_id FROM devices WHERE device_name_hash = ? LIMIT 1",
      [deviceNameHash],
    )

    if (Array.isArray(existingDevice) && existingDevice.length > 0) {
      await progressCallback(deviceProgress, `⚠️ Skipping duplicate device: ${deviceName}`)
      continue
    }

    // Find password files
    const passwordFiles = files.filter((f) => isPasswordFile(f.name))

    // Parse credentials from password files
    const allCredentials: any[] = []

    for (const pwdFile of passwordFiles) {
      const fullPath = path.join(extractionDir, pwdFile.path)
      try {
        const content = await readFile(fullPath, "utf-8")
        const creds = parsePasswordFile(content)
        allCredentials.push(...creds)
      } catch (err) {
        console.error(`Failed to parse password file ${pwdFile.path}:`, err)
      }
    }

    // Insert device
    await executeQuery(
      `INSERT INTO devices (device_id, device_name, device_name_hash, upload_batch, total_files, total_credentials, total_domains, total_urls)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        deviceName,
        deviceNameHash,
        uploadBatch,
        files.length,
        allCredentials.length,
        new Set(allCredentials.map((c) => c.domain).filter((d) => d)).size,
        new Set(allCredentials.map((c) => c.url)).size,
      ],
    )

    // Insert credentials in batches
    const batchSize = 50
    for (let i = 0; i < allCredentials.length; i += batchSize) {
      const batch = allCredentials.slice(i, i + batchSize)
      const values = batch.map((c) => [
        deviceId,
        c.url,
        c.domain,
        c.tld,
        c.username,
        escapePassword(c.password),
        c.browser,
        "passwords.txt",
      ])

      if (values.length > 0) {
        const placeholders = values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")
        await executeQuery(
          `INSERT INTO credentials (device_id, url, domain, tld, username, password, browser, file_path) VALUES ${placeholders}`,
          values.flat(),
        )
      }
    }

    // Insert files
    for (const file of files) {
      const fullPath = path.join(extractionDir, file.path)
      await executeQuery(
        `INSERT INTO files (device_id, file_path, file_name, file_size, local_file_path) VALUES (?, ?, ?, ?, ?)`,
        [deviceId, file.path, file.name, file.size, fullPath],
      )
    }

    totalCredentials += allCredentials.length
    allCredentials.forEach((c) => {
      if (c.domain) totalDomains.add(c.domain)
      totalUrls.add(c.url)
    })

    await progressCallback(deviceProgress, `✅ Device ${deviceName}: ${allCredentials.length} credentials processed`)
  }

  // Delete archive file
  try {
    await unlink(archiveFilePath)
    await progressCallback(95, "Cleaned up archive file")
  } catch (err) {
    console.error("Failed to delete archive file:", err)
  }

  await progressCallback(100, "Processing complete!")

  return {
    devicesProcessed: deviceMap.size,
    totalFiles: allFiles.length,
    totalCredentials,
    totalDomains: totalDomains.size,
    totalUrls: totalUrls.size,
  }
}
