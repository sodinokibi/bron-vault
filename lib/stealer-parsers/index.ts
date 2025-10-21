/**
 * Stealer Parsers Module
 *
 * Comprehensive parsing system for various stealer malware log formats
 *
 * Supported Stealers:
 * - StealC
 * - Lumma
 * - Redline
 * - Raccoon
 *
 * Usage:
 * ```typescript
 * import { parseStealerLogs, detectStealerType } from '@/lib/stealer-parsers'
 *
 * const detection = detectStealerType(files)
 * const data = await parseStealerLogs(files, deviceId)
 * ```
 */

// Core types and interfaces
export * from "./types"

// Utility functions
export * from "./utils"

// Individual parsers
export { StealCParser } from "./stealc-parser"
export { LummaParser } from "./lumma-parser"
export { RedlineParser } from "./redline-parser"
export { RaccoonParser } from "./raccoon-parser"

// Detection system
export {
  detectStealerType,
  parseStealerLogs,
  getSupportedStealers,
  getParserByFamily,
  registerParser,
  type DetectionResult,
} from "./detector"
