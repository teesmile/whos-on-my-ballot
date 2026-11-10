import type { NextConfig } from 'next'

// The site is static files (out/), generated from data/generated at build time. scripts/postbuild.mjs then
// removes the framework runtime and adds one small module for the lookup (decision D-022).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Each static-generation worker loads every state's geography; BUILD_CPUS lowers the worker count on a machine short of memory.
  ...(process.env.BUILD_CPUS ? { experimental: { cpus: Number(process.env.BUILD_CPUS) } } : {}),
}

export default nextConfig
