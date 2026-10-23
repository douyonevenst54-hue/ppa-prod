import { describe, it, expect, afterEach } from "vitest";
import { adminUsernames, isAdminUsername } from "@/lib/admin";

const original = process.env.PPA_ADMIN_USERNAMES;

afterEach(() => {
  if (original === undefined) delete process.env.PPA_ADMIN_USERNAMES;
  else process.env.PPA_ADMIN_USERNAMES = original;
});

describe("adminUsernames", () => {
  it("falls back to the default when the variable is unset", () => {
    delete process.env.PPA_ADMIN_USERNAMES;
    expect(adminUsernames().has("douyonevenst54")).toBe(true);
  });

  it("falls back when the variable is set but EMPTY", () => {
    // Not hypothetical: PPA_ADMIN_USERNAMES existed and was empty in
    // production. `process.env.X ?? default` does not catch '', so the
    // fallback would not fire and every admin route would lock out every
    // admin — including whoever set the variable.
    process.env.PPA_ADMIN_USERNAMES = "";
    expect(adminUsernames().has("douyonevenst54")).toBe(true);
  });

  it("falls back when the variable is only whitespace", () => {
    process.env.PPA_ADMIN_USERNAMES = "   ";
    expect(adminUsernames().has("douyonevenst54")).toBe(true);
  });

  it("reads a single username", () => {
    process.env.PPA_ADMIN_USERNAMES = "someone";
    expect(adminUsernames()).toEqual(new Set(["someone"]));
  });

  it("reads a comma-separated list and trims it", () => {
    process.env.PPA_ADMIN_USERNAMES = " alice , bob ,carol ";
    expect(adminUsernames()).toEqual(new Set(["alice", "bob", "carol"]));
  });

  it("drops empty entries from a sloppy list", () => {
    process.env.PPA_ADMIN_USERNAMES = "alice,,bob,";
    expect(adminUsernames()).toEqual(new Set(["alice", "bob"]));
  });

  it("replaces the default rather than adding to it", () => {
    // Removing someone has to actually remove them.
    process.env.PPA_ADMIN_USERNAMES = "alice";
    expect(adminUsernames().has("douyonevenst54")).toBe(false);
  });

  it("is read at call time, not frozen at import", () => {
    process.env.PPA_ADMIN_USERNAMES = "alice";
    expect(isAdminUsername("alice")).toBe(true);
    process.env.PPA_ADMIN_USERNAMES = "bob";
    expect(isAdminUsername("alice")).toBe(false);
    expect(isAdminUsername("bob")).toBe(true);
  });
});

describe("isAdminUsername", () => {
  it("rejects absent usernames rather than throwing", () => {
    expect(isAdminUsername(null)).toBe(false);
    expect(isAdminUsername(undefined)).toBe(false);
    expect(isAdminUsername("")).toBe(false);
  });

  it("is exact — no case folding, no partial matches", () => {
    process.env.PPA_ADMIN_USERNAMES = "douyonevenst54";
    expect(isAdminUsername("douyonevenst54")).toBe(true);
    expect(isAdminUsername("Douyonevenst54")).toBe(false);
    expect(isAdminUsername("douyonevenst5")).toBe(false);
    expect(isAdminUsername("douyonevenst54x")).toBe(false);
    expect(isAdminUsername(" douyonevenst54")).toBe(false);
  });
});
