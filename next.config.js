/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
  images: {
    domains: [
      "uploadthing.com",
      "utfs.io",
      "picsum.photos",
      "s3.eu-central-1.wasabisys.com", // S3/Wasabi storage
    ],
  },
};

module.exports = nextConfig;
