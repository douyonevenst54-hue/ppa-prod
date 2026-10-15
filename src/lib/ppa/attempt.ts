/**
 * The handoff between the challenge play screen and the result screen.
 *
 * The play screen no longer knows whether an answer was right, so it can't
 * pass a score. It passes the chosen answers and the result screen submits
 * them for grading.
 *
 * sessionStorage rather than the URL: a query string would put the answers in
 * browser history and in any shared link, and five answers don't fit there
 * comfortably anyway. It lives in lib rather than beside the page because a
 * page module is not a good place to export shared values from.
 */

export interface StashedAttempt {
  answers: { questionId: string; answer: string }[];
  secondsTaken: number;
  /** The Content this attempt belongs to, so the server can verify the set. */
  contentId: string;
}

export function attemptKey(challengeId: string): string {
  return `ppa:attempt:${challengeId}`;
}

export function stashAttempt(challengeId: string, attempt: StashedAttempt): boolean {
  try {
    sessionStorage.setItem(attemptKey(challengeId), JSON.stringify(attempt));
    return true;
  } catch {
    // Private browsing, or storage disabled.
    return false;
  }
}

export function readAttempt(challengeId: string): StashedAttempt | null {
  try {
    const raw = sessionStorage.getItem(attemptKey(challengeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StashedAttempt;
    if (!Array.isArray(parsed.answers) || parsed.answers.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAttempt(challengeId: string): void {
  try {
    sessionStorage.removeItem(attemptKey(challengeId));
  } catch {
    /* nothing to clean up */
  }
}
