import { useEffect, useState } from 'react';
import { getClipMediaBlob } from '../lib/mediaStorage';
import type { ClipItem } from '../types/viroklipz';

interface ClipThumbnailProps {
  clip: ClipItem;
  className?: string;
}

export function ClipThumbnail({ clip, className = '' }: ClipThumbnailProps) {
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    setVideoFailed(false);
  }, [clip.id, clip.videoUrl]);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;

    if (!clip.hasLocalMedia || clip.videoUrl) {
      setLocalUrl(null);
      return;
    }

    void getClipMediaBlob(clip.id).then((blob) => {
      if (cancelled || !blob || !blob.type.startsWith('video/')) return;
      const url = URL.createObjectURL(blob);
      revoked = url;
      setLocalUrl(url);
    });

    return () => {
      cancelled = true;
      if (revoked) {
        URL.revokeObjectURL(revoked);
      }
    };
  }, [clip.id, clip.hasLocalMedia, clip.videoUrl]);

  const videoSrc = !videoFailed ? clip.videoUrl || localUrl : null;

  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        muted
        playsInline
        preload="metadata"
        poster={clip.visualPreset || undefined}
        onError={() => setVideoFailed(true)}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  if (clip.visualPreset) {
    return (
      <img
        src={clip.visualPreset}
        alt={clip.caption}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  return <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />;
}
