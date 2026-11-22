import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Bookmark,
  Check,
  Film,
  Flag,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Share2,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import { getClipMediaBlob } from '../lib/mediaStorage';
import { formatCompactCount } from '../lib/validation';
import type { ClipItem } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';

interface ClipPlayerProps {
  clip: ClipItem;
  isActive: boolean;
  isMuted: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
  isOwnClip: boolean;
  dataSaver?: boolean;
  commentsCount: number;
  onToggleMute: () => void;
  onToggleLike: (forceLike?: boolean) => void;
  onToggleBookmark: () => void;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onSelectCreator: (authorId: string) => void;
  onDeleteClip?: () => void;
  onReport?: () => void;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function ClipPlayer({
  clip,
  isActive,
  isMuted,
  isLiked,
  isBookmarked,
  isFollowing,
  isOwnClip,
  dataSaver = false,
  commentsCount,
  onToggleMute,
  onToggleLike,
  onToggleBookmark,
  onToggleFollow,
  onOpenComments,
  onShare,
  onSelectCreator,
  onDeleteClip,
  onReport,
}: ClipPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [progressSec, setProgressSec] = useState(0);
  const [durationSec, setDurationSec] = useState(clip.durationSec || 15);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [playIndicator, setPlayIndicator] = useState<'play' | 'pause' | null>(null);
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([]);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimerRef = useRef<number | null>(null);

  // Load real video blob from IndexedDB if user recorded/uploaded it on this device
  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    if (!clip.hasLocalMedia || clip.videoUrl) {
      setLocalVideoUrl(null);
      return;
    }

    void getClipMediaBlob(clip.id).then((blob) => {
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      revokedUrl = url;
      setLocalVideoUrl(url);
    });

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [clip.id, clip.hasLocalMedia, clip.videoUrl]);

  const videoSrc = clip.videoUrl || localVideoUrl;

  // Reset playback state when active state changes
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
    } else {
      setProgressSec(0);
    }
  }, [isActive]);

  // Sync HTML5 video element
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = isMuted;
    if (isActive && isPlaying) {
      void vid.play().catch(() => {
        // Autoplay restriction fallback
      });
    } else {
      vid.pause();
    }
  }, [isActive, isPlaying, isMuted, videoSrc]);

  // Sync Web Audio procedural synthesizer when active + playing + unmuted + no video stream
  useEffect(() => {
    if (isActive && isPlaying && !isMuted && !videoSrc) {
      audioEngine.start(clip.audioPreset);
    } else if (isActive) {
      audioEngine.stop();
    }
    return () => {
      if (isActive) {
        audioEngine.stop();
      }
    };
  }, [isActive, isPlaying, isMuted, videoSrc, clip.audioPreset]);

  // Timer loop for visual motion clips without <video>
  useEffect(() => {
    if (!isActive || !isPlaying || videoSrc) return;
    const interval = window.setInterval(() => {
      setProgressSec((prev) => {
        const next = prev + 0.1;
        return next >= durationSec ? 0 : next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [isActive, isPlaying, videoSrc, durationSec]);

  const showTransientPlayState = (state: 'play' | 'pause') => {
    setPlayIndicator(state);
    window.setTimeout(() => {
      setPlayIndicator((curr) => (curr === state ? null : curr));
    }, 520);
  };

  const handleStageTap = (e: MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 280) {
      // Double tap -> heart explosion
      if (tapTimerRef.current) {
        window.clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      lastTapRef.current = 0;
      const burstId = Date.now() + Math.random();
      setHeartBursts((prev) => [...prev, { id: burstId, x, y }]);
      window.setTimeout(() => {
        setHeartBursts((prev) => prev.filter((b) => b.id !== burstId));
      }, 700);
      if (!isLiked) {
        onToggleLike(true);
      }
      return;
    }

    lastTapRef.current = now;
    tapTimerRef.current = window.setTimeout(() => {
      setIsPlaying((prev) => {
        const next = !prev;
        showTransientPlayState(next ? 'play' : 'pause');
        return next;
      });
      tapTimerRef.current = null;
    }, 240);
  };

  const handleScrub = (nextSec: number) => {
    setProgressSec(nextSec);
    if (videoRef.current) {
      videoRef.current.currentTime = nextSec;
    }
  };

  const progressPct = durationSec > 0 ? Math.min(100, (progressSec / durationSec) * 100) : 0;
  const displayLikes = clip.likesCount + (clip.isStarter && isLiked ? 1 : 0);

  return (
    <div className="relative w-full h-full bg-[#121216] overflow-hidden select-none lg:rounded-2xl lg:border lg:border-white/10">
      {/* Media Stage */}
      <div
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? 'Pausar klip' : 'Reproducir klip'}
        onClick={handleStageTap}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setIsPlaying((p) => !p);
          }
        }}
        className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B5C]"
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            loop
            playsInline
            preload={dataSaver ? 'metadata' : 'auto'}
            muted={isMuted}
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration;
              if (Number.isFinite(d) && d > 0) {
                setDurationSec(d);
              }
            }}
            onTimeUpdate={(e) => {
              setProgressSec(e.currentTarget.currentTime);
            }}
            className="w-full h-full object-cover"
          />
        ) : !imgFailed && clip.visualPreset ? (
          <img
            src={clip.visualPreset}
            alt={clip.caption}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className={`w-full h-full object-cover ${
              dataSaver
                ? ''
                : `animate-ken-burns ${isActive && isPlaying ? '' : 'animate-ken-burns-paused'}`
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-[#1b141a] to-zinc-950 flex flex-col items-center justify-center p-8 text-center gap-3">
            <Film className="w-10 h-10 text-zinc-500" />
            <p className="text-sm text-zinc-400 max-w-xs">{clip.caption}</p>
          </div>
        )}

        {/* Measured Contrast Scrim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/25 to-black/35"
        />

        {/* Paused Dimmer & Center Indicator */}
        {(!isPlaying || playIndicator) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-black/55 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-transform duration-150">
              {playIndicator === 'play' || isPlaying ? (
                <Play className="w-7 h-7 fill-white translate-x-0.5" />
              ) : (
                <Pause className="w-7 h-7 fill-white" />
              )}
            </div>
          </div>
        )}

        {/* Double-tap Heart Explosions */}
        {heartBursts.map((burst) => (
          <div
            key={burst.id}
            style={{ left: burst.x, top: burst.y }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 animate-ping"
          >
            <Heart className="w-16 h-16 text-[#FF3B5C] fill-[#FF3B5C] drop-shadow-lg" />
          </div>
        ))}
      </div>

      {/* Top Controls Overlay (Category + Sound + Delete own clip) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-center justify-between z-20">
        <span className="text-xs font-medium text-white/80 tracking-wide capitalize drop-shadow">
          {clip.category}
          {clip.viewsLabel ? ` · ${clip.viewsLabel} vistas` : ''}
          {clip.visibility === 'private' ? ' · Privado' : ''}
          {dataSaver ? ' · Ahorro de datos' : ''}
        </span>

        <div className="pointer-events-auto flex items-center gap-2">
          {isOwnClip && onDeleteClip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClip();
              }}
              aria-label="Eliminar klip"
              title="Eliminar klip"
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-zinc-200 hover:text-[#FF3B5C] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute();
            }}
            aria-label={isMuted ? 'Activar sonido' : 'Silenciar sonido'}
            className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Right Action Rail (44px+ touch targets) */}
      <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-4">
        {/* Creator Avatar + Follow */}
        <div className="relative flex flex-col items-center mb-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCreator(clip.authorId);
            }}
            aria-label={`Ver perfil de ${clip.authorDisplayName}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B5C]"
          >
            <AvatarImg
              src={clip.authorAvatarUrl}
              alt={clip.authorDisplayName}
              fallbackText={clip.authorDisplayName}
              sizeClass="w-11 h-11"
            />
          </button>
          {!isOwnClip && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow();
              }}
              aria-label={isFollowing ? 'Dejar de seguir' : 'Seguir creador'}
              className={`-mt-3 w-6 h-6 rounded-full flex items-center justify-center border border-[#09090B] transition-colors cursor-pointer ${
                isFollowing
                  ? 'bg-zinc-800 text-white'
                  : 'bg-[#FF3B5C] hover:bg-[#ff264b] text-white'
              }`}
            >
              {isFollowing ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Like */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          aria-label={isLiked ? 'Quitar me gusta' : 'Dar me gusta'}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-active:scale-90 transition-transform">
            <Heart
              className={`w-6 h-6 transition-colors ${
                isLiked ? 'text-[#FF3B5C] fill-[#FF3B5C]' : 'text-white'
              }`}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-white/95 drop-shadow">
            {formatCompactCount(displayLikes)}
          </span>
        </button>

        {/* Comments */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments();
          }}
          aria-label="Abrir comentarios"
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-active:scale-90 transition-transform">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="font-mono text-xs tabular-nums text-white/95 drop-shadow">
            {formatCompactCount(commentsCount)}
          </span>
        </button>

        {/* Bookmark */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleBookmark();
          }}
          aria-label={isBookmarked ? 'Quitar de guardados' : 'Guardar klip'}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-active:scale-90 transition-transform">
            <Bookmark
              className={`w-5 h-5 transition-colors ${
                isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-white'
              }`}
            />
          </div>
          <span className="text-[11px] text-white/90 drop-shadow">
            {isBookmarked ? 'Guardado' : 'Guardar'}
          </span>
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          aria-label="Compartir klip"
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center group-active:scale-90 transition-transform">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-mono text-xs tabular-nums text-white/95 drop-shadow">
            {formatCompactCount(clip.sharesCount)}
          </span>
        </button>

        {/* Report / Block */}
        {!isOwnClip && onReport && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReport();
            }}
            aria-label="Reportar o bloquear"
            title="Reportar o bloquear"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-white/80 hover:text-[#FF3B5C] cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center">
              <Flag className="w-4 h-4" />
            </div>
          </button>
        )}

        {/* Spinning Audio Disc */}
        <div
          aria-hidden="true"
          className={`mt-1 w-9 h-9 rounded-full bg-zinc-900 border-2 border-white/25 flex items-center justify-center overflow-hidden animate-vinyl-spin ${
            isActive && isPlaying ? '' : 'animate-vinyl-paused'
          }`}
        >
          <Music2 className="w-4 h-4 text-zinc-200" />
        </div>
      </div>

      {/* Bottom Creator & Caption Overlay */}
      <div className="pointer-events-none absolute left-4 right-20 bottom-5 z-20 space-y-1.5">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCreator(clip.authorId);
            }}
            className="text-left font-display font-bold text-base text-white hover:underline cursor-pointer"
          >
            @{clip.authorUsername}
          </button>
          <span className="text-xs text-white/75 truncate">{clip.authorDisplayName}</span>
        </div>

        <p className="text-sm text-zinc-100 leading-snug line-clamp-3 drop-shadow">
          {clip.caption}
        </p>

        {clip.hashtags.length > 0 && (
          <p className="text-xs text-zinc-300/90 leading-relaxed truncate">
            {clip.hashtags.map((tag, idx) => (
              <span key={tag}>
                {idx > 0 && <span className="mx-1.5 text-zinc-500">·</span>}
                <span className="font-medium text-white/90">#{tag}</span>
              </span>
            ))}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-zinc-200/90 pt-0.5">
          <Music2 className="w-3.5 h-3.5 shrink-0 text-[#FF3B5C]" />
          <span className="truncate">{clip.audioTitle}</span>
        </div>
      </div>

      {/* Subtle Bottom Progress Bar (seconds counter hidden unless scrubbing/hovering) */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="group/progress absolute bottom-0 left-0 right-0 z-30 pt-3"
      >
        <div
          className={`px-3 pb-1 flex justify-end transition-opacity duration-150 pointer-events-none ${
            isScrubbing ? 'opacity-100' : 'opacity-0 group-hover/progress:opacity-100'
          }`}
        >
          <span className="font-mono text-[10px] tabular-nums text-white/80 bg-black/55 px-1.5 py-0.5 rounded">
            {formatSeconds(progressSec)} / {formatSeconds(durationSec)}
          </span>
        </div>

        <div className="relative h-[3px] group-hover/progress:h-1.5 transition-all bg-white/20">
          <div
            style={{ width: `${progressPct}%` }}
            className="h-full bg-[#FF3B5C] transition-[width] duration-100"
          />
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.1}
            value={progressSec}
            onPointerDown={() => setIsScrubbing(true)}
            onPointerUp={() => setIsScrubbing(false)}
            onPointerCancel={() => setIsScrubbing(false)}
            onBlur={() => setIsScrubbing(false)}
            onChange={(e) => handleScrub(Number(e.target.value))}
            aria-label="Progreso del klip"
            className="absolute inset-0 -top-2 w-full h-5 opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
