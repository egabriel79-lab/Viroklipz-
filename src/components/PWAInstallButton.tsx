import { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={
          compact
            ? 'min-h-[36px] px-2.5 py-1 rounded-lg bg-white/90 dark:bg-[#161926]/90 hover:bg-zinc-100 dark:hover:bg-[#161926] border border-zinc-200 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
            : 'w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-100 dark:bg-[#161926] hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
        }
      >
        <Download className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6]" />
        <span>{compact ? 'Instalar' : 'Instalar app PWA'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            compact
              ? 'min-h-[36px] px-2.5 py-1 rounded-lg bg-white/90 dark:bg-[#161926]/90 hover:bg-zinc-100 dark:hover:bg-[#161926] border border-zinc-200 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
              : 'w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-100 dark:bg-[#161926] hover:bg-zinc-200 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/15 text-xs font-semibold text-zinc-900 dark:text-white flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
          }
        >
          <Smartphone className="w-4 h-4 text-[#0086A8] dark:text-[#00B4D8]" />
          <span>{compact ? 'Instalar' : 'Instalar en iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Instalar en iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar instrucciones"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="text-sm text-zinc-600 dark:text-zinc-300 space-y-2 leading-relaxed">
                <li>
                  1. Pulsa el botón <strong className="text-zinc-900 dark:text-white">Compartir</strong> en la barra de Safari.
                </li>
                <li>
                  2. Desliza hacia abajo y selecciona{' '}
                  <strong className="text-zinc-900 dark:text-white">Añadir a pantalla de inicio</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-neon-cta text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
