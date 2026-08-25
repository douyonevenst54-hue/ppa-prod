/**
 * Rotate every ecosystem API key and store only its hash.
 *
 *   npx tsx scripts/rotate-app-keys.ts
 *
 * ── CHANGED: KEYS NO LONGER GO TO STDOUT ──────────────────────────────────
 *
 * The previous version printed the keys to the terminal. That turns out to be
 * the wrong default: terminal output gets scrolled back, screenshotted, pasted
 * into chat when something goes wrong, and captured by shell logging. A secret
 * that touches stdout should be assumed compromised.
 *
 * Keys are now written to .ppa-keys-<timestamp>.txt in the repo root, with a
 * .gitignore entry added automatically. Open the file, copy the keys into the
 * partner environments, delete the file.
 *
 * Nothing about the key is recoverable afterwards — only the SHA-256 is stored.
 */

import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync, appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

function hashKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

function generateKey(slug: string): string {
  return `ppa_${slug}_${randomBytes(24).toString("base64url")}`;
}

/** Make sure the key file can never be committed, even by an -A commit. */
function ensureGitignored(pattern: string) {
  const path = join(process.cwd(), ".gitignore");
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (!current.includes(pattern)) {
    appendFileSync(path, `\n# rotated API keys — never commit\n${pattern}\n`);
    console.log(`Added ${pattern} to .gitignore`);
  }
}

async function main() {
  ensureGitignored(".ppa-keys-*.txt");

  const apps = await prisma.pPAApp.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  const lines: string[] = [
    `PPA ecosystem API keys — generated ${new Date().toISOString()}`,
    ``,
    `Copy these into the partner app environments, then DELETE THIS FILE.`,
    `They are not stored in recoverable form and cannot be reprinted.`,
    ``,
  ];

  for (const app of apps) {
    const key = generateKey(app.slug);
    await prisma.pPAApp.update({
      where: { id: app.id },
      data: {
        apiKeyHash: hashKey(key),
        // The plaintext column keeps a non-secret placeholder so the unique
        // constraint stays satisfied and nothing can authenticate with it.
        apiKey: `rotated_${app.slug}_${Date.now()}`,
      },
    });
    lines.push(`${app.name} (${app.slug})`);
    lines.push(`  x-ppa-api-key: ${key}`);
    lines.push(``);
  }

  const filename = `.ppa-keys-${Date.now()}.txt`;
  writeFileSync(join(process.cwd(), filename), lines.join("\n"), {
    mode: 0o600,
  });

  // Deliberately does not echo the keys.
  console.log(`\n${apps.length} keys rotated. Written to ${filename}`);
  console.log(`\nOpen it, copy the keys into each partner app, then:`);
  console.log(`  rm ${filename}`);
  console.log(
    `\nOnce the plaintext-fallback warnings stop appearing in your logs,`,
  );
  console.log(`set PPA_ALLOW_PLAINTEXT_KEYS=false in Vercel.`);
}

main().finally(() => prisma.$disconnect());