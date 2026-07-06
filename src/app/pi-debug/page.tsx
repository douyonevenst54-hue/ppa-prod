"use client";

import { useEffect, useState } from "react";

export default function PiDebug() {
  const [info, setInfo] = useState<Record<string, string>>({});

  useEffect(() => {
    const checks: Record<string, string> = {};
    let ticks = 0;
    const t = setInterval(() => {
      ticks++;
      checks["seconds waited"] = String(ticks * 0.5);
      checks["window.Pi exists"] = window.Pi ? "YES ✅" : "no ❌";
      checks["hostname"] = window.location.hostname;
      checks["origin"] = window.location.origin;
      checks["userAgent"] = navigator.userAgent;
      checks["sdk script tag in DOM"] = document.querySelector(
        'script[src*="pi-sdk"]'
      )
        ? "YES ✅"
        : "no ❌";
      setInfo({ ...checks });
      if (window.Pi || ticks > 30) clearInterval(t); // stop after 15s or success
    }, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13 }}>
      <h2>Pi SDK Debug</h2>
      {Object.entries(info).map(([k, v]) => (
        <p key={k} style={{ wordBreak: "break-all" }}>
          <strong>{k}:</strong> {v}
        </p>
      ))}
    </div>
  );
}