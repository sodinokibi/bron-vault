import { getRedisConnection } from "./redis"
import { executeQuery } from "./mysql"

interface CacheOptions {
  ttlMinutes?: number
}

/**
 * Get cached data with Redis primary, MySQL fallback
 */
export async function getCachedData<T>(
  cacheKey: string
): Promise<T | null> {
  // Try Redis first
  try {
    const redis = getRedisConnection()
    const cached = await redis.get(`cache:${cacheKey}`)

    if (cached) {
      console.log(`✅ Cache HIT (Redis): ${cacheKey}`)
      return JSON.parse(cached) as T
    }
  } catch (error) {
    console.warn(`⚠️ Redis cache read failed for ${cacheKey}, trying MySQL fallback`)
  }

  // Fallback to MySQL cache
  try {
    const cacheResult = (await executeQuery(
      "SELECT cache_data FROM analytics_cache WHERE cache_key = ? AND expires_at > NOW()",
      [cacheKey]
    )) as any[]

    if (cacheResult.length > 0) {
      console.log(`✅ Cache HIT (MySQL): ${cacheKey}`)
      const cached = cacheResult[0].cache_data

      if (typeof cached === "string") {
        return JSON.parse(cached) as T
      } else if (typeof cached === "object" && cached !== null) {
        return cached as T
      }
    }
  } catch (error) {
    console.warn(`⚠️ MySQL cache read failed for ${cacheKey}:`, error)
  }

  console.log(`❌ Cache MISS: ${cacheKey}`)
  return null
}

/**
 * Set cached data in both Redis and MySQL
 */
export async function setCachedData<T>(
  cacheKey: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttlMinutes = 5 } = options
  const dataString = JSON.stringify(data)

  // Try to cache in Redis
  try {
    const redis = getRedisConnection()
    await redis.setex(`cache:${cacheKey}`, ttlMinutes * 60, dataString)
    console.log(`✅ Cached in Redis: ${cacheKey} (TTL: ${ttlMinutes}m)`)
  } catch (error) {
    console.warn(`⚠️ Redis cache write failed for ${cacheKey}:`, error)
  }

  // Always cache in MySQL as fallback
  try {
    await executeQuery(
      "INSERT INTO analytics_cache (cache_key, cache_data, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE)) ON DUPLICATE KEY UPDATE cache_data = VALUES(cache_data), expires_at = VALUES(expires_at)",
      [cacheKey, dataString, ttlMinutes]
    )
    console.log(`✅ Cached in MySQL: ${cacheKey} (TTL: ${ttlMinutes}m)`)
  } catch (error) {
    console.warn(`⚠️ MySQL cache write failed for ${cacheKey}:`, error)
  }
}

/**
 * Invalidate cache entry in both Redis and MySQL
 */
export async function invalidateCache(cacheKey: string): Promise<void> {
  // Invalidate Redis
  try {
    const redis = getRedisConnection()
    await redis.del(`cache:${cacheKey}`)
    console.log(`✅ Invalidated Redis cache: ${cacheKey}`)
  } catch (error) {
    console.warn(`⚠️ Redis cache invalidation failed for ${cacheKey}`)
  }

  // Invalidate MySQL
  try {
    await executeQuery("DELETE FROM analytics_cache WHERE cache_key = ?", [cacheKey])
    console.log(`✅ Invalidated MySQL cache: ${cacheKey}`)
  } catch (error) {
    console.warn(`⚠️ MySQL cache invalidation failed for ${cacheKey}:`, error)
  }
}

/**
 * Invalidate all cache entries matching a pattern (Redis only)
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  try {
    const redis = getRedisConnection()
    const keys = await redis.keys(`cache:${pattern}`)

    if (keys.length > 0) {
      await redis.del(...keys)
      console.log(`✅ Invalidated ${keys.length} Redis cache entries matching: ${pattern}`)
    }
  } catch (error) {
    console.warn(`⚠️ Redis pattern invalidation failed for ${pattern}:`, error)
  }
}
