import { Star } from 'lucide-react';

interface FanLevelBadgeProps {
  level?: number;
  compact?: boolean;
  className?: string;
}

export function FanLevelBadge({
  level = 1,
  compact = false,
  className = '',
}: FanLevelBadgeProps) {
  const safeLevel = Math.min(50, Math.max(1, Math.floor(level || 1)));

  return (
    <span
      title={`Club de Fans · Nivel ${safeLevel}`}
      className={`inline-flex items-center gap-1 rounded-xl border border-[#00B4D8]/55 bg-[#101322]/85 backdrop-blur-md text-white shadow-[0_0_12px_rgba(232,67,147,0.35)] shrink-0 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      } font-bold tracking-tight ${className}`}
    >
      <Star
        className={`${
          compact ? 'w-2.5 h-2.5' : 'w-3 h-3'
        } text-[#00B4D8] fill-[#E84393] drop-shadow-[0_0_6px_rgba(0,180,216,0.9)] shrink-0`}
      />
      <span className="bg-gradient-to-r from-[#00B4D8] via-white to-[#E84393] bg-clip-text text-transparent">
        Nivel {safeLevel}
      </span>
    </span>
  );
}
