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
            value: "frame-ancestors 'self' https://*.minepi.com https://*.pinet.com https://*.pi.app https://sandbox.minepi.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;