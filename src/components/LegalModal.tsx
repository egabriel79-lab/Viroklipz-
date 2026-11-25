import { useState } from 'react';
import { FileText, ShieldCheck, X } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
}

export function LegalModal({
  isOpen,
  initialTab = 'terms',
  onClose,
}: LegalModalProps) {
  const [tab, setTab] = useState<'terms' | 'privacy'>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Términos de Uso y Política de Privacidad"
    >
      <div className="w-full max-w-xl max-h-[88dvh] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {tab === 'terms' ? (
              <FileText className="w-5 h-5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-[#0086A8] dark:text-[#00B4D8]" />
            )}
            <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
              {tab === 'terms' ? 'Términos de Uso' : 'Política de Privacidad'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso legal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTab('terms')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'terms'
                ? 'bg-[#6C5CE7] text-white'
                : 'bg-zinc-100 dark:bg-[#0F111A] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/10'
            }`}
          >
            Términos de Uso
          </button>
          <button
            type="button"
            onClick={() => setTab('privacy')}
            className={`min-h-[38px] px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
              tab === 'privacy'
                ? 'bg-[#6C5CE7] text-white'
                : 'bg-zinc-100 dark:bg-[#0F111A] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/10'
            }`}
          >
            Política de Privacidad
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {tab === 'terms' ? (
            <>
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  1. Uso de Viroklipz y cuentas
                </h3>
                <p>
                  Al crear una cuenta o publicar klips en Viroklipz te comprometes a usar la
                  plataforma de forma respetuosa y conforme a la ley vigente. Queda prohibido el
                  spam automatizado, el acoso, los discursos de odio y el contenido ilegal o
                  explícito no autorizado.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  2. Derechos de autor y propiedad del contenido
                </h3>
                <p>
                  Conservas la titularidad de los videos, audios y descripciones originales que
                  publiques. Al compartir contenido público en Viroklipz, autorizas su reproducción
                  dentro de la aplicación. No subas material protegido por derechos de autor sin
                  permiso; cualquier usuario puede reportar infracciones desde cada klip.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  3. Moderación, reportes y bloqueos
                </h3>
                <p>
                  Cada klip y mensaje del chat incluye opciones de Reportar y Bloquear. El equipo
                  de Viroklipz puede retirar publicaciones o restringir cuentas que incumplan las
                  normas de convivencia o superen los límites de seguridad de la plataforma.
                </p>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  1. Datos que almacenamos
                </h3>
                <p>
                  Tu perfil público (@usuario, nombre visible, descripción y estadísticas de klips)
                  es visible para la comunidad. Los datos personales del formulario privado
                  (nombres, apellidos, teléfono y correo electrónico) se almacenan de forma aislada
                  y únicamente tú puedes verlos o modificarlos.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  2. Cookies y almacenamiento local (PWA)
                </h3>
                <p>
                  Viroklipz utiliza almacenamiento local del navegador (IndexedDB y caché del
                  Service Worker) para mantener tu preferencia de ahorro de datos, tu foto de
                  perfil seleccionada y los archivos multimedia locales sin consumir datos extra.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-display text-sm font-bold text-zinc-900 dark:text-white">
                  3. Eliminación y control de tu cuenta
                </h3>
                <p>
                  Puedes editar tu descripción, eliminar tus propios klips o comentarios, desbloquear
                  cuentas y cerrar sesión en cualquier momento desde tu perfil.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-[#131622] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] rounded-xl bg-neon-cta text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
