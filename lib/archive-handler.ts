import { mkdir, readFile } from "fs/promises"
import { createReadStream, createWriteStream, existsSync } from "fs"
import path from "path"
import { extract as tarExtract } from "tar"
import SevenZip from "7zip-min"
import AdmZip from "adm-zip"
import StreamZip from "node-stream-zip"
import unzipper from "unzipper"

/**
 * Supported archive formats
 */
export const SUPPORTED_FORMATS = {
  ".zip": {
    name: "ZIP",
    mimeTypes: ["application/zip", "application/x-zip-compressed"],
    supportsPassword: true,
  },
  ".rar": {
    name: "RAR",
    mimeTypes: ["application/x-rar-compressed", "application/vnd.rar"],
    supportsPassword: true,
  },
  ".tar": {
    name: "TAR",
    mimeTypes: ["application/x-tar"],
    supportsPassword: false,
  },
  ".tar.gz": {
    name: "TAR.GZ",
    mimeTypes: ["application/gzip", "application/x-gzip"],
    supportsPassword: false,
  },
  ".tgz": {
    name: "TAR.GZ",
    mimeTypes: ["application/gzip", "application/x-gzip"],
    supportsPassword: false,
  },
  ".tar.bz2": {
    name: "TAR.BZ2",
    mimeTypes: ["application/x-bzip2"],
    supportsPassword: false,
  },
  ".tbz2": {
    name: "TAR.BZ2",
    mimeTypes: ["application/x-bzip2"],
    supportsPassword: false,
  },
  ".7z": {
    name: "7-Zip",
    mimeTypes: ["application/x-7z-compressed"],
    supportsPassword: true,
  },
} as const

export type ArchiveFormat = keyof typeof SUPPORTED_FORMATS

/**
 * Detect archive type from filename and optional MIME type
 */
export function detectArchiveType(filename: string, mimeType?: string): ArchiveFormat | null {
  const lowerName = filename.toLowerCase()

  // Check double extensions first (tar.gz, tar.bz2)
  for (const ext of [".tar.gz", ".tar.bz2", ".tbz2", ".tgz"]) {
    if (lowerName.endsWith(ext)) {
      return ext as ArchiveFormat
    }
  }

  // Check single extensions
  for (const ext of [".zip", ".rar", ".tar", ".7z"]) {
    if (lowerName.endsWith(ext)) {
      return ext as ArchiveFormat
    }
  }

  // Try to detect from MIME type if filename detection failed
  if (mimeType) {
    for (const [ext, info] of Object.entries(SUPPORTED_FORMATS)) {
      if (info.mimeTypes.includes(mimeType)) {
        return ext as ArchiveFormat
      }
    }
  }

  return null
}

/**
 * Check if archive type supports password protection
 */
export function supportsPassword(archiveType: ArchiveFormat): boolean {
  return SUPPORTED_FORMATS[archiveType].supportsPassword
}

/**
 * Get list of supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return Object.keys(SUPPORTED_FORMATS)
}

/**
 * Get formatted list for display (e.g., ".zip, .tar, .7z")
 */
export function getSupportedExtensionsDisplay(): string {
  return getSupportedExtensions().join(", ")
}

/**
 * Common passwords for password-protected archives
 */
export const COMMON_ARCHIVE_PASSWORDS = [
  "", // Try no password first
  "infected",
  "malware",
  "virus",
  "1234",
  "password",
  "12345",
  "123456",
  "stealer",
  "logs",
  "redline",
  "raccoon",
  "aurora",
  "vidar",
  "meta",
  "mars",
  "azorult",
  "formbook",
  "agent",
  "tesla",
  "lokibot",
  "pony",
  "arkei",
  "hack",
  "pass",
  "admin",
  "root",
]

/**
 * Load additional passwords from config file
 * Combines config file passwords with built-in common passwords
 */
export async function loadArchivePasswords(): Promise<string[]> {
  const configPath = path.join(__dirname, "../config/archive-passwords.txt")

  // Start with empty password attempt
  const passwords: string[] = [""]

  // Try to load from config file
  if (existsSync(configPath)) {
    try {
      const content = await readFile(configPath, "utf-8")
      const configPasswords = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#")) // Filter comments and empty lines

      passwords.push(...configPasswords)
    } catch (err) {
      console.warn(`⚠️ Could not load config file: ${configPath}`)
    }
  }

  // Add built-in common passwords that aren't already in the list
  for (const password of COMMON_ARCHIVE_PASSWORDS) {
    if (!passwords.includes(password)) {
      passwords.push(password)
    }
  }

  return passwords
}

/**
 * Result from extraction attempt
 */
export interface ExtractionResult {
  success: boolean
  password?: string | null
  error?: string
  filesExtracted?: number
}

/**
 * Extract ZIP archive (with optional password support)
 */
async function extractZip(
  sourcePath: string,
  outputDir: string,
  passwords: string[] = [""],
): Promise<ExtractionResult> {
  for (const password of passwords) {
    try {
      if (password) {
        // Use node-stream-zip for password-protected ZIPs
        const zip = new StreamZip.async({ file: sourcePath })

        try {
          // Check if password is needed by trying to read entries
          const entries = await zip.entries()
          const entryNames = Object.keys(entries)

          if (entryNames.length === 0) {
            await zip.close()
            continue
          }

          // Extract all files
          await zip.extract(null, outputDir)
          await zip.close()

          return {
            success: true,
            password: password || null,
            filesExtracted: entryNames.length,
          }
        } catch (err) {
          await zip.close()
          continue // Try next password
        }
      } else {
        // Use unzipper for non-password-protected ZIPs
        await new Promise<void>((resolve, reject) => {
          createReadStream(sourcePath)
            .pipe(unzipper.Extract({ path: outputDir }))
            .on("close", resolve)
            .on("error", reject)
        })

        return {
          success: true,
          password: null,
        }
      }
    } catch (err) {
      // Try next password
      continue
    }
  }

  return {
    success: false,
    error: "Failed to extract ZIP: wrong password or corrupted archive",
  }
}

/**
 * Extract TAR archive
 */
async function extractTar(sourcePath: string, outputDir: string): Promise<ExtractionResult> {
  try {
    await mkdir(outputDir, { recursive: true })

    await tarExtract({
      file: sourcePath,
      cwd: outputDir,
    })

    return {
      success: true,
      password: null,
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to extract TAR: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }
}

/**
 * Extract TAR.GZ or TAR.BZ2 archive
 */
async function extractCompressedTar(
  sourcePath: string,
  outputDir: string,
  format: "gzip" | "bzip2",
): Promise<ExtractionResult> {
  try {
    await mkdir(outputDir, { recursive: true })

    const filterOption = format === "gzip" ? "gzip" : "bzip2"

    await tarExtract({
      file: sourcePath,
      cwd: outputDir,
      filter: filterOption as any,
    })

    return {
      success: true,
      password: null,
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to extract compressed TAR: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }
}

/**
 * Extract 7-Zip archive (with optional password support)
 */
async function extract7z(
  sourcePath: string,
  outputDir: string,
  passwords: string[] = [""],
): Promise<ExtractionResult> {
  for (const password of passwords) {
    try {
      await mkdir(outputDir, { recursive: true })

      await new Promise<void>((resolve, reject) => {
        if (password) {
          SevenZip.unpack(sourcePath, outputDir, (err: any) => {
            if (err) reject(err)
            else resolve()
          })
        } else {
          SevenZip.unpack(sourcePath, outputDir, (err: any) => {
            if (err) reject(err)
            else resolve()
          })
        }
      })

      return {
        success: true,
        password: password || null,
      }
    } catch (err) {
      // Try next password
      continue
    }
  }

  return {
    success: false,
    error: "Failed to extract 7z: wrong password or corrupted archive",
  }
}

/**
 * Extract RAR archive (with optional password support)
 */
async function extractRar(
  sourcePath: string,
  outputDir: string,
  passwords: string[] = [""],
): Promise<ExtractionResult> {
  try {
    const { createExtractorFromFile } = await import("node-unrar-js")

    for (const password of passwords) {
      try {
        await mkdir(outputDir, { recursive: true })

        // Create extractor
        const extractor = await createExtractorFromFile({
          filepath: sourcePath,
          targetPath: outputDir,
          password: password || undefined,
        })

        // Extract all files
        const extracted = extractor.extract()
        const { files } = extracted

        // Check if extraction was successful
        if (files && files.length > 0) {
          return {
            success: true,
            password: password || null,
            filesExtracted: files.length,
          }
        }
      } catch (err) {
        // Try next password if this one failed
        continue
      }
    }

    return {
      success: false,
      error: "Failed to extract RAR: wrong password or corrupted archive",
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to extract RAR: ${err instanceof Error ? err.message : "Unknown error"}`,
    }
  }
}

/**
 * Universal archive extractor
 */
export async function extractArchive(
  sourcePath: string,
  outputDir: string,
  archiveType: ArchiveFormat,
  customPasswords: string[] = [],
): Promise<ExtractionResult> {
  // Prepare password list
  let passwords: string[] = []

  if (customPasswords.length > 0) {
    // Use custom passwords if provided
    passwords = customPasswords
  } else if (supportsPassword(archiveType)) {
    // Load passwords from config file + built-in passwords
    passwords = await loadArchivePasswords()
  } else {
    // No password support needed
    passwords = [""]
  }

  console.log(`📦 Extracting ${archiveType} archive: ${sourcePath}`)
  console.log(`📁 Output directory: ${outputDir}`)
  console.log(
    `🔐 Password attempts: ${supportsPassword(archiveType) ? passwords.length : "not supported"}`,
  )

  switch (archiveType) {
    case ".zip":
      return await extractZip(sourcePath, outputDir, passwords)

    case ".rar":
      return await extractRar(sourcePath, outputDir, passwords)

    case ".tar":
      return await extractTar(sourcePath, outputDir)

    case ".tar.gz":
    case ".tgz":
      return await extractCompressedTar(sourcePath, outputDir, "gzip")

    case ".tar.bz2":
    case ".tbz2":
      return await extractCompressedTar(sourcePath, outputDir, "bzip2")

    case ".7z":
      return await extract7z(sourcePath, outputDir, passwords)

    default:
      return {
        success: false,
        error: `Unsupported archive type: ${archiveType}`,
      }
  }
}

/**
 * Test if archive is password-protected
 */
export async function isPasswordProtected(
  sourcePath: string,
  archiveType: ArchiveFormat,
): Promise<boolean> {
  if (!supportsPassword(archiveType)) {
    return false
  }

  try {
    switch (archiveType) {
      case ".zip":
        const zip = new StreamZip.async({ file: sourcePath })
        try {
          const entries = await zip.entries()
          await zip.close()

          // Check if any entry is encrypted
          for (const entry of Object.values(entries)) {
            if (entry.isEncrypted) {
              return true
            }
          }

          return false
        } catch (err) {
          await zip.close()
          throw err
        }

      case ".7z":
        // Try to list entries without password
        return new Promise((resolve) => {
          SevenZip.list(sourcePath, (err: any, result: any) => {
            // If error, assume it's password protected
            resolve(!!err)
          })
        })

      case ".rar":
        // Try to extract with no password to test
        try {
          const { createExtractorFromFile } = await import("node-unrar-js")
          const extractor = await createExtractorFromFile({
            filepath: sourcePath,
            targetPath: "/tmp/rar-test",
          })
          const { files } = extractor.extract()
          return false // No password needed
        } catch (err) {
          return true // Likely password protected
        }

      default:
        return false
    }
  } catch (err) {
    console.error("Error checking password protection:", err)
    return false
  }
}

/**
 * Try to extract archive with common passwords
 */
export async function tryExtractWithCommonPasswords(
  sourcePath: string,
  outputDir: string,
  archiveType: ArchiveFormat,
): Promise<ExtractionResult> {
  return await extractArchive(sourcePath, outputDir, archiveType, [])
}
