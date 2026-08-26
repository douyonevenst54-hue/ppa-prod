/**
 * Shared shell for /terms, /privacy and /support.
 *
 * Uses the app's own card and colour vars rather than introducing a second
 * visual language for the pages a reviewer is most likely to open.
 */

import Link from "next/link";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text-secondary)" }}>
        {children}
      </div>
    </section>
  );
}

export default function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "0 0 40px 0" }}>
      <div
        style={{
          padding: "20px 16px 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>
          ←
        </Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Last updated {updated}
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
