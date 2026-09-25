import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Allow framing from Pi Browser AND PiNet — Pi domains and self.
          // X-Frame-Options is legacy and only supports a single origin,
          // so we rely on CSP frame-ancestors which supports a list.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.minepi.com https://*.pinet.com https://*.pi.app https://sandbox.minepi.com;",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      // The old buy/redeem screens. Both are deleted; anyone landing on a
      // bookmark or a cached shell gets the top-up screen instead of a 404.
      { source: "/exchange", destination: "/topup", permanent: false },
      { source: "/wallet/exchange", destination: "/topup", permanent: false },
    ];
  },
};

export default nextConfig;