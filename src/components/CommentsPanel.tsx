import { useState, type FormEvent } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { MAX_COMMENT_LEN, validateCommentText } from '../lib/validation';
import type { ClipComment, ClipItem, UserProfile } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';

interface CommentsPanelProps {
  clip: ClipItem | null;
  comments: ClipComment[];
  currentUser: UserProfile | null;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onRequestSignIn: () => void;
}

function formatRelativeEs(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Ahora';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} d`;
}

export function CommentsPanel({
  clip,
  comments,
  currentUser,
  isMobileOpen,
  onCloseMobile,
  onAddComment,
  onDeleteComment,
  onRequestSignIn,
}: CommentsPanelProps) {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!clip) return;
    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    const check = validateCommentText(draft);
    if (!check.ok) {
      setErrorMsg(check.message);
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onAddComment(check.value);
      setDraft('');
    } catch {
      setErrorMsg('No se pudo publicar el comentario. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const panelBody = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <MessageCircle className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6]" />
          <h2 className="font-display font-bold text-base text-zinc-900 dark:text-white">
            Comentarios
          </h2>
          <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {comments.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar comentarios"
          className="xl:hidden min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Clip context */}
      {clip && (
        <div className="px-5 py-3 border-b border-zinc-200/70 dark:border-white/5 bg-zinc-50 dark:bg-white/[0.02] shrink-0">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            Klip de <span className="text-zinc-800 dark:text-zinc-200 font-medium">@{clip.authorUsername}</span>
          </p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {comments.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Aún no hay comentarios
            </p>
            <p className="text-xs text-zinc-500">
              Sé la primera persona en reaccionar a este klip.
            </p>
          </div>
        ) : (
          comments.map((cmt) => {
            const canDelete =
              Boolean(currentUser) &&
              !cmt.isStarterComment &&
              (cmt.authorId === currentUser?.uid || clip?.authorId === currentUser?.uid);

            return (
              <div key={cmt.id} className="flex items-start gap-3 group">
                <AvatarImg
                  src={cmt.authorAvatarUrl}
                  alt={cmt.authorUsername}
                  fallbackText={cmt.authorUsername}
                  sizeClass="w-8 h-8"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs min-w-0">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        @{cmt.authorUsername}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="text-zinc-500 whitespace-nowrap">
                        {formatRelativeEs(cmt.createdAtMs)}
                      </span>
                    </div>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void onDeleteComment(cmt.id)}
                        aria-label="Eliminar comentario"
                        className="p-1.5 text-zinc-400 dark:text-zinc-500 hover:text-[#E84393] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-zinc-800 dark:text-zinc-200 mt-1 leading-relaxed break-words">
                    {cmt.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="p-4 border-t border-zinc-200 dark:border-white/10 bg-white dark:bg-[#161926] shrink-0">
        {currentUser ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            {errorMsg && (
              <p className="text-xs text-[#E84393]">{errorMsg}</p>
            )}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft}
                maxLength={MAX_COMMENT_LEN}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Añade un comentario..."
                className="flex-1 min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-500 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={submitting || draft.trim().length === 0}
                aria-label="Enviar comentario"
                className="min-h-[44px] min-w-[44px] px-3.5 rounded-xl bg-neon-cta disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-end">
              <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                {draft.length}/{MAX_COMMENT_LEN}
              </span>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3 py-1">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Inicia sesión para comentar en Viroklipz.
            </p>
            <button
              type="button"
              onClick={onRequestSignIn}
              className="px-4 py-2 rounded-xl bg-neon-cta text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              Entrar
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Docked Right Drawer (xl+) */}
      <aside className="hidden xl:flex flex-col w-[360px] shrink-0 h-[calc(100dvh-2rem)] max-h-[820px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm dark:shadow-none">
        {panelBody}
      </aside>

      {/* Mobile / Tablet Bottom Sheet (< xl) */}
      {isMobileOpen && (
        <div className="xl:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
          <div
            className="flex-1"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="h-[72dvh] max-h-[600px] bg-white dark:bg-[#161926] border-t border-zinc-200 dark:border-white/10 rounded-t-3xl flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <div className="w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />
            {panelBody}
          </div>
        </div>
      )}
    </>
  );
}
