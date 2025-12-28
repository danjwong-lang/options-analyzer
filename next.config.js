/** @type {import('next').NextConfig} */
const nextConfig = {
  // Increase timeout for API routes (needed for multiple ticker analysis)
  experimental: {
    serverComponentsExternalPackages: ['yahoo-finance2']
  }
};

module.exports = nextConfig;
