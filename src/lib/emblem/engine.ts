/**
 * Emblem engine — reads the record, computes the Emblem, persists it.
 *
 * ── WHERE THE NUMBERS COME FROM ───────────────────────────────────────────
 *
 * Nothing here writes a balance, awards PPA, or touches the ledger. It only
 * reads counters that gated paths have already written. That separation is
 * deliberate: an Emblem is a *view* of a record, so it can be recomputed from
 * scratch at any time and can never be the thing that corrupts the record.
 *
 * ── PIONEER ───────────────────────────────────────────────────────────────
 *
 * Granted to the first PIONEER_CUTOFF accounts by creation order. Computed
 * once and then stored on the Emblem, because "first 1,000" has to stay true
 * as the user base grows — recomputing it later would be a different answer.
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  RealmInputs,
  RealmStanding,
  standings,
  primaryRealm,
  emblemLevel,
  Realm,
} from "./realms";
import { deriveTraits, EmblemTraits } from "./traits";

export const PIONEER_CUTOFF = 1000;

export interface EmblemView {
  username: string;
  primary: Realm;
  level: number;
  pioneer: boolean;
  traits: EmblemTraits;
  standings: RealmStanding[];
  updatedAt: Date;
}

/** Gather every input from columns that already exist. */
export async function gatherInputs(userId: string): Promise<RealmInputs & { username: string; createdAt: Date }> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      username: true,
      createdAt: true,
      correctChallenges: true,
      totalChallenges: true,
      correctPredictions: true,
      totalPredictions: true,
      accuracyRate: true,
      reputationScore: true,
      streakDays: true,
      longestStreak: true,
      tier: true,
      _count: { select: { createdContent: true, pollVotes: true } },
    },
  });

  // Breadth: distinct content categories engaged with, plus distinct ecosystem
  // apps transacted with. Both are groupBy rather than stored counters, because
  // "distinct" can't be maintained incrementally without a set.
  const [predCats, voteCats, apps] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId },
      select: { content: { select: { category: true } } },
      distinct: ["contentId"],
    }),
    prisma.pollVote.findMany({
      where: { userId },
      select: { pollOption: { select: { content: { select: { category: true } } } } },
      distinct: ["pollOptionId"],
    }),
    prisma.ecosystemTransaction.groupBy({
      by: ["appId"],
      where: { piUserId: { not: "" } },
      _count: true,
    }).catch(() => [] as { appId: string }[]),
  ]);

  const categories = new Set<string>();
  for (const p of predCats) categories.add(p.content.category);
  for (const v of voteCats) categories.add(v.pollOption.content.category);

  return {
    username: user.username,
    createdAt: user.createdAt,
    correctChallenges: user.correctChallenges,
    totalChallenges: user.totalChallenges,
    correctPredictions: user.correctPredictions,
    totalPredictions: user.totalPredictions,
    accuracyRate: user.accuracyRate,
    reputationScore: user.reputationScore,
    contentCreated: user._count.createdContent,
    pollVotes: user._count.pollVotes,
    categoriesTouched: categories.size,
    appsTouched: apps.length,
    streakDays: user.streakDays,
    longestStreak: user.longestStreak,
    tier: user.tier,
  };
}

async function isPioneer(userId: string, createdAt: Date): Promise<boolean> {
  const earlier = await prisma.user.count({
    where: { createdAt: { lt: createdAt } },
  });
  return earlier < PIONEER_CUTOFF;
}

/**
 * Recompute and persist. Safe to call as often as you like — it is idempotent
 * and writes nothing when the Emblem hasn't actually changed.
 */
export async function recomputeEmblem(userId: string): Promise<EmblemView> {
  const inputs = await gatherInputs(userId);
  const st = standings(inputs);
  const primary = primaryRealm(inputs);
  const level = emblemLevel(inputs);

  const existing = await prisma.emblem.findUnique({
    where: { userId },
    select: { pioneer: true, primaryRealm: true, level: true },
  });

  // Pioneer is computed once and then frozen: "first 1,000 accounts" has to
  // keep meaning the same thing a year from now.
  const pioneer = existing?.pioneer ?? (await isPioneer(userId, inputs.createdAt));

  const traits = deriveTraits({ userId, primary, level, standings: st, pioneer });

  const realmLevels = Object.fromEntries(st.map((s) => [s.realm, s.level]));
  const realmScores = Object.fromEntries(st.map((s) => [s.realm, s.score]));

  const emblem = await prisma.emblem.upsert({
    where: { userId },
    create: {
      userId,
      primaryRealm: primary,
      level,
      pioneer,
      realmLevels: realmLevels as Prisma.InputJsonValue,
      realmScores: realmScores as Prisma.InputJsonValue,
      traits: traits as unknown as Prisma.InputJsonValue,
    },
    update: {
      primaryRealm: primary,
      level,
      realmLevels: realmLevels as Prisma.InputJsonValue,
      realmScores: realmScores as Prisma.InputJsonValue,
      traits: traits as unknown as Prisma.InputJsonValue,
    },
  });

  // Record any newly-crossed thresholds. This is the part that makes an Emblem
  // a history rather than a snapshot: the milestone rows survive even if the
  // scoring formula is later retuned.
  const crossed = st.filter((s) => s.level > 0);
  if (crossed.length > 0) {
    await prisma.emblemMilestone.createMany({
      data: crossed.flatMap((s) =>
        Array.from({ length: s.level }, (_, i) => ({
          emblemId: emblem.id,
          realm: s.realm,
          level: i + 1,
        })),
      ),
      skipDuplicates: true,
    });
  }

  return {
    username: inputs.username,
    primary,
    level,
    pioneer,
    traits,
    standings: st,
    updatedAt: emblem.updatedAt,
  };
}

/**
 * Read the stored Emblem, recomputing if it's missing or stale.
 *
 * `maxAgeMs` keeps the render path cheap: a profile view doesn't need to
 * re-run the groupBys if someone looked a minute ago.
 */
export async function getEmblem(
  userId: string,
  maxAgeMs = 60_000,
): Promise<EmblemView> {
  const stored = await prisma.emblem.findUnique({
    where: { userId },
    include: { user: { select: { username: true } } },
  });

  if (!stored || Date.now() - stored.updatedAt.getTime() > maxAgeMs) {
    return recomputeEmblem(userId);
  }

  const realmScores = stored.realmScores as Record<string, number>;
  const realmLevels = stored.realmLevels as Record<string, number>;

  return {
    username: stored.user.username,
    primary: stored.primaryRealm as Realm,
    level: stored.level,
    pioneer: stored.pioneer,
    traits: stored.traits as unknown as EmblemTraits,
    standings: Object.keys(realmLevels).map((realm) => ({
      realm: realm as Realm,
      score: realmScores[realm] ?? 0,
      level: realmLevels[realm] ?? 0,
      next: null,
    })),
    updatedAt: stored.updatedAt,
  };
}
