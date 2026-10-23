/**
 * Who counts as an admin, in one place.
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Three routes — admin/questions, admin/predictions and ecosystem/registry —
 * each decided for themselves, and each decided the same wrong way:
 *
 *     const { userId } = await req.json();
 *     const user = await prisma.user.findUnique({ where: { id: userId } });
 *     if (!user || !ADMIN_PI_USERIDS.includes(user.username)) return 401;
 *
 * The caller supplies the identity it is then checked against. Anyone holding
 * an admin's internal id is an admin. On the registry that was the worst of
 * the three, because a successful POST returns an API key that
 * /api/external/ppa accepts to credit PPA — an unauthenticated route to
 * minting, bounded only by the per-app daily budget.
 *
 * admin/resolve was fixed this way in an earlier pass; the others were not
 * reached. A shared helper is the point: a check copied into four files drifts
 * in four directions.
 */

/** Used when PPA_ADMIN_USERNAMES is unset OR set to an empty value. */
const DEFAULT_ADMIN_USERNAMES = 'douyonevenst54';

/**
 * Admin usernames from the environment.
 *
 * An env var that exists but is empty is treated as unset. This is not
 * hypothetical: PPA_ADMIN_USERNAMES was present and empty in production, and
 * `process.env.X ?? default` does not catch `''` — only null and undefined. So
 * the fallback would not have fired and every admin route would have locked
 * out every admin, including the person who set the variable.
 */
export function adminUsernames(): Set<string> {
  const raw = process.env.PPA_ADMIN_USERNAMES?.trim();
  const source = raw && raw.length > 0 ? raw : DEFAULT_ADMIN_USERNAMES;

  return new Set(
    source
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function isAdminUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  return adminUsernames().has(username);
}

/*
 * There is deliberately no requireAdmin(req) here.
 *
 * It would have to import getSessionUser, which constructs the Prisma client
 * at module load — so testing "who counts as an admin" would need a database.
 * The rule is a pure function of the environment and a username; routes fetch
 * the session themselves, which also makes the check visible at the point it
 * is made:
 *
 *     const session = await getSessionUser(req);
 *     if (!session || !isAdminUsername(session.username)) return 401;
 */
