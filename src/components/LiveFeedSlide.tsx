import { useEffect, useRef } from 'react';
import { Eye, Radio } from 'lucide-react';
import type { LiveStreamItem } from './LiveStreamsScreen';
import { AvatarImg } from './AvatarImg';

interface LiveFeedSlideProps {
  stream: LiveStreamItem;
  isActive: boolean;
  dataSaver?: boolean;
  onEnterLive: (stream: LiveStreamItem) => void;
  onSelectCreator: (authorId: string) => void;
}

export function LiveFeedSlide({
  stream,
  isActive,
  dataSaver = false,
  onEnterLive,
  onSelectCreator,
}: LiveFeedSlideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isActive) {
      vid.muted = true;
      void vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [isActive]);

  return (
    <div className="relative w-full h-full bg-[#0F111A] overflow-hidden select-none lg:rounded-2xl lg:border lg:border-white/10">
      {/* Full-bleed Live Preview Stage */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Entrar al LIVE de ${stream.creator.displayName}`}
        onClick={() => onEnterLive(stream)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onEnterLive(stream);
          }
        }}
        className="absolute inset-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FE2C55]"
      >
        {stream.videoUrl ? (
          <video
            ref={videoRef}
            src={stream.videoUrl}
            muted
            loop
            playsInline
            preload={dataSaver ? 'metadata' : 'auto'}
            className="w-full h-full object-cover"
          />
        ) : stream.previewImageUrl ? (
          <img
            src={stream.previewImageUrl}
            alt={stream.streamTitle}
            referrerPolicy="no-referrer"
            className={`w-full h-full object-cover ${
              dataSaver ? '' : `animate-ken-burns ${isActive ? '' : 'animate-ken-burns-paused'}`
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F111A] via-[#1B1528] to-[#0F111A] flex items-center justify-center">
            <Radio className="w-12 h-12 text-[#FE2C55]" />
          </div>
        )}

        {/* Top & Bottom Contrast Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 via-black/25 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/88 via-black/35 to-transparent"
        />

        {/* Top-left LIVE Badge & Viewer Count (matching Para ti LIVE layout) */}
        <div className="absolute top-[calc(3.75rem+env(safe-area-inset-top))] lg:top-4 left-3.5 z-20 flex items-center gap-2 pointer-events-none">
          <span className="px-2.5 py-1 rounded-md bg-[#FE2C55] text-white text-xs font-extrabold tracking-wide uppercase shadow-md">
            LIVE
          </span>
          <span className="px-2.5 py-1 rounded-md bg-black/55 backdrop-blur-md text-white text-xs font-semibold tabular-nums inline-flex items-center gap-1.5 shadow-md">
            <Eye className="w-3.5 h-3.5 text-white/90" />
            <span>{stream.viewerCount}</span>
          </span>
        </div>

        {/* Center "Toca para entrar al LIVE" CTA */}
        <div className="absolute inset-0 z-20 flex items-center justify-center px-6 pointer-events-none">
          <span className="px-6 py-3 rounded-full bg-[#FE2C55] hover:bg-[#e1244a] text-white text-sm font-bold shadow-2xl shadow-black/50 transition-transform active:scale-95">
            Toca para entrar al LIVE
          </span>
        </div>
      </div>

      {/* Bottom Creator Ring + @username + Stream Title */}
      <div className="pointer-events-none absolute left-3.5 right-6 bottom-3.5 lg:bottom-4 z-20 space-y-2">
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCreator(stream.creator.uid);
            }}
            className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
          >
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#FE2C55] to-[#E84393] shrink-0 shadow-lg">
              <AvatarImg
                src={stream.creator.avatarUrl}
                alt={stream.creator.displayName}
                fallbackText={stream.creator.displayName}
                sizeClass="w-11 h-11"
              />
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-white group-hover:underline truncate drop-shadow">
                @{stream.creator.username}
              </p>
              <p className="text-xs text-white/85 truncate drop-shadow">
                {stream.streamTitle}
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
