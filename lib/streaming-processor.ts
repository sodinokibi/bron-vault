import { createReadStream, createWriteStream } from "fs"
import { unlink, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import unzipper from "unzipper"
import crypto from "crypto"
import { executeQuery } from "./mysql"
import { processSoftwareFiles } from "./software-parser"

// Password escape/unescape functions (same as in upload/route.ts)
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
function parsePasswordFile(content: string): Array<{
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
function isSystemFile(pathParts: string[]): boolean {
  if (pathParts.length === 0) return false

  const systemFiles = new Set(["__macosx", ".ds_store"])
  const firstPart = pathParts[0].toLowerCase()

  // Skip macOS system files
  if (systemFiles.has(firstPart)) return true
  if (firstPart.startsWith(".")) return true

  return false
}

// Extract device name from path
function extractDeviceName(pathParts: string[]): string | null {
  if (pathParts.length === 0) return null
  if (isSystemFile(pathParts)) return null
  return pathParts[0]
}

// Process ZIP file with streaming (memory efficient)
export async function processZipFileStreaming(
  zipFilePath: string,
  uploadBatch: string,
  progressCallback: (progress: number, message: string) => Promise<void>,
) {
  await progressCallback(10, "Initializing ZIP processing...")

  const deviceMap = new Map<string, any[]>()
  const deviceCredentials = new Map<string, any[]>()
  const deviceFiles = new Map<string, any[]>()

  // Create extraction directory
  const today = new Date().toISOString().split("T")[0]
  const extractionBaseDir = path.join(process.cwd(), "uploads", "extracted_files", today, uploadBatch)

  if (!existsSync(extractionBaseDir)) {
    await mkdir(extractionBaseDir, { recursive: true })
  }

  await progressCallback(15, "Reading ZIP file...")

  // First pass: Collect all files and organize by device
  const fileEntries: Array<{
    path: string
    deviceName: string
    isDirectory: boolean
    size: number
  }> = []

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipFilePath)
      .pipe(unzipper.Parse())
      .on("entry", (entry: any) => {
        const pathParts = entry.path.split("/").filter((p: string) => p.length > 0)
        const deviceName = extractDeviceName(pathParts)

        if (!deviceName) {
          entry.autodrain()
          return
        }

        if (entry.type === "Directory") {
          entry.autodrain()
          return
        }

        fileEntries.push({
          path: entry.path,
          deviceName,
          isDirectory: false,
          size: entry.vars.uncompressedSize || 0,
        })

        if (!deviceMap.has(deviceName)) {
          deviceMap.set(deviceName, [])
        }

        deviceMap.get(deviceName)?.push(entry.path)
        entry.autodrain()
      })
      .on("close", () => resolve())
      .on("error", (err: any) => reject(err))
  })

  const totalDevices = deviceMap.size
  await progressCallback(20, `Found ${totalDevices} devices in ZIP`)

  // Second pass: Process each device
  let deviceIndex = 0

  for (const [deviceName, filePaths] of deviceMap.entries()) {
    deviceIndex++
    const deviceProgress = 20 + ((deviceIndex / totalDevices) * 70)

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
      await progressCallback(deviceProgress, `Skipping duplicate device: ${deviceName}`)
      continue
    }

    // Third pass: Extract and process files for this device
    const passwordFileContents: string[] = []
    const deviceFilesList: any[] = []

    await new Promise<void>((resolve, reject) => {
      createReadStream(zipFilePath)
        .pipe(unzipper.Parse())
        .on("entry", async (entry: any) => {
          try {
            const pathParts = entry.path.split("/").filter((p: string) => p.length > 0)
            const entryDeviceName = extractDeviceName(pathParts)

            if (entryDeviceName !== deviceName) {
              entry.autodrain()
              return
            }

            if (entry.type === "Directory") {
              entry.autodrain()
              return
            }

            const fileName = pathParts[pathParts.length - 1]
            const relativePath = pathParts.slice(1).join("/")

            // Check if it's a password file
            if (isPasswordFile(fileName)) {
              const chunks: Buffer[] = []
              for await (const chunk of entry) {
                chunks.push(chunk)
              }
              const content = Buffer.concat(chunks).toString("utf-8")
              passwordFileContents.push(content)
            } else {
              // Save file to disk
              const outputPath = path.join(extractionBaseDir, deviceId, relativePath)
              const outputDir = path.dirname(outputPath)

              if (!existsSync(outputDir)) {
                await mkdir(outputDir, { recursive: true })
              }

              const writeStream = createWriteStream(outputPath)
              entry.pipe(writeStream)

              await new Promise<void>((res, rej) => {
                writeStream.on("finish", () => res())
                writeStream.on("error", rej)
              })

              deviceFilesList.push({
                path: relativePath,
                name: fileName,
                size: entry.vars.uncompressedSize || 0,
                localPath: outputPath,
              })
            }
          } catch (err) {
            console.error(`Error processing entry ${entry.path}:`, err)
            entry.autodrain()
          }
        })
        .on("close", () => resolve())
        .on("error", (err: any) => reject(err))
    })

    // Parse credentials from password files
    const allCredentials: any[] = []
    for (const content of passwordFileContents) {
      const creds = parsePasswordFile(content)
      allCredentials.push(...creds)
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
        deviceFilesList.length,
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
    for (const file of deviceFilesList) {
      await executeQuery(
        `INSERT INTO files (device_id, file_path, file_name, file_size, local_file_path) VALUES (?, ?, ?, ?, ?)`,
        [deviceId, file.path, file.name, file.size, file.localPath],
      )
    }

    await progressCallback(deviceProgress, `Device ${deviceName} processed: ${allCredentials.length} credentials`)
  }

  // Delete uploaded ZIP file
  try {
    await unlink(zipFilePath)
    await progressCallback(95, "Cleaned up ZIP file")
  } catch (err) {
    console.error("Failed to delete ZIP file:", err)
  }

  await progressCallback(100, "Processing complete!")

  return {
    devicesProcessed: deviceMap.size,
    totalFiles: fileEntries.length,
    totalCredentials: Array.from(deviceCredentials.values()).reduce((sum, arr) => sum + arr.length, 0),
    totalDomains: 0,
    totalUrls: 0,
  }
}
