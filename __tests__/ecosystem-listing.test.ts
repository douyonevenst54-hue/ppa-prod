import { describe, it, expect } from "vitest";
import {
  safeUrl,
  slugify,
  validateListing,
  LISTING_CATEGORIES,
  CATEGORY_LABELS,
  MAX_NAME,
  MAX_TAGLINE,
} from "@/lib/ecosystem/listing";

describe("safeUrl", () => {
  it("accepts an ordinary https link", () => {
    expect(safeUrl("https://lopipo.app")).toBe("https://lopipo.app");
    expect(safeUrl("  https://example.com/app?ref=ppa  ")).toBe(
      "https://example.com/app?ref=ppa",
    );
  });

  it("refuses schemes that can execute", () => {
    // These are the ones that turn a directory link into a payload.
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });

  it("refuses plain http", () => {
    expect(safeUrl("http://example.com")).toBeNull();
  });

  it("refuses embedded credentials", () => {
    // https://lopipo.app@evil.example reads as a familiar host and is not one.
    expect(safeUrl("https://lopipo.app@evil.example")).toBeNull();
    expect(safeUrl("https://user:pw@evil.example")).toBeNull();
  });

  it("refuses hosts that are not real domains", () => {
    expect(safeUrl("https://localhost")).toBeNull();
    expect(safeUrl("https://example.")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
    expect(safeUrl("")).toBeNull();
  });

  it("normalises so one app is not listed twice", () => {
    expect(safeUrl("https://example.com/")).toBe(safeUrl("https://example.com"));
    expect(safeUrl("https://example.com/app#top")).toBe("https://example.com/app");
  });

  it("keeps the path and query, which identify the app", () => {
    expect(safeUrl("https://example.com/pi/app?id=7")).toBe(
      "https://example.com/pi/app?id=7",
    );
  });
});

describe("slugify", () => {
  it("makes a readable id", () => {
    expect(slugify("Mache Ayisyen")).toBe("mache-ayisyen");
    expect(slugify("LoPiPo")).toBe("lopipo");
  });

  it("folds accents rather than dropping the word", () => {
    expect(slugify("Cap-Haïtien Market")).toBe("cap-haitien-market");
  });

  it("collapses punctuation and trims stray hyphens", () => {
    expect(slugify("  !!Pi — Wallet!!  ")).toBe("pi-wallet");
    expect(slugify("a///b")).toBe("a-b");
  });

  it("never ends on a hyphen, even when truncated", () => {
    const s = slugify("x".repeat(39) + " tail");
    expect(s.endsWith("-")).toBe(false);
    expect(s.length).toBeLessThanOrEqual(40);
  });

  it("returns empty for a name with nothing sluggable", () => {
    expect(slugify("!!!")).toBe("");
  });
});

const ok = {
  name: "LoPiPo",
  tagline: "Local Pi points for neighbourhood shops",
  url: "https://lopipo.app",
  category: "MARKETPLACE",
};

describe("validateListing", () => {
  it("accepts a well-formed submission", () => {
    const { errors, clean } = validateListing(ok);
    expect(errors).toEqual([]);
    expect(clean).toMatchObject({
      name: "LoPiPo",
      slug: "lopipo",
      url: "https://lopipo.app",
      category: "MARKETPLACE",
      logoUrl: null,
    });
  });

  it("returns no clean value when anything failed", () => {
    const { clean } = validateListing({ ...ok, url: "javascript:alert(1)" });
    expect(clean).toBeNull();
  });

  it("rejects a dangerous URL with a plain explanation", () => {
    const { errors } = validateListing({ ...ok, url: "http://example.com" });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/https/);
  });

  it("requires a name and a one-line description", () => {
    expect(validateListing({ ...ok, name: "   " }).errors.length).toBeGreaterThan(0);
    expect(validateListing({ ...ok, tagline: "" }).errors.length).toBeGreaterThan(0);
  });

  it("holds the length limits", () => {
    expect(validateListing({ ...ok, name: "x".repeat(MAX_NAME + 1) }).errors[0]).toMatch(
      /name/i,
    );
    expect(
      validateListing({ ...ok, tagline: "x".repeat(MAX_TAGLINE + 1) }).errors[0],
    ).toMatch(/description/i);
  });

  it("rejects an unknown category rather than silently filing it under OTHER", () => {
    expect(validateListing({ ...ok, category: "CRYPTO" }).errors.length).toBe(1);
  });

  it("accepts every listed category", () => {
    for (const c of LISTING_CATEGORIES) {
      expect(validateListing({ ...ok, category: c }).errors).toEqual([]);
    }
  });

  it("validates the logo link to the same standard as the app link", () => {
    expect(
      validateListing({ ...ok, logoUrl: "javascript:alert(1)" }).errors.length,
    ).toBe(1);
    expect(validateListing({ ...ok, logoUrl: "https://cdn.example.com/a.png" }).errors).toEqual(
      [],
    );
  });

  it("tidies whitespace rather than rejecting it", () => {
    const { clean } = validateListing({ ...ok, name: "  Lo   PiPo  " });
    expect(clean!.name).toBe("Lo PiPo");
    expect(clean!.slug).toBe("lo-pipo");
  });

  it("reports every problem at once, not just the first", () => {
    const { errors } = validateListing({
      name: "",
      tagline: "",
      url: "nope",
      category: "NOPE",
    });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  it("rejects a name that cannot produce a slug", () => {
    expect(validateListing({ ...ok, name: "!!!" }).errors.length).toBeGreaterThan(0);
  });
});

describe("categories", () => {
  it("labels every category", () => {
    for (const c of LISTING_CATEGORIES) {
      expect(CATEGORY_LABELS[c]).toBeTruthy();
    }
  });
});
