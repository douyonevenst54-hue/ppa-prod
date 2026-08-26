"use client";

/**
 * /topup — replaces /wallet/exchange.
 *
 * Add redirects in next.config.js:
 *   { source: '/exchange',        destination: '/topup', permanent: false },
 *   { source: '/wallet/exchange', destination: '/topup', permanent: false },
 */

import Link from "next/link";
import TopUpPanel from "@/components/TopUpPanel";

export default function TopUpPage() {
  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link href="/wallet" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⚡ Top up PPA</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Add credit to play challenges and publish content.
          </div>
        </div>
      </div>

      <TopUpPanel />
    </div>
  );
}
