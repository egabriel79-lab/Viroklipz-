import { Crown, Gem, Star } from 'lucide-react';
import { getFanLevelTitle } from '../lib/viroklipzService';

interface FanLevelBadgeProps {
  level?: number;
  titleLabel?: string;
  showTitle?: boolean;
  isTop1?: boolean;
  compact?: boolean;
  className?: string;
}

export function FanLevelBadge({
  level = 1,
  titleLabel,
  showTitle = false,
  isTop1 = false,
  compact = false,
  className = '',
}: FanLevelBadgeProps) {
  const safeLevel = Math.min(50, Math.max(1, Math.floor(level || 1)));
  const resolvedTitle = titleLabel?.trim() || getFanLevelTitle(safeLevel);
  const displayTitle = showTitle || Boolean(titleLabel?.trim());
  const isDiamondTier = safeLevel >= 10;

  if (isTop1) {
    return (
      <span
        title={`Top 1 del Live · Lv.${safeLevel} · ${resolvedTitle}`}
        className={`inline-flex items-center gap-1 rounded-xl border border-[#8B5CF6]/70 bg-[#1B1035]/90 backdrop-blur-md text-white shadow-[0_0_14px_rgba(108,92,231,0.55)] shrink-0 whitespace-nowrap ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        } font-extrabold tracking-tight ${className}`}
      >
        <Crown
          className={`${
            compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
          } text-[#C084FC] fill-[#6C5CE7] drop-shadow-[0_0_6px_rgba(168,85,247,0.9)] shrink-0`}
        />
        <span className="bg-gradient-to-r from-[#C084FC] via-white to-[#E84393] bg-clip-text text-transparent tabular-nums">
          {displayTitle ? `TOP 1 · Lv.${safeLevel} · ${resolvedTitle}` : `TOP 1 · Lv.${safeLevel}`}
        </span>
      </span>
    );
  }

  return (
    <span
      title={`${resolvedTitle} · Lv.${safeLevel}`}
      className={`inline-flex items-center gap-1 rounded-xl border backdrop-blur-md text-white shrink-0 whitespace-nowrap ${
        isDiamondTier
          ? 'border-[#00B4D8]/70 bg-[#0B1D33]/90 shadow-[0_0_12px_rgba(0,180,216,0.45)]'
          : 'border-[#00B4D8]/55 bg-[#101322]/85 shadow-[0_0_12px_rgba(232,67,147,0.35)]'
      } ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} font-bold tracking-tight ${className}`}
    >
      {isDiamondTier ? (
        <Gem
          className={`${
            compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
          } text-[#00B4D8] fill-[#38BDF8]/40 drop-shadow-[0_0_6px_rgba(0,180,216,0.95)] shrink-0`}
        />
      ) : (
        <Star
          className={`${
            compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
          } text-[#00B4D8] fill-[#E84393] drop-shadow-[0_0_6px_rgba(0,180,216,0.9)] shrink-0`}
        />
      )}
      <span className="bg-gradient-to-r from-[#00B4D8] via-white to-[#E84393] bg-clip-text text-transparent tabular-nums">
        {displayTitle ? `Lv.${safeLevel} · ${resolvedTitle}` : `Lv.${safeLevel}`}
      </span>
    </span>
  );
}
