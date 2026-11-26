import { useState } from 'react';
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Flower2,
  HeartHandshake,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { RECHARGE_PACKAGES, WELCOME_BONUS_ROSES } from '../lib/liveGifts';
import { rechargeCoinsViaVexPay } from '../lib/viroklipzService';
import type { RechargePackage, UserProfile } from '../types/viroklipz';

interface FirstRechargeModalProps {
  isOpen: boolean;
  currentUser: UserProfile | null;
  isWelcomeOffer?: boolean;
  missingGiftName?: string | null;
  onClose: () => void;
  onSuccess?: (result: { coinsCredited: number; bonusRoses: number }) => void;
  onRequestSignIn: () => void;
}

export function FirstRechargeModal({
  isOpen,
  currentUser,
  isWelcomeOffer,
  missingGiftName = null,
  onClose,
  onSuccess,
  onRequestSignIn,
}: FirstRechargeModalProps) {
  const [selectedPkg, setSelectedPkg] = useState<RechargePackage>(RECHARGE_PACKAGES[0]);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [externalCheckoutUrl, setExternalCheckoutUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFirstRecharge =
    typeof isWelcomeOffer === 'boolean'
      ? isWelcomeOffer
      : !currentUser?.welcomeRechargeClaimed;

  const handleConfirmRecharge = async () => {
    setErrorMsg(null);
    if (!currentUser) {
      onClose();
      onRequestSignIn();
      return;
    }

    setProcessing(true);
    try {
      const result = await rechargeCoinsViaVexPay(
        currentUser.uid,
        selectedPkg,
        isFirstRecharge,
      );

      if (result.mode === 'external' && result.checkoutUrl) {
        setExternalCheckoutUrl(result.checkoutUrl);
        return;
      }

      onSuccess?.({
        coinsCredited: result.coinsCredited,
        bonusRoses: result.bonusRoses,
      });
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo procesar la recarga con VexPay.',
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Oferta de Bienvenida Viroklipz"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-gradient-to-br from-[#2B0C29] via-[#1B1035] to-[#0D101E] border border-[#E84393]/45 shadow-[0_0_50px_rgba(232,67,147,0.35)] p-5 sm:p-6 pb-[calc(1.4rem+env(safe-area-inset-bottom))] space-y-4 text-white max-h-[92dvh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#F9A8D4]">
              <Sparkles className="w-3.5 h-3.5 text-[#E84393]" />
              <span>{isFirstRecharge ? 'Primera Recarga' : 'Billetera Viroklipz'}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold leading-tight bg-gradient-to-r from-white via-[#F9A8D4] to-[#7DD3FC] bg-clip-text text-transparent">
              Oferta de Bienvenida Viroklipz
            </h2>
            {missingGiftName && (
              <p className="text-xs text-zinc-200/90">
                Recarga monedas para enviar <strong className="text-[#F9A8D4]">{missingGiftName}</strong> ahora mismo.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar oferta de recarga"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Beneficios visuales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-2xl bg-white/[0.07] border border-[#E84393]/35 flex sm:flex-col items-center sm:items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#E84393] to-[#9B5DE5] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(232,67,147,0.4)]">
              <Flower2 className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-bold leading-snug text-white">
              Consigue {WELCOME_BONUS_ROSES} Rosas de regalo
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.07] border border-[#00B4D8]/35 flex sm:flex-col items-center sm:items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00B4D8] to-[#6C5CE7] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(0,180,216,0.35)]">
              <Coins className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-bold leading-snug text-white">
              Obtén Monedas de Bonus
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-white/[0.07] border border-[#6C5CE7]/40 flex sm:flex-col items-center sm:items-start gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6C5CE7] to-[#E84393] flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(108,92,231,0.4)]">
              <HeartHandshake className="w-4 h-4 text-white" />
            </div>
            <p className="text-xs font-bold leading-snug text-white">
              Apoya a tus creadores favoritos
            </p>
          </div>
        </div>

        {/* Grid de Paquetes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span className="font-semibold">Elige tu paquete de monedas</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#7DD3FC]">
              <ShieldCheck className="w-3.5 h-3.5" />
              VexPay Seguro
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {RECHARGE_PACKAGES.map((pkg) => {
              const selected = selectedPkg.id === pkg.id;
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    setSelectedPkg(pkg);
                    setExternalCheckoutUrl(null);
                  }}
                  className={`relative p-3.5 rounded-2xl text-left transition-all cursor-pointer border-2 ${
                    selected
                      ? 'bg-[#2B1237]/95 border-[#E84393] shadow-[0_0_24px_rgba(232,67,147,0.45)]'
                      : 'bg-white/[0.06] hover:bg-white/[0.1] border-white/10'
                  }`}
                >
                  {pkg.badge && (
                    <span className="inline-block mb-1.5 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#E84393] to-[#6C5CE7] text-[10px] font-extrabold uppercase tracking-wide text-white">
                      {pkg.badge}
                    </span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-[#00B4D8] shrink-0" />
                    <span className="font-display text-base font-extrabold tabular-nums text-white">
                      {pkg.baseCoins}
                    </span>
                    <span className="text-xs font-bold text-[#F9A8D4] tabular-nums">
                      + {pkg.bonusCoins} Bonus
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-300 mt-1 tabular-nums">
                    Total: <strong className="text-white">{pkg.totalCoins}</strong> monedas
                  </p>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#7DD3FC] tabular-nums">
                      {pkg.priceLabel}
                    </span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-[#E84393]" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/50 text-xs text-rose-100 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {externalCheckoutUrl && (
          <div className="p-3.5 rounded-2xl bg-[#00B4D8]/15 border border-[#00B4D8]/50 space-y-2.5">
            <p className="text-xs text-white font-semibold">
              Tu sesión de pago en VexPay está lista para completar la recarga:
            </p>
            <a
              href={externalCheckoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7] text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <span>Abrir pasarela VexPay</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* CTA Recargar */}
        <button
          type="button"
          disabled={processing}
          onClick={() => void handleConfirmRecharge()}
          className="w-full min-h-[50px] px-5 rounded-2xl bg-gradient-to-r from-[#E84393] via-[#9B5DE5] to-[#00B4D8] hover:brightness-110 disabled:opacity-50 text-white text-sm font-extrabold shadow-[0_8px_28px_rgba(232,67,147,0.45)] transition-all cursor-pointer whitespace-nowrap"
        >
          {processing
            ? 'Procesando recarga en VexPay...'
            : `Recargar ${selectedPkg.totalCoins} Monedas por ${selectedPkg.priceLabel}`}
        </button>
      </div>
    </div>
  );
}
