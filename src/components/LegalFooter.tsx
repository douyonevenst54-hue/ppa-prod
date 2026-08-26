/**
 * Legal footer.
 *
 * In 2:37 of navigation through the app there was no route to terms, privacy,
 * support, or an age statement anywhere. Mounted in the root layout so it
 * appears on every page, above the bottom nav.
 */

import Link from "next/link";

export default function LegalFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        padding: "20px 16px 100px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
          maxWidth: 320,
          margin: "0 auto 12px",
        }}
      >
        PPA is a non-refundable in-app credit. It has no cash value and cannot be
        exchanged back into Pi or any other currency.
      </p>

      <nav
        aria-label="Legal and support"
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 16,
          fontSize: 12,
        }}
      >
        {[
          { href: "/terms", label: "Terms" },
          { href: "/privacy", label: "Privacy" },
          { href: "/support", label: "Support" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{ color: "var(--text-secondary)", textDecoration: "none" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <p style={{ fontSize: 11, color: "var(--border)", marginTop: 12 }}>
        18+ · Play responsibly
      </p>
    </footer>
  );
}
