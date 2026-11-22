import { useMemo, useState } from 'react';
import { Heart, Play, Search } from 'lucide-react';
import { ALLOWED_CATEGORIES, formatCompactCount } from '../lib/validation';
import type { ClipCategory, ClipItem } from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';

interface ExploreViewProps {
  clips: ClipItem[];
  likedIds: Set<string>;
  onSelectClip: (clipId: string) => void;
}

const CATEGORY_TITLES: Record<ClipCategory, string> = {
  baile: 'Baile',
  musica: 'Música',
  cocina: 'Cocina',
  deportes: 'Deportes',
  arte: 'Arte',
  comedia: 'Comedia',
  viajes: 'Viajes',
};

export function ExploreView({ clips, likedIds, onSelectClip }: ExploreViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'todos' | ClipCategory>('todos');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clips.filter((c) => {
      if (selectedCategory !== 'todos' && c.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        c.caption.toLowerCase().includes(q) ||
        c.authorUsername.toLowerCase().includes(q) ||
        c.authorDisplayName.toLowerCase().includes(q) ||
        c.hashtags.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [clips, search, selectedCategory]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Explorar Viroklipz
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Descubre creadores, sonidos y tendencias por categoría.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar @usuario, #etiqueta..."
            className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory('todos')}
          className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            selectedCategory === 'todos'
              ? 'bg-[#FF3B5C] text-white'
              : 'bg-[#121216] border border-white/10 text-zinc-300 hover:text-white'
          }`}
        >
          Todos
        </button>
        {ALLOWED_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#FF3B5C] text-white'
                : 'bg-[#121216] border border-white/10 text-zinc-300 hover:text-white'
            }`}
          >
            {CATEGORY_TITLES[cat]}
          </button>
        ))}
      </div>

      {/* Results Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center bg-[#121216] border border-white/10 rounded-2xl space-y-2">
          <p className="text-base font-medium text-zinc-200">
            Sin coincidencias para tu búsqueda
          </p>
          <p className="text-sm text-zinc-500">
            Prueba con otra categoría o limpia el filtro de búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((clip) => {
            const likesTotal = clip.likesCount + (clip.isStarter && likedIds.has(clip.id) ? 1 : 0);
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelectClip(clip.id)}
                className="group text-left bg-[#121216] border border-white/10 rounded-2xl overflow-hidden hover:border-white/25 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF3B5C]"
              >
                <div className="relative aspect-[9/14] bg-zinc-900 overflow-hidden">
                  {clip.visualPreset ? (
                    <img
                      src={clip.visualPreset}
                      alt={clip.caption}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-950" />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent"
                  />
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-90 group-hover:bg-[#FF3B5C] transition-colors">
                    <Play className="w-3.5 h-3.5 fill-white translate-x-0.5" />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 space-y-1.5">
                    <p className="text-xs text-zinc-100 line-clamp-2 leading-snug">
                      {clip.caption}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-300">
                      <span className="truncate capitalize">
                        {CATEGORY_TITLES[clip.category]}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                        <Heart className="w-3 h-3 text-[#FF3B5C]" />
                        {formatCompactCount(likesTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2.5 flex items-center gap-2">
                  <AvatarImg
                    src={clip.authorAvatarUrl}
                    alt={clip.authorDisplayName}
                    fallbackText={clip.authorDisplayName}
                    sizeClass="w-6 h-6"
                  />
                  <span className="text-xs font-medium text-zinc-300 truncate">
                    @{clip.authorUsername}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
