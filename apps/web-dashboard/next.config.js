/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable hot reloading in development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  // Enable fast refresh
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
