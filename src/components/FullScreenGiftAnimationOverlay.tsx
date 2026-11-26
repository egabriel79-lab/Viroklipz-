import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coins, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { LiveGiftCatalogItem } from '../lib/liveGifts';
import { GiftVisual } from './GiftVisual';

export interface FullScreenGiftAnimationEvent {
  id: string;
  senderName: string;
  gift: LiveGiftCatalogItem;
}

interface FullScreenGiftAnimationOverlayProps {
  event: FullScreenGiftAnimationEvent | null;
  durationMs?: number;
  onComplete: (eventId: string) => void;
}

const PARTICLE_ANGLES = [0, 28, 56, 84, 112, 140, 168, 196, 224, 252, 280, 308, 336];

export function FullScreenGiftAnimationOverlay({
  event,
  durationMs = 3000,
  onComplete,
}: FullScreenGiftAnimationOverlayProps) {
  useEffect(() => {
    if (!event) return;
    const timer = window.setTimeout(() => {
      onComplete(event.id);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [event?.id, durationMs, onComplete]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center overflow-hidden"
          role="status"
          aria-live="polite"
          aria-label={`¡${event.senderName} acaba de enviar un ${event.gift.name} gigante!`}
        >
          {/* Backdrop glow without interrupting live audio/video */}
          <div className="absolute inset-0 bg-radial from-[#E84393]/28 via-[#6C5CE7]/18 to-transparent" />

          {/* Shockwave rings */}
          <motion.div
            initial={{ scale: 0.35, opacity: 0.9 }}
            animate={{ scale: 2.35, opacity: 0 }}
            transition={{ duration: 1.5, repeat: 1, ease: 'easeOut' }}
            className="absolute w-56 h-56 rounded-full border-4 border-[#E84393]/70 shadow-[0_0_50px_rgba(232,67,147,0.8)]"
          />
          <motion.div
            initial={{ scale: 0.25, opacity: 0.85 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 1.7, delay: 0.2, repeat: 1, ease: 'easeOut' }}
            className="absolute w-48 h-48 rounded-full border-4 border-[#00B4D8]/75 shadow-[0_0_50px_rgba(0,180,216,0.8)]"
          />

          {/* Radial neon confetti & geometric particles */}
          <div className="absolute inset-0 flex items-center justify-center">
            {PARTICLE_ANGLES.map((deg, idx) => {
              const rad = (deg * Math.PI) / 180;
              const dist = idx % 2 === 0 ? 185 : 145;
              const tx = Math.cos(rad) * dist;
              const ty = Math.sin(rad) * dist;
              const color =
                idx % 3 === 0 ? '#E84393' : idx % 3 === 1 ? '#00B4D8' : '#A78BFA';

              return (
                <motion.span
                  key={deg}
                  initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
                  animate={{
                    x: tx,
                    y: ty,
                    scale: [0.4, 1.3, 0.2],
                    opacity: [0, 1, 0],
                    rotate: idx % 2 === 0 ? 220 : -220,
                  }}
                  transition={{
                    duration: 2.2,
                    delay: (idx % 4) * 0.12,
                    ease: 'easeOut',
                  }}
                  style={{ backgroundColor: color }}
                  className="absolute w-3.5 h-3.5 rounded-sm shadow-[0_0_14px_currentColor]"
                />
              );
            })}
          </div>

          {/* Giant Center Gift Showcase */}
          <motion.div
            initial={{ scale: 0.35, y: 36, opacity: 0 }}
            animate={{
              scale: [0.35, 1.12, 1, 1.05, 1],
              y: [36, -10, 0, -6, 0],
              opacity: 1,
            }}
            exit={{ scale: 0.75, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            className="relative flex flex-col items-center justify-center px-6 text-center gap-4 max-w-md"
          >
            <div className="relative p-2 rounded-[34px] bg-gradient-to-tr from-[#E84393] via-[#6C5CE7] to-[#00B4D8] shadow-[0_0_70px_rgba(232,67,147,0.65),0_0_45px_rgba(0,180,216,0.55)]">
              <div className="rounded-[28px] bg-[#0B0E1A]/90 p-3">
                <GiftVisual
                  gift={event.gift}
                  sizeClass="w-40 h-40 sm:w-52 sm:h-52 rounded-[22px]"
                  iconClassName="w-20 h-20 sm:w-24 sm:h-24"
                />
              </div>
              <span className="absolute -top-3 -right-3 w-10 h-10 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white animate-spin" />
              </span>
            </div>

            <div className="px-5 py-3 rounded-2xl bg-[#0B0E1A]/90 backdrop-blur-2xl border border-white/20 shadow-[0_12px_36px_rgba(0,0,0,0.65)] space-y-1.5">
              <p className="text-sm sm:text-base font-extrabold text-white leading-snug">
                ¡{event.senderName} acaba de enviar un{' '}
                <span className="bg-gradient-to-r from-[#F9A8D4] via-white to-[#7DD3FC] bg-clip-text text-transparent">
                  {event.gift.name}
                </span>{' '}
                gigante!
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7DD3FC] tabular-nums">
                <Coins className="w-3.5 h-3.5 text-[#00B4D8]" />
                {event.gift.coins.toLocaleString('es-ES')} monedas
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
