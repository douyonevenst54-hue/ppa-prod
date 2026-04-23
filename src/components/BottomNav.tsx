"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", label: "Home" },
  { href: "/challenges", icon: "🎯", label: "Play" },
  { href: "/predictions", icon: "🧠", label: "Predict" },
  { href: "/polls", icon: "🗳️", label: "Polls" },
  { href: "/profile", icon: "👤", label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav style={{
      position: "fixed",
      bottom: 0,
      left: "50%",
      transform: "translateX(-50%)",
      width: "100%",
      maxWidth: 430,
      background: "var(--bg-secondary)",
      borderTop: "1px solid var(--border)",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      padding: "8px 0 12px",
      zIndex: 100,
    }}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{ textDecoration: "none" }}
          >
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "4px 12px",
              borderRadius: 12,
              background: active ? "#6c63ff22" : "transparent",
              transition: "background 0.2s",
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{
                fontSize: 10,
                fontWeight: active ? 700 : 400,
                color: active ? "var(--accent-primary)" : "var(--text-secondary)",
              }}>
                {item.label}
              </span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}