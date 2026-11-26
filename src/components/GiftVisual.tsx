import { useState } from 'react';
import {
  Car,
  Cat,
  Crown,
  Feather,
  Flame,
  Flower2,
  Heart,
  PartyPopper,
  Plane,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Swords,
  Wind,
  Zap,
} from 'lucide-react';
import type { GiftIconKind, LiveGiftCatalogItem } from '../lib/liveGifts';

interface GiftVisualProps {
  gift: LiveGiftCatalogItem;
  sizeClass?: string;
  iconClassName?: string;
}

function renderFallbackEmblem(kind: GiftIconKind, iconClassName = 'w-7 h-7') {
  switch (kind) {
    case 'rose':
      return (
        <Flower2
          className={`${iconClassName} text-[#F9A8D4] drop-shadow-[0_2px_10px_rgba(232,67,147,0.75)]`}
        />
      );
    case 'bolt':
      return (
        <Zap
          className={`${iconClassName} text-[#7DD3FC] fill-[#00B4D8]/50 drop-shadow-[0_2px_10px_rgba(0,180,216,0.85)]`}
        />
      );
    case 'star':
      return (
        <Star
          className={`${iconClassName} text-[#F9A8D4] fill-[#E84393]/60 drop-shadow-[0_2px_10px_rgba(232,67,147,0.8)]`}
        />
      );
    case 'heart':
      return (
        <Heart
          className={`${iconClassName} text-[#F472B6] fill-[#E84393] drop-shadow-[0_2px_10px_rgba(232,67,147,0.8)]`}
        />
      );
    case 'rocket':
      return (
        <Rocket
          className={`${iconClassName} text-[#9BE8FA] drop-shadow-[0_2px_10px_rgba(0,180,216,0.8)]`}
        />
      );
    case 'confetti':
      return (
        <PartyPopper
          className={`${iconClassName} text-[#F9A8D4] drop-shadow-[0_2px_12px_rgba(232,67,147,0.85)]`}
        />
      );
    case 'leopard':
      return (
        <Cat
          className={`${iconClassName} text-[#C4B5FD] drop-shadow-[0_2px_10px_rgba(108,92,231,0.8)]`}
        />
      );
    case 'shield':
      return (
        <Shield
          className={`${iconClassName} text-[#C4B5FD] fill-[#6C5CE7]/45 drop-shadow-[0_2px_10px_rgba(108,92,231,0.85)]`}
        />
      );
    case 'boxing':
      return (
        <Swords
          className={`${iconClassName} text-[#F472B6] drop-shadow-[0_2px_12px_rgba(232,67,147,0.9)]`}
        />
      );
    case 'car':
      return (
        <Car
          className={`${iconClassName} text-[#7DD3FC] drop-shadow-[0_2px_10px_rgba(0,180,216,0.85)]`}
        />
      );
    case 'spaceship':
      return (
        <Rocket
          className={`${iconClassName} text-[#7DD3FC] drop-shadow-[0_2px_12px_rgba(0,180,216,0.9)]`}
        />
      );
    case 'jet':
      return (
        <Plane
          className={`${iconClassName} text-[#9BE8FA] drop-shadow-[0_2px_12px_rgba(0,180,216,0.9)]`}
        />
      );
    case 'dragon':
      return (
        <Flame
          className={`${iconClassName} text-[#F472B6] fill-[#E84393]/55 drop-shadow-[0_2px_10px_rgba(232,67,147,0.85)]`}
        />
      );
    case 'phoenix':
      return (
        <Feather
          className={`${iconClassName} text-[#F9A8D4] drop-shadow-[0_2px_12px_rgba(232,67,147,0.9)]`}
        />
      );
    case 'pegasus':
      return (
        <Wind
          className={`${iconClassName} text-[#A5F3FC] drop-shadow-[0_2px_12px_rgba(0,180,216,0.9)]`}
        />
      );
    case 'pulse':
      return (
        <Zap
          className={`${iconClassName} text-[#38BDF8] drop-shadow-[0_2px_12px_rgba(0,180,216,0.9)]`}
        />
      );
    case 'crown':
      return (
        <Crown
          className={`${iconClassName} text-[#F9A8D4] fill-[#E84393]/50 drop-shadow-[0_2px_10px_rgba(232,67,147,0.85)]`}
        />
      );
    case 'aurora':
    default:
      return (
        <Sparkles
          className={`${iconClassName} text-[#A5F3FC] drop-shadow-[0_2px_12px_rgba(108,92,231,0.9)]`}
        />
      );
  }
}

export function GiftVisual({
  gift,
  sizeClass = 'w-14 h-14',
  iconClassName = 'w-7 h-7',
}: GiftVisualProps) {
  const [imgFailed, setImgFailed] = useState(false);

  if (gift.imageUrl && !imgFailed) {
    return (
      <div
        className={`${sizeClass} relative rounded-2xl overflow-hidden bg-[#0D101E] border border-white/15 shadow-inner shrink-0`}
      >
        <img
          src={gift.imageUrl}
          alt={gift.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} relative rounded-2xl overflow-hidden bg-gradient-to-br ${gift.accent} p-[1.5px] shadow-[0_6px_18px_rgba(108,92,231,0.3)] shrink-0`}
    >
      <div className="w-full h-full rounded-[14px] bg-[#101426]/90 flex items-center justify-center relative overflow-hidden">
        <div
          aria-hidden="true"
          className={`absolute inset-0 opacity-30 bg-gradient-to-tr ${gift.accent}`}
        />
        <span className="relative z-10">{renderFallbackEmblem(gift.iconKind, iconClassName)}</span>
      </div>
    </div>
  );
}
