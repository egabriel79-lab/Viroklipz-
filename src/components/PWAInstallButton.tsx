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
            ? 'min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
            : 'w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
        }
      >
        <Download className="w-4 h-4 text-[#FF3B5C]" />
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
              ? 'min-h-[36px] px-2.5 py-1 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
              : 'w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors'
          }
        >
          <Smartphone className="w-4 h-4 text-[#FF3B5C]" />
          <span>{compact ? 'Instalar' : 'Instalar en iOS'}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#121216] border border-white/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white">
                  Instalar en iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Cerrar instrucciones"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <ol className="text-sm text-zinc-300 space-y-2 leading-relaxed">
                <li>
                  1. Pulsa el botón <strong className="text-white">Compartir</strong> en la barra de Safari.
                </li>
                <li>
                  2. Desliza hacia abajo y selecciona{' '}
                  <strong className="text-white">Añadir a pantalla de inicio</strong>.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
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
