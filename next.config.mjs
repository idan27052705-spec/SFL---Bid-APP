/** @type {import('next').NextConfig} */

/**
 * Security headers. Nothing exotic — these close the common holes:
 * clickjacking, MIME sniffing, referrer leakage to third parties, and
 * browser features the app never uses.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Bid packages, prices and sub details must never end up in search.
      {
        source: "/portal/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },

  webpack: (config, { dev }) => {
    // Dev cache disabled — same rule as THE CRM, avoids stale build errors.
    if (dev) config.cache = false;
    return config;
  },
};

export default nextConfig;
