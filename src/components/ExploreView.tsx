import { useState } from 'react';
import { Crown, EyeOff, Flag, Flame, Heart, Link2, Loader2, MoreVertical, Play, Repeat, Search, Users } from 'lucide-react';
import { formatCompactCount } from '../lib/validation';
import type { ClipCategory, ClipItem } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { ClipThumbnail } from './ClipThumbnail';
import { VerifiedBadge } from './VerifiedBadge';

interface ExploreViewProps {
  clips: ClipItem[];
  exploreClips?: ClipItem[];
  isLoading?: boolean;
  likedIds: Set<string>;
  currentUserUid?: string | null;
  verifiedUserIds?: Set<string>;
  onSelectClip: (clipId: string) => void;
  onOpenSearch?: () => void;
  onReportClip?: (clip: ClipItem) => void;
  onNotInterestedClip?: (clipId: string) => void;
  onCopyClipLink?: (clip: ClipItem) => void;
}

const CATEGORY_TITLES: Record<ClipCategory, string> = {
  general: 'General',
  baile: 'Baile',
  musica: 'Música',
  cocina: 'Cocina',
  deportes: 'Deportes',
  arte: 'Arte',
  comedia: 'Comedia',
  viajes: 'Viajes',
};

export function ExploreView({
  clips,
  exploreClips = [],
  isLoading = false,
  likedIds,
  currentUserUid,
  verifiedUserIds,
  onSelectClip,
  onOpenSearch,
  onReportClip,
  onNotInterestedClip,
  onCopyClipLink,
}: ExploreViewProps) {
  const [sheetClip, setSheetClip] = useState<ClipItem | null>(null);
  const [activeTab, setActiveTab] = useState<'explore' | 'elite'>('explore');

  const displayedClips = activeTab === 'explore' ? exploreClips : clips;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-10 space-y-5">
      {/* Top Bar: Explore Page & Comunidad Élite + Search button */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-white/10 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">
              {activeTab === 'explore' ? 'Explore Page' : 'Comunidad'}
            </h1>
            {activeTab === 'explore' ? (
              <Flame className="w-5 h-5 text-[#E84393] shrink-0" aria-hidden="true" />
            ) : (
              <Crown className="w-5 h-5 text-[#00B4D8] shrink-0" aria-hidden="true" />
            )}
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {activeTab === 'explore'
              ? 'Klips destacados por retención, guardados y repeticiones'
              : 'Ranking élite · Creadores con 2,000 seguidores o más'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex p-1 rounded-xl bg-zinc-100 dark:bg-[#161926] border border-zinc-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setActiveTab('explore')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'explore'
                  ? 'bg-[#E84393] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Explore Page
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('elite')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'elite'
                  ? 'bg-[#00B4D8] text-white shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              Élite 2K+
            </button>
          </div>

          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              aria-label="Buscar videos y usuarios"
              title="Buscar videos y usuarios"
              className="min-h-[40px] min-w-[40px] rounded-xl bg-white dark:bg-[#161926] hover:bg-zinc-100 dark:hover:bg-white/10 border border-zinc-200 dark:border-white/15 flex items-center justify-center text-zinc-900 dark:text-white transition-colors cursor-pointer shrink-0"
            >
              <Search className="w-4.5 h-4.5 text-[#6C5CE7] dark:text-[#8B7CF6]" />
            </button>
          )}
        </div>
      </header>

      {/* Videos Ranking Grid */}
      {activeTab === 'elite' && isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl">
          <Loader2 className="w-7 h-7 animate-spin text-[#00B4D8]" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Cargando creadores élite...
          </p>
        </div>
      ) : displayedClips.length === 0 ? (
        <div className="py-16 px-6 text-center bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#6C5CE7]/15 border border-[#6C5CE7]/30 flex items-center justify-center mx-auto">
            {activeTab === 'explore' ? (
              <Flame className="w-6 h-6 text-[#E84393]" />
            ) : (
              <Crown className="w-6 h-6 text-[#00B4D8]" />
            )}
          </div>
          <p className="text-base font-medium text-zinc-800 dark:text-zinc-200 max-w-md mx-auto leading-relaxed">
            {activeTab === 'explore'
              ? 'Aún no hay videos nuevos en la Explore Page. Cuando un klip supera el embudo de interacción, aparece aquí.'
              : 'Aún no hay creadores élite en Viroklipz. ¡Sigue subiendo videos para llegar a la cima!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {displayedClips.map((clip) => {
            const likesTotal = clip.likesCount + (clip.isStarter && likedIds.has(clip.id) ? 1 : 0);
            const followersTotal = clip.authorFollowersCount ?? 0;
            return (
              <div
                key={clip.id}
                className="group relative bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-[#00B4D8]/60 transition-colors shadow-sm dark:shadow-none"
              >
                <button
                  type="button"
                  onClick={() => onSelectClip(clip.id)}
                  className="w-full text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]"
                >
                  <div className="relative aspect-[9/14] bg-zinc-200 dark:bg-[#0F111A] overflow-hidden">
                    <ClipThumbnail
                      clip={clip}
                      className="group-hover:scale-105 transition-transform duration-300"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"
                    />
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[#0F111A]/65 backdrop-blur-sm flex items-center justify-center text-white opacity-90 group-hover:bg-[#6C5CE7] transition-colors">
                      <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
                      <p className="text-xs text-zinc-100 line-clamp-2 leading-snug">
                        {clip.caption}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                        <span className="truncate capitalize">
                          {CATEGORY_TITLES[clip.category as ClipCategory] || clip.category}
                        </span>
                        <span className="inline-flex items-center gap-2 font-mono tabular-nums shrink-0">
                          {(clip.replaysCount || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-zinc-200">
                              <Repeat className="w-3 h-3 text-[#00B4D8]" />
                              {formatCompactCount(clip.replaysCount || 0)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Heart className="w-3 h-3 text-[#6C5CE7]" />
                            {formatCompactCount(likesTotal)}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-2.5 flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <AvatarImg
                        src={clip.authorAvatarUrl}
                        alt={clip.authorDisplayName}
                        fallbackText={clip.authorDisplayName}
                        sizeClass="w-6 h-6"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {clip.authorDisplayName}
                      </span>
                      {(clip.authorVerified || verifiedUserIds?.has(clip.authorId)) && (
                        <VerifiedBadge size={16} />
                      )}
                    </div>
                    {followersTotal >= 2000 && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-[#00B4D8] shrink-0 tabular-nums">
                        <Users className="w-3 h-3" />
                        {formatCompactCount(followersTotal)}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetClip(clip);
                  }}
                  aria-label="Opciones del video"
                  className="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-[#0F111A]/65 hover:bg-[#0F111A]/90 backdrop-blur-sm border border-white/15 flex items-center justify-center text-white cursor-pointer"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Options Sheet (⋮) */}
      {sheetClip && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Opciones del video"
          onClick={() => setSheetClip(null)}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white dark:bg-[#161926] border-t border-x border-zinc-200 dark:border-white/10 rounded-t-3xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-2"
          >
            <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto mb-2" />

            {onReportClip && (!currentUserUid || sheetClip.authorId !== currentUserUid) && (
              <button
                type="button"
                onClick={() => {
                  const target = sheetClip;
                  setSheetClip(null);
                  onReportClip(target);
                }}
                className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-100 dark:bg-[#131622] hover:bg-zinc-200 dark:hover:bg-white/10 text-left text-sm font-semibold text-[#E84393] flex items-center gap-3 cursor-pointer"
              >
                <Flag className="w-4 h-4 shrink-0" />
                Reportar video
              </button>
            )}

            {onNotInterestedClip && (
              <button
                type="button"
                onClick={() => {
                  const id = sheetClip.id;
                  setSheetClip(null);
                  onNotInterestedClip(id);
                }}
                className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-100 dark:bg-[#131622] hover:bg-zinc-200 dark:hover:bg-white/10 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3 cursor-pointer"
              >
                <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
                No me interesa
              </button>
            )}

            {onCopyClipLink && (
              <button
                type="button"
                onClick={() => {
                  const target = sheetClip;
                  setSheetClip(null);
                  onCopyClipLink(target);
                }}
                className="w-full min-h-[48px] px-4 rounded-xl bg-zinc-100 dark:bg-[#131622] hover:bg-zinc-200 dark:hover:bg-white/10 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-3 cursor-pointer"
              >
                <Link2 className="w-4 h-4 text-[#00B4D8] shrink-0" />
                Copiar enlace
              </button>
            )}

            <button
              type="button"
              onClick={() => setSheetClip(null)}
              className="w-full min-h-[44px] rounded-xl text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
