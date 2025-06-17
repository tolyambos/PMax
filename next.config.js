/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'uploadthing.com', 
      'utfs.io', 
      'picsum.photos',
      's3.eu-central-1.wasabisys.com', // S3/Wasabi storage
    ],
  },
}

module.exports = nextConfig