/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small, self-contained image for Cloud Run
  reactStrictMode: true,
};

module.exports = nextConfig;
