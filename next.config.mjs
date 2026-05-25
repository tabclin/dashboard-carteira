/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
    serverComponentsExternalPackages: ['pdfjs-dist', '@prisma/client', '@prisma/adapter-pg', 'pg'],
  },
}

export default nextConfig
