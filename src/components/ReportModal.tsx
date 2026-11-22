import { useState, type FormEvent } from 'react';
import { Ban, Flag, X } from 'lucide-react';
import { MAX_REPORT_DETAILS_LEN } from '../lib/validation';
import type { ReportReason, ReportTargetType } from '../types/viroklipz';

export interface ReportTarget {
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorId: string;
  targetUsername: string;
}

interface ReportModalProps {
  target: ReportTarget | null;
  canBlock: boolean;
  onClose: () => void;
  onSubmitReport: (input: {
    target: ReportTarget;
    reason: ReportReason;
    details: string;
  }) => Promise<void>;
  onBlockUser: (targetId: string, targetUsername: string) => Promise<void>;
}

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'contenido_inapropiado', label: 'Contenido inapropiado' },
  { value: 'spam', label: 'Spam o estafa' },
  { value: 'acoso', label: 'Acoso o discurso de odio' },
  { value: 'derechos_autor', label: 'Derechos de autor' },
];

export function ReportModal({
  target,
  canBlock,
  onClose,
  onSubmitReport,
  onBlockUser,
}: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>('contenido_inapropiado');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!target) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmitReport({
        target,
        reason,
        details: details.trim().slice(0, MAX_REPORT_DETAILS_LEN),
      });
      setDetails('');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo enviar el reporte. Inténtalo de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBlock = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onBlockUser(target.targetAuthorId, target.targetUsername);
      onClose();
    } catch {
      setErrorMsg('No se pudo bloquear a esta cuenta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reportar o bloquear"
    >
      <div className="w-full sm:max-w-md bg-[#121216] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-2xl overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Flag className="w-4 h-4 text-[#FF3B5C] shrink-0" />
            <h2 className="font-display text-base font-bold text-white truncate">
              Moderar @{target.targetUsername}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              Motivo del reporte
            </label>
            <div className="grid grid-cols-1 gap-2">
              {REASON_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReason(opt.value)}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-left text-xs font-semibold transition-colors cursor-pointer ${
                    reason === opt.value
                      ? 'bg-[#FF3B5C]/15 border-[#FF3B5C] text-white'
                      : 'bg-zinc-900 border-white/10 text-zinc-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="report-details" className="text-xs font-medium text-zinc-400">
              Detalles opcionales
            </label>
            <textarea
              id="report-details"
              rows={2}
              maxLength={MAX_REPORT_DETAILS_LEN}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe brevemente qué ocurrió..."
              className="w-full bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none resize-none"
            />
          </div>

          {errorMsg && <p className="text-xs text-[#FF3B5C]">{errorMsg}</p>}

          <div className="space-y-2.5 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[44px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {submitting ? 'Enviando...' : 'Enviar reporte'}
            </button>

            {canBlock && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleBlock()}
                className="w-full min-h-[44px] rounded-xl border border-white/15 bg-zinc-900 hover:bg-white/5 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Ban className="w-4 h-4 text-[#FF3B5C]" />
                Bloquear a @{target.targetUsername}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
