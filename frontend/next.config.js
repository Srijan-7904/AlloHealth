/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export as static site so Render can serve files
  output: 'export',
  // Optional: keep trailing slash for cleaner URLs
  trailingSlash: true,
};

module.exports = nextConfig;
