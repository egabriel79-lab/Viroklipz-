import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Flower2, Gift, Lock, Plus, Sparkles, Star, X } from 'lucide-react';
import {
  GIFT_CATEGORY_TABS,
  LIVE_GIFTS_CATALOG,
  type LiveGiftCatalogItem,
} from '../lib/liveGifts';
import type { AudienceFavorite, GiftCategoryTab } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import { GiftVisual } from './GiftVisual';

export interface GiftBattleTargetConfig {
  selectedSlot: 'creator1' | 'creator2';
  onSelectSlot: (slot: 'creator1' | 'creator2') => void;
  creator1Label: string;
  creator2Label: string;
  creator1AvatarUrl?: string;
  creator2AvatarUrl?: string;
}

interface GiftCatalogSheetProps {
  isOpen: boolean;
  targetLabel?: string;
  initialTab?: GiftCategoryTab;
  coins: number;
  freeRoses: number;
  userFanLevel?: number;
  audienceFavorites?: AudienceFavorite[];
  battleTargets?: GiftBattleTargetConfig;
  sending?: boolean;
  onClose: () => void;
  onSendGift: (gift: LiveGiftCatalogItem) => void;
  onOpenRecharge: () => void;
}

export function GiftCatalogSheet({
  isOpen,
  targetLabel = 'Catálogo de Regalos',
  initialTab = 'populares',
  coins,
  freeRoses,
  userFanLevel = 1,
  audienceFavorites = [],
  battleTargets,
  sending = false,
  onClose,
  onSendGift,
  onOpenRecharge,
}: GiftCatalogSheetProps) {
  const [activeTab, setActiveTab] = useState<GiftCategoryTab>(initialTab);
  const [selectedGiftId, setSelectedGiftId] = useState<string>(LIVE_GIFTS_CATALOG[0].id);
  const [snackMessage, setSnackMessage] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const snackTimerRef = useRef<number | null>(null);

  const tabGifts = useMemo(
    () => LIVE_GIFTS_CATALOG.filter((g) => g.category === activeTab),
    [activeTab],
  );

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSnackMessage(null);
      const firstForTab = LIVE_GIFTS_CATALOG.find((g) => g.category === initialTab);
      if (firstForTab) {
        setSelectedGiftId(firstForTab.id);
      }
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!tabGifts.some((g) => g.id === selectedGiftId) && tabGifts[0]) {
      setSelectedGiftId(tabGifts[0].id);
    }
  }, [tabGifts, selectedGiftId]);

  useEffect(() => {
    return () => {
      if (snackTimerRef.current) window.clearTimeout(snackTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const showSnackBar = (msg: string) => {
    setSnackMessage(msg);
    if (snackTimerRef.current) window.clearTimeout(snackTimerRef.current);
    snackTimerRef.current = window.setTimeout(() => {
      setSnackMessage(null);
    }, 3000);
  };

  const selectedGift =
    LIVE_GIFTS_CATALOG.find((g) => g.id === selectedGiftId) ||
    tabGifts[0] ||
    LIVE_GIFTS_CATALOG[0];

  const isSelectedLocked = Boolean(
    selectedGift.requiredFanLevel && userFanLevel < selectedGift.requiredFanLevel,
  );

  const selectedFavorite = audienceFavorites.find(
    (f) =>
      f.giftId.toLowerCase() === selectedGift.id.toLowerCase() ||
      f.giftName.trim().toLowerCase() === selectedGift.name.trim().toLowerCase(),
  );

  const handleGiftCardClick = (gift: LiveGiftCatalogItem) => {
    setSelectedGiftId(gift.id);
    if (gift.requiredFanLevel && userFanLevel < gift.requiredFanLevel) {
      showSnackBar(`Nivel ${gift.requiredFanLevel} requerido para enviar ${gift.name}`);
    }
  };

  const handlePrimarySendClick = () => {
    if (selectedGift.requiredFanLevel && userFanLevel < selectedGift.requiredFanLevel) {
      showSnackBar(`Nivel ${selectedGift.requiredFanLevel} requerido para enviar ${selectedGift.name}`);
      return;
    }
    onSendGift(selectedGift);
  };

  const handleSwipeStart = (clientX: number) => {
    touchStartXRef.current = clientX;
  };

  const handleSwipeEnd = (clientX: number) => {
    if (touchStartXRef.current === null) return;
    const deltaX = clientX - touchStartXRef.current;
    touchStartXRef.current = null;
    if (Math.abs(deltaX) < 48) return;

    const currentIdx = GIFT_CATEGORY_TABS.findIndex((t) => t.id === activeTab);
    if (currentIdx === -1) return;
    if (deltaX < 0 && currentIdx < GIFT_CATEGORY_TABS.length - 1) {
      setActiveTab(GIFT_CATEGORY_TABS[currentIdx + 1].id);
    } else if (deltaX > 0 && currentIdx > 0) {
      setActiveTab(GIFT_CATEGORY_TABS[currentIdx - 1].id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/65 backdrop-blur-[2px] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Catálogo de Regalos Viroklipz"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-t-3xl bg-[#0B0E1A]/94 backdrop-blur-2xl border-t border-x border-white/15 shadow-[0_-16px_50px_rgba(232,67,147,0.22)] p-4 sm:p-5 pb-[calc(1.2rem+env(safe-area-inset-bottom))] text-white space-y-3 max-h-[84dvh] flex flex-col relative"
      >
        {/* Drag Indicator + Top Header */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto shrink-0" />

        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#E84393] via-[#6C5CE7] to-[#00B4D8] flex items-center justify-center shrink-0">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-white truncate">{targetLabel}</h3>
                <FanLevelBadge level={userFanLevel} compact />
              </div>
              <p className="text-[11px] text-zinc-400">
                Desliza las pestañas y apoya en vivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {freeRoses > 0 && (
              <div className="h-8 px-2.5 rounded-xl bg-[#E84393]/15 border border-[#E84393]/45 text-[#F9A8D4] text-[11px] font-bold inline-flex items-center gap-1 tabular-nums">
                <Flower2 className="w-3.5 h-3.5 text-[#E84393]" />
                <span>{freeRoses}</span>
              </div>
            )}

            <button
              type="button"
              onClick={onOpenRecharge}
              className="h-8 px-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-[#00B4D8]/45 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Coins className="w-3.5 h-3.5 text-[#00B4D8]" />
              <span className="tabular-nums">{coins.toLocaleString('es-ES')}</span>
              <span className="w-4 h-4 rounded-md bg-gradient-to-r from-[#E84393] to-[#00B4D8] flex items-center justify-center">
                <Plus className="w-3 h-3 text-white stroke-[2.5]" />
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar catálogo de regalos"
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {battleTargets && (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-white/[0.05] border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => battleTargets.onSelectSlot('creator1')}
              className={`min-h-[40px] px-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                battleTargets.selectedSlot === 'creator1'
                  ? 'bg-gradient-to-r from-[#E84393] to-[#9B5DE5] text-white shadow-[0_0_16px_rgba(232,67,147,0.4)]'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <AvatarImg
                src={battleTargets.creator1AvatarUrl || ''}
                alt={battleTargets.creator1Label}
                fallbackText={battleTargets.creator1Label}
                sizeClass="w-5 h-5"
              />
              <span className="truncate">{battleTargets.creator1Label}</span>
            </button>

            <button
              type="button"
              onClick={() => battleTargets.onSelectSlot('creator2')}
              className={`min-h-[40px] px-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                battleTargets.selectedSlot === 'creator2'
                  ? 'bg-gradient-to-r from-[#00B4D8] to-[#2563EB] text-white shadow-[0_0_16px_rgba(0,180,216,0.4)]'
                  : 'text-zinc-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <AvatarImg
                src={battleTargets.creator2AvatarUrl || ''}
                alt={battleTargets.creator2Label}
                fallbackText={battleTargets.creator2Label}
                sizeClass="w-5 h-5"
              />
              <span className="truncate">{battleTargets.creator2Label}</span>
            </button>
          </div>
        )}

        {/* Pestañas deslizables: Populares, Club de Fans, ViroArena, Nivel de Donador */}
        <div
          role="tablist"
          aria-label="Categorías de regalos"
          className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/[0.06] border border-white/10 overflow-x-auto no-scrollbar shrink-0"
        >
          {GIFT_CATEGORY_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[38px] px-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-gradient-to-r from-[#E84393] via-[#6C5CE7] to-[#00B4D8] text-white shadow-[0_0_16px_rgba(232,67,147,0.35)]'
                    : 'text-zinc-300 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Cuadrícula de Regalos (4 columnas) */}
        <div
          onTouchStart={(e) => handleSwipeStart(e.touches[0].clientX)}
          onTouchEnd={(e) => handleSwipeEnd(e.changedTouches[0].clientX)}
          className="flex-1 overflow-y-auto pr-0.5"
        >
          <div className="grid grid-cols-4 gap-2">
            {tabGifts.map((gift) => {
              const selected = selectedGift.id === gift.id;
              const isFreeRose = gift.id === 'rosa' && freeRoses > 0;
              const locked = Boolean(gift.requiredFanLevel && userFanLevel < gift.requiredFanLevel);
              const linkedFav = audienceFavorites.find(
                (f) =>
                  f.giftId.toLowerCase() === gift.id.toLowerCase() ||
                  f.giftName.trim().toLowerCase() === gift.name.trim().toLowerCase(),
              );

              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleGiftCardClick(gift)}
                  className={`relative p-2 rounded-2xl flex flex-col items-center text-center gap-1.5 transition-all cursor-pointer border-2 ${
                    selected
                      ? 'bg-[#25102F]/90 border-[#E84393] shadow-[0_0_20px_rgba(232,67,147,0.45)]'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10'
                  } ${locked ? 'opacity-80' : ''}`}
                >
                  {linkedFav && !locked && (
                    <span
                      title={`Favorito del Público: ${linkedFav.action}`}
                      className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#E84393]/25 border border-[#E84393]/60 flex items-center justify-center z-10"
                    >
                      <Star className="w-2.5 h-2.5 text-[#F9A8D4] fill-[#F9A8D4]" />
                    </span>
                  )}

                  {gift.interactiveEffect && !linkedFav && !locked && (
                    <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#00B4D8]/25 border border-[#00B4D8]/60 flex items-center justify-center z-10">
                      <Sparkles className="w-2.5 h-2.5 text-[#7DD3FC]" />
                    </span>
                  )}

                  <div className="relative">
                    <GiftVisual gift={gift} sizeClass="w-12 h-12 sm:w-14 sm:h-14" />
                    {locked && (
                      <div className="absolute inset-0 rounded-2xl bg-[#080A12]/75 backdrop-blur-[1px] border border-[#E84393]/60 flex items-center justify-center">
                        <Lock className="w-4 h-4 text-[#F9A8D4]" />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] font-bold text-white line-clamp-1 w-full">
                    {gift.name}
                  </p>

                  {locked && gift.requiredFanLevel ? (
                    <span className="text-[9.5px] font-extrabold text-[#F9A8D4] leading-tight">
                      Nivel {gift.requiredFanLevel} requerido
                    </span>
                  ) : isFreeRose ? (
                    <span className="text-[10.5px] font-extrabold text-[#F9A8D4] tabular-nums">
                      Gratis ({freeRoses})
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-bold text-[#7DD3FC] inline-flex items-center gap-0.5 tabular-nums">
                      <Coins className="w-3 h-3 text-[#00B4D8] shrink-0" />
                      {gift.coins.toLocaleString('es-ES')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* SnackBar for locked gift attempts */}
        {snackMessage && (
          <div
            role="status"
            aria-live="polite"
            className="px-3.5 py-2.5 rounded-2xl bg-[#2A0E2C]/95 border border-[#E84393] text-xs font-bold text-white flex items-center gap-2 shadow-[0_0_20px_rgba(232,67,147,0.45)] shrink-0"
          >
            <Lock className="w-4 h-4 text-[#F9A8D4] shrink-0" />
            <span>{snackMessage}</span>
          </div>
        )}

        {/* Context info for selected gift */}
        {!snackMessage && (selectedGift.interactiveEffect || selectedFavorite) && (
          <div className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-[11px] text-zinc-200 flex items-center gap-2 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#E84393] shrink-0" />
            <span className="truncate">
              {selectedFavorite
                ? `Acción VIP: ${selectedFavorite.action}`
                : selectedGift.interactiveEffect}
            </span>
          </div>
        )}

        {/* Botones inferiores: Recargar + Enviar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenRecharge}
            className="min-h-[48px] px-4 rounded-2xl bg-[#10162B] hover:bg-[#17203D] border border-[#00B4D8]/60 text-[#7DD3FC] hover:text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
          >
            <Coins className="w-4 h-4 text-[#00B4D8]" />
            <span>Recargar</span>
          </button>

          <button
            type="button"
            disabled={sending}
            onClick={handlePrimarySendClick}
            className={`flex-1 min-h-[48px] px-4 rounded-2xl text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              isSelectedLocked
                ? 'bg-white/15 border border-[#E84393]/60 text-zinc-200'
                : 'bg-gradient-to-r from-[#E84393] via-[#9B5DE5] to-[#00B4D8] hover:brightness-110 shadow-[0_6px_24px_rgba(232,67,147,0.45)]'
            } disabled:opacity-50`}
          >
            {isSelectedLocked && <Lock className="w-4 h-4 text-[#F9A8D4] shrink-0" />}
            <span className="truncate">
              {sending
                ? 'Enviando...'
                : isSelectedLocked
                  ? `Nivel ${selectedGift.requiredFanLevel} requerido`
                  : `Enviar ${selectedGift.name}`}
            </span>
            {!isSelectedLocked && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-black/25 tabular-nums shrink-0">
                {selectedGift.id === 'rosa' && freeRoses > 0
                  ? 'Gratis'
                  : `${selectedGift.coins.toLocaleString('es-ES')}`}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
