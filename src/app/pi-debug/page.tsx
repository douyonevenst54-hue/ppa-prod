"use client";

import { useState } from "react";

export default function PiDebug() {
  const [log, setLog] = useState<string[]>([]);
  const add = (m: string) => setLog((l) => [...l, `${new Date().toLocaleTimeString()} — ${m}`]);

  const runTest = async () => {
    setLog([]);
    try {
      if (!window.Pi) { add("window.Pi missing ❌"); return; }
      add("window.Pi present ✅");

      add(`sandbox flag: ${process.env.NEXT_PUBLIC_PI_SANDBOX}`);
      await Promise.resolve(window.Pi.init({
        version: "2.0",
        sandbox: process.env.NEXT_PUBLIC_PI_SANDBOX === "true",
      }));
      add("Pi.init done ✅");

      add("calling Pi.authenticate (30s limit)...");
      const result = await Promise.race([
        window.Pi.authenticate(["username", "payments", "wallet_address"], (p: unknown) => {
          add("⚠️ onIncompletePaymentFound fired: " + JSON.stringify(p).slice(0, 300));
        }),
        new Promise<null>((r) => setTimeout(() => r(null), 30000)),
      ]);

      if (!result) { add("authenticate TIMED OUT after 30s ❌"); return; }
      add(`authenticate OK ✅ user: ${result.user?.username}`);

      add("posting to /api/auth/pi...");
      const res = await fetch("/api/auth/pi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: result.accessToken, hintUsername: result.user?.username }),
      });
      add(`/api/auth/pi → ${res.status} ${res.ok ? "✅" : "❌ " + (await res.text()).slice(0, 300)}`);
    } catch (e) {
      add("threw ❌: " + (e instanceof Error ? e.message : JSON.stringify(e)));
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13 }}>
      <h2>Pi Auth Step Test</h2>
      <button onClick={runTest} style={{ padding: "12px 24px", fontSize: 16, marginBottom: 16 }}>
        Run auth test
      </button>
      {log.map((l, i) => (
        <p key={i} style={{ wordBreak: "break-all" }}>{l}</p>
      ))}
    </div>
  );
}