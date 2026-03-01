/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",   // static export para GitHub Pages
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
