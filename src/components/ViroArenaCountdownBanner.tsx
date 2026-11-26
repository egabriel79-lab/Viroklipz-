import { useEffect, useState } from 'react';
import { Flame, Swords } from 'lucide-react';

interface ViroArenaCountdownBannerProps {
  initialSeconds?: number;
  onOpenBattle?: () => void;
  compact?: boolean;
}

function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ViroArenaCountdownBanner({
  initialSeconds = 300,
  onOpenBattle,
  compact = false,
}: ViroArenaCountdownBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  return (
    <div
      className={`w-full max-w-md mx-auto rounded-2xl p-[1.5px] bg-gradient-to-r from-[#E84393] via-[#6C5CE7] to-[#00B4D8] shadow-[0_0_24px_rgba(232,67,147,0.45),0_0_18px_rgba(0,180,216,0.3)] ${
        compact ? '' : 'backdrop-blur-xl'
      }`}
    >
      <div className="rounded-[14px] bg-gradient-to-r from-[#E84393]/90 via-[#6C5CE7]/90 to-[#00B4D8]/90 backdrop-blur-md px-3 py-1.5 flex items-center justify-between gap-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-lg bg-black/30 border border-white/25 flex items-center justify-center shrink-0">
            <Swords className="w-3.5 h-3.5 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase leading-tight truncate">
              BATALLA OFICIAL VIROARENA
            </p>
            <p className="text-[10px] sm:text-[11px] font-bold text-white/95 tabular-nums flex items-center gap-1 leading-tight">
              <Flame className="w-3 h-3 text-[#FDE047] shrink-0" />
              <span>
                {secondsLeft > 0
                  ? `Faltan ${formatTimer(secondsLeft)} para la batalla`
                  : '¡Batalla ViroArena lista ahora!'}
              </span>
            </p>
          </div>
        </div>

        {onOpenBattle && (
          <button
            type="button"
            onClick={onOpenBattle}
            className="min-h-[28px] px-2.5 rounded-xl bg-black/35 hover:bg-black/50 border border-white/30 text-[10px] font-extrabold text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            Ver Arena
          </button>
        )}
      </div>
    </div>
  );
}
