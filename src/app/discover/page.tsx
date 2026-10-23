"use client";

/**
 * Pi ecosystem discovery.
 *
 * ── A LINK OUT SHOULD LOOK LIKE A LINK OUT ────────────────────────────────
 *
 * Everything on this screen leaves Pap Pad App. A directory that styles
 * outbound links like its own buttons borrows its own credibility and lends it
 * to strangers, which is how people end up connecting a wallet somewhere they
 * would not have chosen to. So every entry shows its host, opens in a new tab,
 * and carries rel="noopener noreferrer" — without noopener the page you opened
 * can navigate the page you left.
 *
 * ── A LISTING IS NOT AN ENDORSEMENT, AND IT SAYS SO ───────────────────────
 *
 * Said once at the top, where someone reads it before tapping, rather than in
 * a footer after they have gone.
 *
 * ── NOTHING IS EARNED HERE ────────────────────────────────────────────────
 *
 * No PPA for submitting, being listed, or visiting. PPA cannot verify what
 * happens inside another app, and paying for visits would make this
 * advertising.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/pi-session";
import {
  LISTING_CATEGORIES,
  CATEGORY_LABELS,
  MAX_NAME,
  MAX_TAGLINE,
} from "@/lib/ecosystem/listing";

const CATEGORY_ICON: Record<string, string> = {
  GAMES: "🎮",
  MARKETPLACE: "🛒",
  UTILITIES: "🧰",
  SOCIAL: "💬",
  FINANCE: "💹",
  LEARNING: "📚",
  OTHER: "✨",
};

interface Listing {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  url: string;
  logoUrl: string | null;
  category: string;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function DiscoverPage() {
  const { user } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", tagline: "", url: "", category: "OTHER" });
  const [submitting, setSubmitting] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [sent, setSent] = useState("");

  const load = useCallback(async (category: string) => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/ecosystem/apps?category=${category}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setListings(data.listings ?? []);
      setCounts(data.counts ?? {});
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, load]);

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setProblems([]);
    setSent("");

    try {
      const res = await apiFetch("/api/ecosystem/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setProblems(data.problems ?? [data.message ?? "Couldn't submit that."]);
        return;
      }

      setSent(data.message ?? "Submitted for review.");
      setForm({ name: "", tagline: "", url: "", category: "OTHER" });
      setShowForm(false);
    } catch {
      setProblems(["Couldn't reach the server. Try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: "0 0 80px 0" }}>
      <div style={{
        padding: "20px 16px 12px",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 20 }}>←</Link>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Discover Pi apps</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            Built by Pioneers, for Pioneers
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        <div style={{
          marginBottom: 16, padding: "12px 14px", borderRadius: 12,
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
        }}>
          These apps are submitted by their developers and checked only for the
          basics. Being listed here is not an endorsement. Look before you sign
          in or send anything anywhere.
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {["ALL", ...LISTING_CATEGORIES].map((c) => {
            const active = filter === c;
            const n = c === "ALL" ? undefined : counts[c];
            return (
              <button key={c} onClick={() => setFilter(c)} style={{
                padding: "6px 12px", borderRadius: 16, border: "none",
                background: active ? "var(--accent-primary)" : "var(--bg-card)",
                color: active ? "white" : "var(--text-secondary)",
                fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              }}>
                {c === "ALL" ? "All" : CATEGORY_LABELS[c as never]}
                {n ? ` ${n}` : ""}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)", fontSize: 14 }}>
            Loading apps…
          </div>
        ) : failed ? (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 14, marginBottom: 12 }}>Couldn&apos;t load the directory.</div>
            <button
              className="btn-primary"
              style={{ background: "transparent", border: "1px solid var(--border)" }}
              onClick={() => load(filter)}
            >
              Try again
            </button>
          </div>
        ) : listings.length === 0 ? (
          <div className="card" style={{ marginBottom: 14, padding: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
              {filter === "ALL" ? "Nothing listed yet" : "Nothing in this category yet"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Built something on Pi? Put it here and other Pioneers will find it.
            </div>
          </div>
        ) : (
          listings.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="card" style={{ marginBottom: 10, padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: "var(--bg-secondary)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, overflow: "hidden",
                  }}>
                    {l.logoUrl
                      ? <img src={l.logoUrl} alt="" width={40} height={40} style={{ objectFit: "cover" }} />
                      : (CATEGORY_ICON[l.category] ?? "✨")}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{l.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 6 }}>
                      {l.tagline}
                    </div>
                    {/* The host, stated plainly: this tap leaves Pap Pad App. */}
                    <div style={{ fontSize: 11, color: "var(--accent-primary)" }}>
                      {hostOf(l.url)} ↗
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))
        )}

        {sent && (
          <div className="card" style={{
            marginTop: 14, background: "#00c9a711", border: "1px solid #00c9a744",
            fontSize: 13, color: "#00c9a7", lineHeight: 1.6,
          }}>
            {sent}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          {!user ? (
            <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
              Sign in with Pi to submit an app.
            </div>
          ) : !showForm ? (
            <button
              className="btn-primary"
              style={{ background: "transparent", border: "1px solid var(--border)" }}
              onClick={() => { setShowForm(true); setSent(""); }}
            >
              Submit your app
            </button>
          ) : (
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Submit your app</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.6 }}>
                Reviewed by hand before it appears. Nothing is paid for a listing,
                and nothing is earned from one.
              </div>

              <Field label="Name">
                <input
                  value={form.name}
                  maxLength={MAX_NAME}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your app's name"
                  style={inputStyle}
                />
              </Field>

              <Field label="What it does, in one line">
                <input
                  value={form.tagline}
                  maxLength={MAX_TAGLINE}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="Buy and sell with Pi in your neighbourhood"
                  style={inputStyle}
                />
              </Field>

              <Field label="Link">
                <input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://yourapp.com"
                  inputMode="url"
                  style={inputStyle}
                />
              </Field>

              <Field label="Category">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {LISTING_CATEGORIES.map((c) => (
                    <button key={c} onClick={() => setForm({ ...form, category: c })} style={{
                      padding: "5px 10px", borderRadius: 14,
                      border: `1px solid ${form.category === c ? "var(--accent-primary)" : "var(--border)"}`,
                      background: form.category === c ? "#6c63ff22" : "transparent",
                      color: form.category === c ? "var(--accent-primary)" : "var(--text-secondary)",
                      fontSize: 11, cursor: "pointer",
                    }}>
                      {CATEGORY_ICON[c]} {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </Field>

              {problems.length > 0 && (
                <div style={{
                  marginBottom: 12, padding: 10, borderRadius: 8,
                  background: "#ff658411", border: "1px solid #ff658444",
                  fontSize: 12, color: "#ff6584", lineHeight: 1.6,
                }}>
                  {problems.map((p, i) => <div key={i}>{p}</div>)}
                </div>
              )}

              <button className="btn-primary" onClick={submit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
              <button
                onClick={() => { setShowForm(false); setProblems([]); }}
                style={{
                  width: "100%", marginTop: 8, padding: 10,
                  background: "transparent", border: "none",
                  color: "var(--text-secondary)", fontSize: 13, cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 14,
  outline: "none",
  fontFamily: "inherit",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
