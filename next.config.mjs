/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bundle optimization
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn']
    } : false,
  },
  eslint: {
    // Only ignore during builds in development, not production
    ignoreDuringBuilds: process.env.NODE_ENV === 'development',
  },
  typescript: {
    // Only ignore build errors in development, not production
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },
  images: {
    unoptimized: true,
  },
  // Add performance optimizations
  experimental: {
    // Disable CSS optimization to avoid critters dependency issue
    // optimizeCss: true,
    // Large payload handling (configured per-route in API handlers)
    isrMemoryCacheSize: 0, // Disable ISR cache to save memory for large uploads
  },
  // Server-side configuration
  serverRuntimeConfig: {
    // Server-only runtime config
    maxUploadSize: 10737418240, // 10GB in bytes
  },
  publicRuntimeConfig: {
    // Available on both server and client
    maxChunkSize: 52428800, // 50MB chunks
  },
  // Add security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

export default nextConfig
