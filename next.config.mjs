/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Dev cache disabled — same rule as THE CRM, avoids stale build errors.
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
