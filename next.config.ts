import type { NextConfig } from 'next'

// The site is static files (out/), generated from data/generated at build time. scripts/postbuild.mjs then
// removes the framework runtime and adds one small module for the lookup (decision D-022).
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
}

export default nextConfig
