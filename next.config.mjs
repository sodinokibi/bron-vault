/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack configuration to handle optional dependencies
  webpack: (config, { isServer }) => {
    // Ignore optional AWS SDK dependency from unzipper
    config.resolve.alias = {
      ...config.resolve.alias,
      '@aws-sdk/client-s3': false,
    }
    return config
  },
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
