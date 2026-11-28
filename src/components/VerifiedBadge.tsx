import { isOfficialViroklipzAccount } from '../lib/officialAccount';

export const VERIFIED_MIN_FOLLOWERS = 10000;

export interface VerifiableAccount {
  isVerified?: boolean | null;
  followersCount?: number | null;
  username?: string | null;
  email?: string | null;
}

export function isAccountVerified(account?: VerifiableAccount | null): boolean {
  if (!account) return false;
  if (account.isVerified === true) return true;
  if (isOfficialViroklipzAccount(account)) return true;
  return (
    typeof account.followersCount === 'number' &&
    Number.isFinite(account.followersCount) &&
    account.followersCount >= VERIFIED_MIN_FOLLOWERS
  );
}

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

export function VerifiedBadge({ size = 16, className = '' }: VerifiedBadgeProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Cuenta verificada"
      role="img"
      className={`shrink-0 inline-block align-middle drop-shadow-[0_0_6px_rgba(0,180,216,0.35)] ${className}`}
    >
      <title>Cuenta verificada</title>
      <path
        d="M23 12L20.56 9.21L20.9 5.52L17.29 4.7L15.4 1.5L12 2.96L8.6 1.5L6.71 4.69L3.1 5.5L3.44 9.2L1 12L3.44 14.79L3.1 18.49L6.71 19.31L8.6 22.5L12 21.03L15.4 22.49L17.29 19.3L20.9 18.48L20.56 14.79L23 12Z"
        fill="#00B4D8"
      />
      <path
        d="M10.09 16.72L6.29 12.91L7.71 11.49L10.09 13.88L16.34 7.62L17.76 9.04L10.09 16.72Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
