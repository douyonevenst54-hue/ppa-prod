import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Session origin is what every payment entry point reads to decide whether a
 * top-up can happen at all. Getting it wrong in the permissive direction
 * means a player picks an amount, presses a button, and watches a payment
 * fail that was never possible — so these cases are worth pinning down.
 *
 * The module holds state at module scope, so each test re-imports it fresh.
 */

type Store = Record<string, string>;

function fakeWindow(store: Store, opts: { throws?: boolean; pi?: boolean } = {}) {
  const guard = () => {
    if (opts.throws) throw new Error("storage disabled");
  };
  return {
    sessionStorage: {
      getItem: (k: string) => {
        guard();
        return k in store ? store[k] : null;
      },
      setItem: (k: string, v: string) => {
        guard();
        store[k] = v;
      },
      removeItem: (k: string) => {
        guard();
        delete store[k];
      },
    },
    ...(opts.pi ? { Pi: {} } : {}),
  };
}

async function load() {
  vi.resetModules();
  return import("@/lib/pi-session");
}

let store: Store;

beforeEach(() => {
  store = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web sessions survive a reload", () => {
  it("persists a web token to sessionStorage", async () => {
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    s.setPiAccessToken("web-token", "web");
    expect(store["ppa_web_token"]).toBe("web-token");
  });

  it("restores the token and its origin on a fresh load", async () => {
    store["ppa_web_token"] = "restored-token";
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    // Nothing in memory yet — this is the reload case.
    expect(s.getPiAccessToken()).toBe("restored-token");
    expect(s.getSessionOrigin()).toBe("web");
    expect(s.hasPiSession()).toBe(true);
  });

  it("reports the web origin even before the token is read explicitly", async () => {
    store["ppa_web_token"] = "restored-token";
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    expect(s.getSessionOrigin()).toBe("web");
  });
});

describe("Pi Browser sessions are never written down", () => {
  it("keeps an SDK token in memory only", async () => {
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    s.setPiAccessToken("sdk-token", "pi-browser");
    expect(s.getPiAccessToken()).toBe("sdk-token");
    // There is a silent re-auth available, so there is no reason to store it.
    expect(store["ppa_web_token"]).toBeUndefined();
  });

  it("clears any stale web token when an SDK session takes over", async () => {
    store["ppa_web_token"] = "old-web-token";
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    s.setPiAccessToken("sdk-token", "pi-browser");
    expect(store["ppa_web_token"]).toBeUndefined();
    expect(s.getSessionOrigin()).toBe("pi-browser");
  });
});

describe("signing out", () => {
  it("drops the token, the origin and the stored copy", async () => {
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    s.setPiAccessToken("web-token", "web");
    s.setPiAccessToken(null);
    expect(s.getPiAccessToken()).toBeNull();
    expect(s.getSessionOrigin()).toBeNull();
    expect(s.hasPiSession()).toBe(false);
    expect(store["ppa_web_token"]).toBeUndefined();
  });
});

describe("isPiBrowser", () => {
  it("is false for a web session even though the SDK object exists", async () => {
    // This is the whole point. layout.tsx loads pi-sdk.js in every browser,
    // so window.Pi is present on an ordinary desktop too. Treating that as
    // "this is Pi Browser" is what produced the long hang and would now also
    // offer payments that cannot work.
    vi.stubGlobal("window", fakeWindow(store, { pi: true }));
    const s = await load();
    s.setPiAccessToken("web-token", "web");
    expect(s.isPiBrowser()).toBe(false);
  });

  it("is true for an SDK session", async () => {
    vi.stubGlobal("window", fakeWindow(store, { pi: true }));
    const s = await load();
    s.setPiAccessToken("sdk-token", "pi-browser");
    expect(s.isPiBrowser()).toBe(true);
  });

  it("is false when the SDK object is absent", async () => {
    vi.stubGlobal("window", fakeWindow(store));
    const s = await load();
    expect(s.isPiBrowser()).toBe(false);
  });
});

describe("storage that refuses to work", () => {
  it("still signs the player in for this page view", async () => {
    // Private mode, or site data blocked. Losing the session on reload is
    // acceptable; throwing during sign-in is not.
    vi.stubGlobal("window", fakeWindow(store, { throws: true }));
    const s = await load();
    expect(() => s.setPiAccessToken("web-token", "web")).not.toThrow();
    expect(s.getPiAccessToken()).toBe("web-token");
    expect(s.getSessionOrigin()).toBe("web");
  });

  it("reports no session rather than throwing on a fresh load", async () => {
    vi.stubGlobal("window", fakeWindow(store, { throws: true }));
    const s = await load();
    expect(s.getPiAccessToken()).toBeNull();
    expect(s.hasPiSession()).toBe(false);
  });
});

describe("server-side rendering", () => {
  it("does not touch storage when there is no window", async () => {
    vi.stubGlobal("window", undefined);
    const s = await load();
    expect(() => s.setPiAccessToken("tok", "web")).not.toThrow();
    expect(s.isPiBrowser()).toBe(false);
  });
});
