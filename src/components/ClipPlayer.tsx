import { useEffect, useRef, useState, type MouseEvent } from 'react';
import {
  Bookmark,
  Check,
  Film,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Share2,
} from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import { getClipMediaBlob } from '../lib/mediaStorage';
import type { ClipItem } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { VerifiedBadge } from './VerifiedBadge';

interface ClipPlayerProps {
  clip: ClipItem;
  isActive: boolean;
  isLiked: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
  isOwnClip: boolean;
  authorVerified?: boolean;
  dataSaver?: boolean;
  onToggleLike: (forceLike?: boolean) => void;
  onToggleBookmark: () => void;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onShare: () => void;
  onReplay?: () => void;
  onSelectCreator: (authorId: string) => void;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
}

export function ClipPlayer({
  clip,
  isActive,
  isLiked,
  isBookmarked,
  isFollowing,
  isOwnClip,
  authorVerified,
  dataSaver = false,
  onToggleLike,
  onToggleBookmark,
  onToggleFollow,
  onOpenComments,
  onShare,
  onReplay,
  onSelectCreator,
}: ClipPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [localMediaIsImage, setLocalMediaIsImage] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [playIndicator, setPlayIndicator] = useState<'play' | 'pause' | null>(null);
  const [heartBursts, setHeartBursts] = useState<HeartBurst[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimerRef = useRef<number | null>(null);
  const prevVideoTimeRef = useRef<number>(0);
  const replayReportedRef = useRef<boolean>(false);

  // Load real media blob from IndexedDB if user recorded/uploaded it on this device
  useEffect(() => {
    let revokedUrl: string | null = null;
    let cancelled = false;

    if (!clip.hasLocalMedia || clip.videoUrl) {
      setLocalVideoUrl(null);
      setLocalMediaIsImage(false);
      return;
    }

    void getClipMediaBlob(clip.id).then((blob) => {
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      revokedUrl = url;
      setLocalMediaIsImage(blob.type.startsWith('image/'));
      setLocalVideoUrl(url);
    });

    return () => {
      cancelled = true;
      if (revokedUrl) {
        URL.revokeObjectURL(revokedUrl);
      }
    };
  }, [clip.id, clip.hasLocalMedia, clip.videoUrl]);

  const rawMediaSrc = clip.videoUrl || localVideoUrl;
  const isImageMedia = Boolean(
    rawMediaSrc &&
      (localMediaIsImage || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(rawMediaSrc)),
  );
  const videoSrc = isImageMedia ? null : rawMediaSrc;
  const imageSrc = isImageMedia ? rawMediaSrc : clip.visualPreset;

  // Reset playback state when active state or clip changes
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
    }
  }, [isActive]);

  useEffect(() => {
    prevVideoTimeRef.current = 0;
    replayReportedRef.current = false;
  }, [clip.id]);

  // Sync HTML5 video element with sound ON by default (and graceful autoplay gesture fallback)
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    let unlockListener: (() => void) | null = null;

    if (isActive && isPlaying) {
      vid.muted = false;
      vid.volume = 1;
      void vid.play().catch(() => {
        // Browser blocked unmuted autoplay prior to first user gesture: start muted and unmute on first interaction
        vid.muted = true;
        vid.volume = 0;
        void vid.play().catch(() => {});

        unlockListener = () => {
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = 1;
          }
          if (unlockListener) {
            window.removeEventListener('pointerdown', unlockListener);
            unlockListener = null;
          }
        };
        window.addEventListener('pointerdown', unlockListener, { once: true });
      });
    } else {
      vid.pause();
    }

    return () => {
      if (unlockListener) {
        window.removeEventListener('pointerdown', unlockListener);
      }
    };
  }, [isActive, isPlaying, videoSrc]);

  // Sync Web Audio procedural synthesizer when active + playing + no video stream (sound ON by default)
  useEffect(() => {
    if (isActive && isPlaying && !videoSrc && clip.audioPreset) {
      audioEngine.start(clip.audioPreset);
    } else if (isActive) {
      audioEngine.stop();
    }
    return () => {
      if (isActive) {
        audioEngine.stop();
      }
    };
  }, [isActive, isPlaying, videoSrc, clip.audioPreset]);

  // Detect repeat/loop completion for non-video fallback clips
  useEffect(() => {
    if (videoSrc || !isActive || !isPlaying || replayReportedRef.current) return;
    const loopMs = Math.max(3, clip.durationSec || 12) * 1000;
    const timer = window.setTimeout(() => {
      if (!replayReportedRef.current) {
        replayReportedRef.current = true;
        onReplay?.();
      }
    }, loopMs);
    return () => window.clearTimeout(timer);
  }, [videoSrc, isActive, isPlaying, clip.durationSec, onReplay]);

  const showTransientPlayState = (state: 'play' | 'pause') => {
    setPlayIndicator(state);
    window.setTimeout(() => {
      setPlayIndicator((curr) => (curr === state ? null : curr));
    }, 520);
  };

  const handleStageTap = (e: MouseEvent<HTMLDivElement>) => {
    if (videoRef.current && videoRef.current.muted) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1;
    }

    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (now - lastTapRef.current < 280) {
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

  return (
    <div className="relative w-full h-full bg-[#0F111A] overflow-hidden select-none lg:rounded-2xl lg:border lg:border-white/10">
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
        className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]"
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            loop
            playsInline
            preload={dataSaver ? 'metadata' : 'auto'}
            onLoadedMetadata={(e) => {
              e.currentTarget.muted = false;
              e.currentTarget.volume = 1;
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              const dur = e.currentTarget.duration;
              if (
                isActive &&
                isPlaying &&
                Number.isFinite(dur) &&
                dur > 1 &&
                prevVideoTimeRef.current > dur * 0.7 &&
                t < 0.8 &&
                !replayReportedRef.current
              ) {
                replayReportedRef.current = true;
                onReplay?.();
              }
              prevVideoTimeRef.current = t;
            }}
            className="w-full h-full object-cover"
          />
        ) : !imgFailed && imageSrc ? (
          <img
            src={imageSrc}
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
          <div className="w-full h-full bg-gradient-to-br from-[#0F111A] via-[#161926] to-[#0F111A] flex flex-col items-center justify-center p-8 text-center gap-3">
            <Film className="w-10 h-10 text-zinc-500" />
            <p className="text-sm text-zinc-400 max-w-xs">{clip.caption}</p>
          </div>
        )}

        {/* Measured Contrast Scrim */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/88 via-black/20 to-black/35"
        />

        {/* Paused Dimmer & Center Indicator */}
        {(!isPlaying || playIndicator) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#0F111A]/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white transition-transform duration-150">
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
            <Heart className="w-16 h-16 text-[#E84393] fill-[#E84393] drop-shadow-lg" />
          </div>
        ))}
      </div>

      {/* Right Action Rail (Creator Avatar 48x48 + red + badge at top, then 4 action icons + disc, gap-5) */}
      <div className="pointer-events-none absolute right-3.5 top-20 bottom-3.5 lg:bottom-4 z-20 flex flex-col items-end justify-end">
        <div className="pointer-events-auto flex flex-col items-center justify-end gap-5 max-h-full overflow-y-auto no-scrollbar py-1">
          {/* Creator Avatar + Overlapping Red Follow (+) Badge on all videos */}
          <div className="relative shrink-0 pb-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCreator(clip.authorId);
              }}
              aria-label={`Ver perfil de ${clip.authorDisplayName}`}
              className="block rounded-full ring-2 ring-white/85 shadow-lg cursor-pointer"
            >
              <AvatarImg
                src={clip.authorAvatarUrl}
                alt={clip.authorDisplayName}
                fallbackText={clip.authorDisplayName}
                sizeClass="w-12 h-12"
              />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFollow();
              }}
              aria-label={
                isOwnClip
                  ? `Seguir a ${clip.authorDisplayName}`
                  : isFollowing
                    ? `Dejar de seguir a ${clip.authorDisplayName}`
                    : `Seguir a ${clip.authorDisplayName}`
              }
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-[#0F111A] flex items-center justify-center text-white shadow-md transition-transform active:scale-90 cursor-pointer ${
                !isOwnClip && isFollowing ? 'bg-[#6C5CE7]' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {!isOwnClip && isFollowing ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : (
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
              )}
            </button>
          </div>

          {/* Like */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike();
            }}
            aria-label={isLiked ? 'Quitar me gusta' : 'Dar me gusta'}
            className="shrink-0 w-12 h-12 rounded-full bg-[#0F111A]/50 hover:bg-[#0F111A]/75 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Heart
              className={`w-7 h-7 transition-colors ${
                isLiked ? 'text-[#E84393] fill-[#E84393]' : 'text-white'
              }`}
            />
          </button>

          {/* Comments */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments();
            }}
            aria-label="Abrir comentarios"
            className="shrink-0 w-12 h-12 rounded-full bg-[#0F111A]/50 hover:bg-[#0F111A]/75 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <MessageCircle className="w-7 h-7 text-white" />
          </button>

          {/* Bookmark */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark();
            }}
            aria-label={isBookmarked ? 'Quitar de guardados' : 'Guardar klip'}
            className="shrink-0 w-12 h-12 rounded-full bg-[#0F111A]/50 hover:bg-[#0F111A]/75 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Bookmark
              className={`w-7 h-7 transition-colors ${
                isBookmarked ? 'text-[#00B4D8] fill-[#00B4D8]' : 'text-white'
              }`}
            />
          </button>

          {/* Share */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            aria-label="Compartir klip"
            className="shrink-0 w-12 h-12 rounded-full bg-[#0F111A]/50 hover:bg-[#0F111A]/75 backdrop-blur-md border border-white/15 flex items-center justify-center active:scale-90 transition-all cursor-pointer"
          >
            <Share2 className="w-7 h-7 text-white" />
          </button>

          {/* Subtle small Spinning Music Disc */}
          <div
            aria-hidden="true"
            className={`shrink-0 w-7 h-7 rounded-full bg-[#0F111A]/65 border border-white/20 flex items-center justify-center overflow-hidden animate-vinyl-spin ${
              isActive && isPlaying ? '' : 'animate-vinyl-paused'
            }`}
          >
            <Music2 className="w-3.5 h-3.5 text-[#00B4D8]/90" />
          </div>
        </div>
      </div>

      {/* Bottom Creator & Caption Overlay (only displayName on videos; @username is shown on Profile) */}
      <div className="pointer-events-none absolute left-3.5 right-20 bottom-3 lg:bottom-3.5 z-20 space-y-1">
        <div className="pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCreator(clip.authorId);
            }}
            className="text-left font-display font-bold text-sm text-white hover:underline inline-flex items-center gap-1.5 min-w-0 max-w-full cursor-pointer"
          >
            <span className="truncate">{clip.authorDisplayName}</span>
            {(authorVerified ?? Boolean(clip.authorVerified)) && <VerifiedBadge size={16} />}
          </button>
        </div>

        {clip.caption && (
          <p className="text-xs text-zinc-100 leading-snug line-clamp-2 drop-shadow">
            {clip.caption}
          </p>
        )}

        {clip.hashtags.length > 0 && (
          <p className="text-[11px] text-zinc-300/90 leading-tight truncate">
            {clip.hashtags.map((tag, idx) => (
              <span key={tag}>
                {idx > 0 && <span className="mx-1 text-zinc-500">·</span>}
                <span className="font-medium text-white/90">#{tag}</span>
              </span>
            ))}
          </p>
        )}

        {(clip.audioTitle || clip.audioPreset) && (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-200/90">
            <Music2 className="w-3 h-3 shrink-0 text-[#00B4D8]" />
            <span className="truncate">{clip.audioTitle || clip.audioPreset}</span>
          </div>
        )}
      </div>

    </div>
  );
}
