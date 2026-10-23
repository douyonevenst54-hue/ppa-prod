/**
 * Validation for ecosystem directory submissions.
 *
 * ── THE URL IS THE DANGEROUS FIELD ────────────────────────────────────────
 *
 * Everything else here is tidiness. The URL is a link PPA will put in front of
 * its own users, who will reasonably read its presence in the directory as
 * some kind of vetting. App directories attract people who want exactly that
 * trust, and a Pioneer who follows a link and connects a wallet has lost
 * something real.
 *
 * So: https only. `javascript:` and `data:` can execute, `http:` can be
 * intercepted, and a URL carrying embedded credentials (https://user:pw@host)
 * is a classic way to make a hostile host look like a familiar one.
 *
 * None of this makes a link safe. It makes a link ordinary, which is all
 * software can do — the approval queue is the real control, and the directory
 * says plainly that a listing is not an endorsement.
 */

export const LISTING_CATEGORIES = [
  "GAMES",
  "MARKETPLACE",
  "UTILITIES",
  "SOCIAL",
  "FINANCE",
  "LEARNING",
  "OTHER",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  GAMES: "Games",
  MARKETPLACE: "Marketplace",
  UTILITIES: "Utilities",
  SOCIAL: "Social",
  FINANCE: "Money",
  LEARNING: "Learning",
  OTHER: "Other",
};

export const MAX_NAME = 60;
export const MAX_TAGLINE = 140;

export interface ListingInput {
  name: string;
  tagline: string;
  url: string;
  category: string;
  logoUrl?: string | null;
}

export interface CleanListing {
  name: string;
  slug: string;
  tagline: string;
  url: string;
  category: ListingCategory;
  logoUrl: string | null;
}

/** A readable, stable id for a listing. Also what its directory link uses. */
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

/**
 * An https URL we are willing to show a Pioneer, or null.
 *
 * Returns the normalised form so two submissions of the same app do not become
 * two entries over a trailing slash.
 */
export function safeUrl(raw: string): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  // https only. http can be intercepted; javascript: and data: can execute.
  if (parsed.protocol !== "https:") return null;

  // https://looks-legit@evil.example is a hostile host wearing a familiar name.
  if (parsed.username || parsed.password) return null;

  if (!parsed.hostname.includes(".")) return null;
  if (parsed.hostname.endsWith(".")) return null;

  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function validateListing(input: ListingInput): {
  errors: string[];
  clean: CleanListing | null;
} {
  const errors: string[] = [];

  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) errors.push("Give the app a name.");
  else if (name.length > MAX_NAME) errors.push(`Keep the name under ${MAX_NAME} characters.`);

  const tagline = (input.tagline ?? "").trim().replace(/\s+/g, " ");
  if (!tagline) errors.push("Say in one line what the app does.");
  else if (tagline.length > MAX_TAGLINE) {
    errors.push(`Keep the description under ${MAX_TAGLINE} characters.`);
  }

  const url = safeUrl(input.url ?? "");
  if (!url) errors.push("Give a full https:// link to the app.");

  const category = String(input.category ?? "OTHER").toUpperCase();
  if (!(LISTING_CATEGORIES as readonly string[]).includes(category)) {
    errors.push("Pick one of the listed categories.");
  }

  const logoUrl = input.logoUrl ? safeUrl(input.logoUrl) : null;
  if (input.logoUrl && !logoUrl) errors.push("The logo link must be a full https:// URL.");

  const slug = slugify(name);
  if (name && slug.length < 2) {
    errors.push("The name needs at least two letters or numbers.");
  }

  if (errors.length > 0) return { errors, clean: null };

  return {
    errors: [],
    clean: {
      name,
      slug,
      tagline,
      url: url!,
      category: category as ListingCategory,
      logoUrl,
    },
  };
}
