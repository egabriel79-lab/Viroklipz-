import { useEffect, useState } from 'react';

interface AvatarImgProps {
  src: string;
  alt: string;
  fallbackText: string;
  sizeClass?: string;
}

export function AvatarImg({
  src,
  alt,
  fallbackText,
  sizeClass = 'w-10 h-10',
}: AvatarImgProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const initial = (fallbackText || 'V').trim().charAt(0).toUpperCase();

  if (!src || failed) {
    return (
      <div
        aria-label={alt}
        className={`${sizeClass} rounded-full bg-gradient-to-br from-[#6C5CE7]/85 to-[#00B4D8]/80 border border-white/15 flex items-center justify-center text-white font-display font-bold text-sm shrink-0 select-none`}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover border border-white/15 shrink-0 bg-zinc-900`}
    />
  );
}
