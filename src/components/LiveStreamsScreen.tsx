import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Radio, Swords, Users } from 'lucide-react';
import { VISUAL_PRESETS } from '../data/starterClips';
import {
  DEFAULT_AUDIENCE_FAVORITES,
  DEFAULT_FAN_PERKS,
  resolveFanLevel,
} from '../lib/liveGifts';
import type {
  AudienceFavorite,
  AudioPreset,
  ClipCategory,
  ClipItem,
  CreatorSummary,
  FanClubPerk,
  LiveAudience,
  LiveQuality,
  LiveStreamRecord,
  LiveVisualEffect,
  UserProfile,
  VipAlertStyle,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import { LiveBattleScreen } from './LiveBattleScreen';
import { LiveViewerScreen } from './LiveViewerScreen';

export interface LiveStreamItem {
  streamId?: string;
  isFirestoreLive?: boolean;
  creator: CreatorSummary;
  streamTitle: string;
  about?: string;
  audience?: LiveAudience;
  quality?: LiveQuality;
  visualEffect?: LiveVisualEffect;
  category: ClipCategory;
  viewerCount: number;
  likesCount?: number;
  giftsCount?: number;
  previewImageUrl: string;
  videoUrl?: string;
  guestDisplayName?: string;
  guestStreamUrl?: string;
  fanPerks?: FanClubPerk[];
  audienceFavorites?: AudienceFavorite[];
  fanClubName?: string;
  fanPointsPerCoin?: number;
  vipAlertEnabled?: boolean;
  vipAlertTitle?: string;
  vipAlertStyle?: VipAlertStyle;
  vipAlertDurationSec?: number;
  vipAlertSound?: boolean;
  audioPreset: AudioPreset;
}

interface LiveStreamsScreenProps {
  isOpen: boolean;
  initialStreamUid?: string | null;
  currentUser: UserProfile | null;
  liveStreams: LiveStreamItem[];
  followingIds: Set<string>;
  onClose: () => void;
  onStartOwnLive: () => void;
  onToggleFollow: (targetId: string, targetUsername: string) => void;
  onSelectCreatorProfile: (authorId: string) => void;
  onRequestSignIn: () => void;
}

const LIVE_CATEGORY_FILTERS: { id: 'todos' | ClipCategory; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'baile', label: 'Baile' },
  { id: 'musica', label: 'Música' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'deportes', label: 'Deportes' },
  { id: 'arte', label: 'Arte' },
];

const STREAM_TITLES_BY_CATEGORY: Record<ClipCategory, string[]> = {
  general: ['Charlando en directo con la comunidad', 'Preguntas y respuestas en vivo'],
  baile: ['Ensayo freestyle en directo desde la plaza', 'Coreografía en vivo · Únete'],
  musica: ['Sesión en vivo con vinilos y beats', 'Mezclando música en directo'],
  cocina: ['Preparando espresso y recetas en vivo', 'Cocina rápida paso a paso'],
  deportes: ['Ruta y entrenamiento en directo', 'Reto deportivo en vivo'],
  arte: ['Creando música e ilustración en directo', 'Estudio abierto en vivo'],
  comedia: ['Reaccionando a klips de la comunidad', 'Charla nocturna y humor'],
  viajes: ['Recorriendo la ciudad en vivo', 'Atardecer en directo'],
};

export function buildLiveStreamsFromCreators(
  creators: CreatorSummary[],
  clips: ClipItem[],
  blockedIds: Set<string>,
  activeFirestoreStreams: LiveStreamRecord[] = [],
): LiveStreamItem[] {
  const seen = new Set<string>();
  const streams: LiveStreamItem[] = [];

  const creatorByUid = new Map(creators.map((c) => [c.uid, c]));

  // 1. Real Firestore active LIVE streams come first
  activeFirestoreStreams.forEach((record) => {
    if (blockedIds.has(record.hostUid) || seen.has(record.hostUid)) return;
    seen.add(record.hostUid);
    const knownCreator = creatorByUid.get(record.hostUid);
    streams.push({
      streamId: record.id,
      isFirestoreLive: true,
      creator: {
        uid: record.hostUid,
        username: record.hostUsername,
        displayName: record.hostDisplayName,
        bio: record.about || 'En vivo en Viroklipz.',
        avatarUrl: record.hostAvatarUrl,
        followersLabel: knownCreator?.followersLabel || '',
        fanLevel: knownCreator?.fanLevel ?? 1,
      },
      streamTitle: record.title,
      about: record.about,
      audience: record.audience,
      quality: record.quality,
      visualEffect: record.visualEffect,
      category: record.category,
      viewerCount: record.viewerCount,
      likesCount: record.likesCount,
      giftsCount: record.giftsCount,
      previewImageUrl:
        record.previewImageUrl ||
        record.hostAvatarUrl ||
        VISUAL_PRESETS[0].imageUrl,
      videoUrl: record.streamUrl || undefined,
      guestDisplayName: record.guestDisplayName,
      guestStreamUrl: record.guestStreamUrl || undefined,
      fanPerks: record.fanPerks?.length ? record.fanPerks : DEFAULT_FAN_PERKS,
      audienceFavorites: record.audienceFavorites?.length
        ? record.audienceFavorites
        : DEFAULT_AUDIENCE_FAVORITES,
      fanClubName: record.fanClubName,
      fanPointsPerCoin: record.fanPointsPerCoin,
      vipAlertEnabled: record.vipAlertEnabled,
      vipAlertTitle: record.vipAlertTitle,
      vipAlertStyle: record.vipAlertStyle,
      vipAlertDurationSec: record.vipAlertDurationSec,
      vipAlertSound: record.vipAlertSound,
      audioPreset: record.audioPreset,
    });
  });

  // 2. Showcase live streams for creators not already in activeFirestoreStreams
  const activeCreators = creators.filter((c) => !blockedIds.has(c.uid));
  activeCreators.forEach((creator, idx) => {
    if (seen.has(creator.uid)) return;
    seen.add(creator.uid);

    const creatorClips = clips.filter((c) => c.authorId === creator.uid);
    const leadClip = creatorClips[0];
    const category: ClipCategory = leadClip?.category || 'general';
    const titleOptions = STREAM_TITLES_BY_CATEGORY[category] || STREAM_TITLES_BY_CATEGORY.general;
    const presetFallback = VISUAL_PRESETS[idx % VISUAL_PRESETS.length];

    const baseViewers = [184, 312, 96, 64, 148, 225];
    const viewerCount = baseViewers[idx % baseViewers.length] + ((idx * 17) % 43);

    streams.push({
      isFirestoreLive: false,
      creator,
      streamTitle:
        leadClip?.caption
          ? leadClip.caption.slice(0, 64)
          : titleOptions[idx % titleOptions.length],
      about: creator.bio,
      audience: 'public',
      quality: '1080p',
      visualEffect: 'none',
      category,
      viewerCount,
      likesCount: viewerCount * 3,
      giftsCount: Math.max(1, Math.floor(viewerCount / 28)),
      previewImageUrl: leadClip?.visualPreset || presetFallback.imageUrl,
      videoUrl: leadClip?.videoUrl,
      fanPerks: DEFAULT_FAN_PERKS,
      audienceFavorites: DEFAULT_AUDIENCE_FAVORITES,
      audioPreset: leadClip?.audioPreset || 'urban_beat',
    });
  });

  return streams.slice(0, 12);
}

export function LiveStreamsScreen({
  isOpen,
  initialStreamUid = null,
  currentUser,
  liveStreams,
  followingIds,
  onClose,
  onStartOwnLive,
  onToggleFollow,
  onSelectCreatorProfile,
  onRequestSignIn,
}: LiveStreamsScreenProps) {
  const [categoryFilter, setCategoryFilter] = useState<'todos' | ClipCategory>('todos');
  const [activeStreamUid, setActiveStreamUid] = useState<string | null>(null);
  const [isBattleOpen, setIsBattleOpen] = useState(false);

  const filteredStreams = useMemo(() => {
    if (categoryFilter === 'todos') return liveStreams;
    return liveStreams.filter((s) => s.category === categoryFilter);
  }, [liveStreams, categoryFilter]);

  const activeStream = useMemo(() => {
    if (!activeStreamUid) return null;
    return liveStreams.find((s) => s.creator.uid === activeStreamUid) || null;
  }, [liveStreams, activeStreamUid]);

  const activeStreamIndex = useMemo(() => {
    if (!activeStream) return -1;
    return liveStreams.findIndex((s) => s.creator.uid === activeStream.creator.uid);
  }, [liveStreams, activeStream]);

  const opponentStream = useMemo(() => {
    if (!activeStream || liveStreams.length <= 1) return null;
    const nextIdx = (activeStreamIndex + 1) % liveStreams.length;
    return liveStreams[nextIdx] || null;
  }, [activeStream, activeStreamIndex, liveStreams]);

  useEffect(() => {
    if (isOpen && initialStreamUid) {
      setActiveStreamUid(initialStreamUid);
    }
  }, [isOpen, initialStreamUid]);

  useEffect(() => {
    if (!isOpen) {
      setActiveStreamUid(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const goToAdjacentLive = (delta: -1 | 1) => {
    if (liveStreams.length <= 1 || activeStreamIndex < 0) return;
    const nextIdx = (activeStreamIndex + delta + liveStreams.length) % liveStreams.length;
    setActiveStreamUid(liveStreams[nextIdx].creator.uid);
  };

  if (activeStream) {
    return (
      <LiveViewerScreen
        stream={activeStream}
        opponentStream={opponentStream}
        streamsCount={liveStreams.length}
        currentUser={currentUser}
        followingIds={followingIds}
        onClose={() => {
          setActiveStreamUid(null);
          onClose();
        }}
        onBackToList={() => setActiveStreamUid(null)}
        onNextStream={() => goToAdjacentLive(1)}
        onToggleFollow={onToggleFollow}
        onSelectCreatorProfile={onSelectCreatorProfile}
        onRequestSignIn={onRequestSignIn}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-[#090B12] text-white flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Creadores en vivo"
    >
      {/* Top Header */}
      <header className="min-h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 border-b border-white/10 bg-[#101322] flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Volver a Inicio"
          className="min-h-[44px] min-w-[44px] -ml-2 flex items-center justify-center rounded-full text-zinc-200 hover:text-white hover:bg-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00B4D8] animate-pulse shrink-0" />
          <h1 className="font-display text-base sm:text-lg font-bold text-white truncate">
            En vivo
          </h1>
          <span className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
            · {liveStreams.length} {liveStreams.length === 1 ? 'creador' : 'creadores'}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {liveStreams.length >= 2 && (
            <button
              type="button"
              onClick={() => setIsBattleOpen(true)}
              className="min-h-[38px] px-3 rounded-xl bg-[#181B2E] hover:bg-[#232742] border border-[#E84393]/55 text-white text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_16px_rgba(232,67,147,0.3)]"
            >
              <Swords className="w-3.5 h-3.5 text-[#E84393]" />
              <span>ViroArena PK</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onStartOwnLive();
            }}
            className="min-h-[38px] px-3.5 rounded-xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow"
          >
            <Radio className="w-3.5 h-3.5" />
            Transmitir
          </button>
        </div>
      </header>

      {/* Category Filter Strip */}
      <div className="px-4 py-2.5 border-b border-white/10 bg-[#101322]/70 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
        {LIVE_CATEGORY_FILTERS.map((cat) => {
          const active = categoryFilter === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`min-h-[34px] px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white shadow'
                  : 'bg-white/8 text-zinc-300 hover:text-white hover:bg-white/15'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Grid of Live Creators */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {filteredStreams.length === 0 ? (
          <div className="h-full min-h-[50dvh] flex flex-col items-center justify-center text-center p-6 space-y-3">
            <Users className="w-10 h-10 text-zinc-500" />
            <p className="text-sm font-semibold text-white">
              No hay creadores en vivo en esta categoría ahora mismo
            </p>
            <button
              type="button"
              onClick={() => setCategoryFilter('todos')}
              className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white cursor-pointer"
            >
              Ver todos los en vivo
            </button>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {filteredStreams.map((stream) => (
              <button
                key={stream.creator.uid}
                type="button"
                onClick={() => setActiveStreamUid(stream.creator.uid)}
                className="group relative aspect-[9/14] w-full rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 hover:border-[#00B4D8]/80 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B4D8]"
              >
                {stream.videoUrl ? (
                  <video
                    src={stream.videoUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <img
                    src={stream.previewImageUrl}
                    alt={stream.streamTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#080A12]/70 via-[#080A12]/15 to-[#080A12]/90"
                />

                {/* Top LIVE Badge & Viewer Count */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-lg bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white text-[10px] font-extrabold tracking-wide uppercase">
                    LIVE
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold tabular-nums inline-flex items-center gap-1">
                    <Eye className="w-3 h-3 text-[#00B4D8]" />
                    {stream.viewerCount}
                  </span>
                </div>

                {/* Center CTA */}
                <div className="absolute inset-0 flex items-center justify-center px-2 pointer-events-none">
                  <span className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00B4D8]/90 via-[#6C5CE7]/90 to-[#E84393]/90 text-white text-[11px] font-bold shadow-lg text-center transition-transform group-hover:scale-105">
                    Entrar al Live
                  </span>
                </div>

                {/* Bottom Creator Info */}
                <div className="absolute bottom-2.5 inset-x-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] shrink-0">
                      <AvatarImg
                        src={stream.creator.avatarUrl}
                        alt={stream.creator.displayName}
                        fallbackText={stream.creator.displayName}
                        sizeClass="w-8 h-8"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          @{stream.creator.username}
                        </p>
                        <FanLevelBadge
                          level={resolveFanLevel(stream.creator.fanLevel)}
                          compact
                        />
                      </div>
                      <p className="text-[10px] text-white/75 truncate">
                        {stream.creator.displayName}
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-white/85 line-clamp-1 leading-snug">
                    {stream.streamTitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {liveStreams.length >= 2 && (
        <LiveBattleScreen
          isOpen={isBattleOpen}
          hostStreamId={liveStreams[0].streamId}
          creator1={{
            uid: liveStreams[0].creator.uid,
            username: liveStreams[0].creator.username,
            displayName: liveStreams[0].creator.displayName,
            avatarUrl: liveStreams[0].creator.avatarUrl,
            previewUrl: liveStreams[0].previewImageUrl,
            streamUrl: liveStreams[0].videoUrl,
          }}
          creator2={{
            uid: liveStreams[1].creator.uid,
            username: liveStreams[1].creator.username,
            displayName: liveStreams[1].creator.displayName,
            avatarUrl: liveStreams[1].creator.avatarUrl,
            previewUrl: liveStreams[1].previewImageUrl,
            streamUrl: liveStreams[1].videoUrl,
          }}
          currentUser={currentUser}
          onClose={() => setIsBattleOpen(false)}
          onRequestSignIn={onRequestSignIn}
        />
      )}
    </div>
  );
}
