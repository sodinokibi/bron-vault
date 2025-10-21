/**
 * Stealer Auto-Detection System
 *
 * Automatically detects which stealer malware created a log based on file structure
 */

import type {
  StealerParser,
  ParsedFile,
  StealerFamily,
  ParsedStealerData,
} from "./types"
import { StealCParser } from "./stealc-parser"
import { LummaParser } from "./lumma-parser"
import { RedlineParser } from "./redline-parser"
import { RaccoonParser } from "./raccoon-parser"

/**
 * All available parsers
 */
const PARSERS: StealerParser[] = [
  new StealCParser(),
  new LummaParser(),
  new RedlineParser(),
  new RaccoonParser(),
]

/**
 * Detection result
 */
export interface DetectionResult {
  parser: StealerParser | null
  family: StealerFamily
  confidence: number
  allResults: Array<{
    parser: StealerParser
    confidence: number
    canParse: boolean
  }>
}

/**
 * Detect which stealer created the logs
 *
 * @param files List of files from the log
 * @returns Detection result with best matching parser
 */
export function detectStealerType(files: ParsedFile[]): DetectionResult {
  const results = PARSERS.map((parser) => {
    const detection = parser.canParse(files)
    return {
      parser,
      confidence: detection.confidence,
      canParse: detection.canParse,
    }
  })

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence)

  const bestMatch = results[0]

  if (bestMatch && bestMatch.canParse) {
    return {
      parser: bestMatch.parser,
      family: bestMatch.parser.getMetadata().family,
      confidence: bestMatch.confidence,
      allResults: results,
    }
  }

  // No parser matched - return unknown
  return {
    parser: null,
    family: "Unknown" as StealerFamily,
    confidence: 0,
    allResults: results,
  }
}

/**
 * Parse stealer logs using auto-detection
 *
 * @param files List of files from the log
 * @param deviceId Device ID for the logs
 * @returns Parsed stealer data
 */
export async function parseStealerLogs(
  files: ParsedFile[],
  deviceId: string,
): Promise<ParsedStealerData> {
  const detection = detectStealerType(files)

  console.log(`🔍 Stealer Detection Results:`)
  console.log(
    `   Best Match: ${detection.family} (confidence: ${(detection.confidence * 100).toFixed(1)}%)`,
  )

  for (const result of detection.allResults.slice(0, 3)) {
    const metadata = result.parser.getMetadata()
    console.log(
      `   - ${metadata.name}: ${(result.confidence * 100).toFixed(1)}% ${result.canParse ? "✓" : "✗"}`,
    )
  }

  // Use the detected parser, or fall back to generic parsing
  if (detection.parser) {
    console.log(`✅ Using ${detection.parser.getMetadata().name}`)
    return await detection.parser.parse(files, deviceId)
  }

  console.log(`⚠️  No specific stealer detected, using generic parser`)
  return await parseGeneric(files, deviceId)
}

/**
 * Generic parser fallback when no specific stealer is detected
 */
async function parseGeneric(
  files: ParsedFile[],
  deviceId: string,
): Promise<ParsedStealerData> {
  const { parsePasswordFile, parseNetscapeCookies, parseJSONCookies } =
    await import("./utils")

  const credentials: any[] = []
  const cookies: any[] = []

  // Try to parse any password-like files
  const passwordFiles = files.filter(
    (f) =>
      !f.is_directory &&
      (f.file_name.match(/password/i) || f.file_name.match(/login/i)),
  )

  for (const file of passwordFiles) {
    if (file.content) {
      const creds = parsePasswordFile(file.content, file.file_path)
      credentials.push(...creds)
    }
  }

  // Try to parse any cookie files
  const cookieFiles = files.filter(
    (f) => !f.is_directory && f.file_name.match(/cookie/i),
  )

  for (const file of cookieFiles) {
    if (!file.content) continue

    if (file.file_name.match(/\.json$/i)) {
      const parsedCookies = parseJSONCookies(file.content, file.file_path)
      cookies.push(...parsedCookies)
    } else {
      const parsedCookies = parseNetscapeCookies(file.content, file.file_path)
      cookies.push(...parsedCookies)
    }
  }

  return {
    metadata: {
      stealer_family: "Unknown" as StealerFamily,
      detection_confidence: 0,
      indicators: ["Generic parsing"],
    },
    credentials,
    cookies,
    extensions: [],
    autofill: [],
    credit_cards: [],
    crypto_wallets: [],
    messenger_tokens: [],
    ftp_credentials: [],
    gaming_sessions: [],
    files,
  }
}

/**
 * Get list of all supported stealer families
 */
export function getSupportedStealers(): Array<{
  name: string
  family: StealerFamily
  description: string
}> {
  return PARSERS.map((parser) => parser.getMetadata())
}

/**
 * Get parser for specific stealer family
 */
export function getParserByFamily(
  family: StealerFamily,
): StealerParser | null {
  return PARSERS.find((p) => p.getMetadata().family === family) || null
}

/**
 * Add custom parser to the detection system
 */
export function registerParser(parser: StealerParser): void {
  PARSERS.push(parser)
  console.log(`✅ Registered parser: ${parser.getMetadata().name}`)
}
