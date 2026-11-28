import { formatCompactCount } from './validation';

export const OFFICIAL_VIROKLIPZ_USERNAME = 'viroklipz';
export const OFFICIAL_VIROKLIPZ_EMAILS = ['egabriel79@gmail.com'] as const;
export const OFFICIAL_VIROKLIPZ_BASELINE_FOLLOWERS = 2000;

export interface OfficialAccountCandidate {
  username?: string | null;
  email?: string | null;
}

export interface ProgressiveFollowerBreakdown {
  realFollowersCount: number;
  seededFollowersCount: number;
  followersCount: number;
  isOfficial: boolean;
}

export function isOfficialViroklipzEmail(email?: string | null): boolean {
  const normalizedEmail = (email || '').trim().toLowerCase();
  return (
    normalizedEmail !== '' &&
    (OFFICIAL_VIROKLIPZ_EMAILS as readonly string[]).includes(normalizedEmail)
  );
}

export function isReservedOfficialUsername(username?: string | null): boolean {
  return (username || '').trim().toLowerCase() === OFFICIAL_VIROKLIPZ_USERNAME;
}

export function isOfficialViroklipzAccount(
  account?: OfficialAccountCandidate | null,
): boolean {
  if (!account) return false;
  if (isOfficialViroklipzEmail(account.email)) {
    return true;
  }
  const hasExplicitNonOwnerEmail =
    typeof account.email === 'string' && account.email.trim().length > 0;
  if (hasExplicitNonOwnerEmail) {
    return false;
  }
  return isReservedOfficialUsername(account.username);
}

export function calculateProgressiveFollowers(
  account: OfficialAccountCandidate | null | undefined,
  rawFollowersCount?: unknown,
  rawRealFollowersCount?: unknown,
): ProgressiveFollowerBreakdown {
  const isOfficial = isOfficialViroklipzAccount(account);
  const parsedTotal =
    typeof rawFollowersCount === 'number' && Number.isFinite(rawFollowersCount)
      ? Math.max(0, Math.floor(rawFollowersCount))
      : 0;
  const hasExplicitReal =
    typeof rawRealFollowersCount === 'number' && Number.isFinite(rawRealFollowersCount);
  const parsedReal = hasExplicitReal
    ? Math.max(0, Math.floor(rawRealFollowersCount))
    : isOfficial
      ? parsedTotal > OFFICIAL_VIROKLIPZ_BASELINE_FOLLOWERS
        ? parsedTotal
        : 0
      : parsedTotal;

  if (!isOfficial) {
    return {
      realFollowersCount: parsedReal,
      seededFollowersCount: 0,
      followersCount: parsedReal,
      isOfficial: false,
    };
  }

  const seededFollowersCount = Math.max(
    0,
    OFFICIAL_VIROKLIPZ_BASELINE_FOLLOWERS - parsedReal,
  );
  const followersCount = parsedReal + seededFollowersCount;

  return {
    realFollowersCount: parsedReal,
    seededFollowersCount,
    followersCount,
    isOfficial: true,
  };
}

export function formatFollowersLabel(count: number): string {
  const safe = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (safe <= 0) return '';
  if (safe >= 100_000) return formatCompactCount(safe);
  return safe.toLocaleString('en-US');
}
