import Redis from "ioredis"

// Redis connection configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number.parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
}

// Create Redis connection singleton
let redisConnection: Redis | null = null

export function getRedisConnection(): Redis {
  if (!redisConnection) {
    redisConnection = new Redis(redisConfig)

    redisConnection.on("connect", () => {
      console.log("✅ Redis connected successfully")
    })

    redisConnection.on("error", (error) => {
      console.error("❌ Redis connection error:", error)
    })

    redisConnection.on("ready", () => {
      console.log("🚀 Redis is ready to accept commands")
    })

    redisConnection.on("close", () => {
      console.log("⚠️ Redis connection closed")
    })
  }

  return redisConnection
}

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    const redis = getRedisConnection()
    await redis.ping()
    console.log("✅ Redis ping successful")
    return true
  } catch (error) {
    console.error("❌ Redis connection test failed:", error)
    return false
  }
}

// Close Redis connection (for graceful shutdown)
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit()
    redisConnection = null
    console.log("✅ Redis connection closed")
  }
}
