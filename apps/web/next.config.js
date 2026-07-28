const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone", // small, self-contained image for Cloud Run
  // Monorepo: without this, Next's file tracing for the standalone build can miss files from
  // workspace packages (e.g. @therapy-docs/shared-types) since it can't find the real repo root.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  reactStrictMode: true,
};

module.exports = nextConfig;
