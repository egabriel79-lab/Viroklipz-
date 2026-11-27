import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Coins,
  Globe2,
  Heart,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Radio,
  Share2,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import heroCreatorImg from '../assets/images/hero_vertical_creator_1795794844296.jpg';
import pwaUserImg from '../assets/images/pwa_user_smiling_1795794843896.jpg';
import avatarOneImg from '../assets/images/creator_avatar_one_1795794843851.jpg';
import avatarTwoImg from '../assets/images/creator_avatar_two_1795794844149.jpg';
import avatarThreeImg from '../assets/images/creator_avatar_three_1795794844745.jpg';
import clipUrbanDanceImg from '../assets/images/clip_urban_dance_1795372621458.jpg';
import clipRooftopDjImg from '../assets/images/clip_rooftop_dj_1795372625001.jpg';
import { STARTER_CLIPS } from '../data/starterClips';
import type { UserProfile } from '../types/viroklipz';
import { AuthModal, type AuthModalMode } from './AuthModal';
import { AvatarImg } from './AvatarImg';
import { LegalModal } from './LegalModal';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingViewProps {
  onAuthSuccess: (profile: UserProfile) => void;
  onExploreGuest: () => void;
}

interface PhoneReelItem {
  id: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string;
  caption: string;
  audioTitle: string;
  viewsLabel: string;
  likesLabel: string;
  commentsLabel: string;
  imageSrc: string;
  isLive?: boolean;
}

const PHONE_REELS: PhoneReelItem[] = [
  {
    id: 'reel-studio-ruiz',
    authorUsername: 'studio.ruiz',
    authorDisplayName: 'Gabriel Ruiz',
    authorAvatarUrl: avatarTwoImg,
    caption: 'Grabando sesión acústica en vivo para toda la comunidad de Viroklipz.',
    audioTitle: 'Sesión Nocturna · Audio Original',
    viewsLabel: '48.2K',
    likesLabel: '6.4K',
    commentsLabel: '412',
    imageSrc: heroCreatorImg,
    isLive: true,
  },
  {
    id: 'reel-valeria',
    authorUsername: STARTER_CLIPS[0]?.authorUsername || 'valeria.clips',
    authorDisplayName: STARTER_CLIPS[0]?.authorDisplayName || 'Valeria Mendoza',
    authorAvatarUrl: avatarOneImg,
    caption: STARTER_CLIPS[0]?.caption || 'Atardecer urbano en 9:16 sin filtros pesados.',
    audioTitle: STARTER_CLIPS[0]?.audioTitle || 'Neon Breeze · Original',
    viewsLabel: STARTER_CLIPS[0]?.viewsLabel || '124K',
    likesLabel: '14.2K',
    commentsLabel: '890',
    imageSrc: clipUrbanDanceImg,
  },
  {
    id: 'reel-camila',
    authorUsername: STARTER_CLIPS[1]?.authorUsername || 'camila.live',
    authorDisplayName: STARTER_CLIPS[1]?.authorDisplayName || 'Camila Ortega',
    authorAvatarUrl: avatarThreeImg,
    caption: STARTER_CLIPS[1]?.caption || 'Detrás de cámaras creando contenido desde el navegador.',
    audioTitle: STARTER_CLIPS[1]?.audioTitle || 'City Pulse · Original',
    viewsLabel: STARTER_CLIPS[1]?.viewsLabel || '89.5K',
    likesLabel: '9.8K',
    commentsLabel: '530',
    imageSrc: clipRooftopDjImg,
  },
];

const FEATURE_CARDS = [
  {
    title: 'Sube y Comparte',
    description: 'Publica videos, fotos o textos en segundos.',
    icon: Upload,
    accent: 'cyan' as const,
  },
  {
    title: 'Transmite en Vivo',
    description: 'Haz Lives, interactúa con tu audiencia y recibe regalos.',
    icon: Radio,
    accent: 'magenta' as const,
  },
  {
    title: 'Monetiza tu Talento',
    description: 'Compra y envía monedas virtuales a tus creadores favoritos.',
    icon: Coins,
    accent: 'cyan' as const,
  },
  {
    title: 'Comunidad Real',
    description: 'Chatea, sigue a tus amigos y descubre nuevas tendencias.',
    icon: Users,
    accent: 'magenta' as const,
  },
];

const PWA_BENEFITS = [
  'Instalación instantánea en 2 clics.',
  'Ahorro real de batería y datos móviles.',
  'Funciona en Android, iOS y PC.',
];

const SOCIAL_AVATARS = [
  { name: 'Valeria · Venezuela', src: avatarOneImg },
  { name: 'Gabriel · Colombia', src: avatarTwoImg },
  { name: 'Camila · México', src: avatarThreeImg },
];

const REGION_COUNTRIES = [
  { code: 'VE', name: 'Venezuela' },
  { code: 'CO', name: 'Colombia' },
  { code: 'MX', name: 'México' },
  { code: 'AR', name: 'Argentina' },
  { code: 'ES', name: 'España' },
];

export function LandingView({ onAuthSuccess, onExploreGuest }: LandingViewProps) {
  const [authMode, setAuthMode] = useState<AuthModalMode | null>(null);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | null>(null);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [isMockupPlaying, setIsMockupPlaying] = useState(true);
  const [pwaPhotoError, setPwaPhotoError] = useState(false);
  const [phonePhotoError, setPhonePhotoError] = useState(false);

  const activeReel = PHONE_REELS[activeReelIndex] || PHONE_REELS[0];

  useEffect(() => {
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.content = canonicalUrl;
  }, []);

  useEffect(() => {
    setPhonePhotoError(false);
  }, [activeReelIndex]);

  const openAuthModal = (mode: AuthModalMode) => {
    setAuthMode(mode);
  };

  return (
    <div className="min-h-[100dvh] bg-[#0B0D14] text-zinc-100 flex flex-col relative overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      {/* Subtle Ambient Startup Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      >
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-[#E84393]/12 blur-[140px]" />
        <div className="absolute top-32 -right-32 w-[520px] h-[520px] rounded-full bg-[#00B4D8]/12 blur-[150px]" />
      </div>

      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0D14]/85 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#inicio"
            className="font-display text-xl sm:text-2xl font-black tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Viro<span className="bg-gradient-to-r from-[#E84393] to-[#00B4D8] bg-clip-text text-transparent">klipz</span>
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            <a
              href="#prueba-social"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Comunidad
            </a>
            <a
              href="#funciones"
              className="hover:text-[#00B4D8] transition-colors whitespace-nowrap shrink-0"
            >
              Funciones
            </a>
            <a
              href="#porque-pwa"
              className="hover:text-[#E84393] transition-colors whitespace-nowrap shrink-0"
            >
              Por qué PWA
            </a>
            <a
              href="#empezar"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Únete
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="min-h-[40px] px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 text-xs sm:text-sm font-semibold text-white transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#E84393]/20"
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* HERO SECTION */}
        <section
          id="inicio"
          className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Hero Copy & CTAs */}
            <div className="lg:col-span-7 flex flex-col items-start space-y-6">
              <p className="text-xs sm:text-sm font-medium text-zinc-400 tracking-wide flex flex-wrap items-center gap-2">
                <span className="text-[#00B4D8] font-semibold">PWA sin descargas</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span className="text-[#E84393] font-semibold">Videos verticales y Lives</span>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Monetización VEX Pay</span>
              </p>

              <h1
                className="font-display font-black uppercase tracking-tight leading-[0.95] bg-gradient-to-r from-[#E84393] via-white to-[#00B4D8] bg-clip-text text-transparent"
                style={{
                  fontSize: 'clamp(3.15rem, 8.2vw, 5.75rem)',
                  textWrap: 'balance',
                }}
              >
                VIROKLIPZ
              </h1>

              <h2
                className="font-display text-xl sm:text-2xl lg:text-[1.75rem] font-bold text-zinc-100 leading-snug max-w-2xl"
                style={{ textWrap: 'balance' }}
              >
                La red social definitiva de videos y transmisiones en vivo. Sin descargas, directo desde tu navegador.
              </h2>

              <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
                Crea klips verticales en segundos, conecta en directo con tu audiencia, apoya a tus creadores favoritos con monedas virtuales y lleva toda la experiencia en tu pantalla de inicio sin llenar la memoria.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto pt-1">
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="min-h-[50px] px-7 py-3.5 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2.5 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xl shadow-[#E84393]/25"
                >
                  Empezar Gratis
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={onExploreGuest}
                  className="min-h-[50px] px-7 py-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-xl border border-white/15 text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-4 h-4 text-[#00B4D8] fill-[#00B4D8] shrink-0" />
                  Ver Demo
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-zinc-400">
                <PWAInstallButton compact />
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <span>Registro gratuito en 30 segundos</span>
              </div>
            </div>

            {/* 3D Smartphone Mockup */}
            <div className="lg:col-span-5 flex flex-col items-center gap-5">
              <div className="relative w-full max-w-[330px] [perspective:1200px]">
                {/* Ambient Glow Behind Device */}
                <div
                  aria-hidden="true"
                  className="absolute -inset-4 rounded-[3rem] bg-gradient-to-tr from-[#E84393]/30 via-transparent to-[#00B4D8]/30 blur-2xl opacity-80"
                />

                {/* 3D Tilted Phone Frame */}
                <div className="relative mx-auto rounded-[2.75rem] p-[10px] bg-gradient-to-b from-zinc-700/80 via-zinc-900 to-zinc-800/80 border border-white/20 shadow-[0_30px_80px_rgba(0,0,0,0.75)] [transform:rotateY(-8deg)_rotateX(4deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)] transition-transform duration-500">
                  {/* Screen Bezel */}
                  <div className="relative aspect-[9/16] w-full rounded-[2.2rem] overflow-hidden bg-[#0F111A] border border-white/10">
                    {/* Top Dynamic Notch */}
                    <div
                      aria-hidden="true"
                      className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 w-24 h-5 rounded-full bg-black/90 border border-white/10 flex items-center justify-end px-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-[#00B4D8]/60" />
                    </div>

                    {/* Vertical Video Frame */}
                    {!phonePhotoError ? (
                      <img
                        src={activeReel.imageSrc}
                        alt={activeReel.caption}
                        referrerPolicy="no-referrer"
                        onError={() => setPhonePhotoError(true)}
                        className={`w-full h-full object-cover transition-transform duration-700 ${
                          isMockupPlaying ? 'animate-ken-burns' : 'scale-100'
                        }`}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#161926] via-[#0F111A] to-[#1d1226] flex items-center justify-center">
                        <Radio className="w-12 h-12 text-[#E84393]" />
                      </div>
                    )}

                    {/* Contrast Scrim */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/45"
                    />

                    {/* Mockup Feed Top Bar */}
                    <div className="absolute top-10 left-4 right-4 z-20 flex items-center justify-between text-[11px] font-semibold text-white">
                      <div className="flex items-center gap-3">
                        <span className="text-white/60">Siguiendo</span>
                        <span className="text-white border-b-2 border-[#E84393] pb-0.5">
                          Para ti
                        </span>
                      </div>
                      {activeReel.isLive ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#E84393] px-2 py-0.5 rounded-md">
                          <Radio className="w-3 h-3" />
                          En vivo
                        </span>
                      ) : (
                        <span className="font-mono tabular-nums text-[10px] text-[#00B4D8]">
                          {activeReel.viewsLabel} vistas
                        </span>
                      )}
                    </div>

                    {/* Center Play/Pause Affordance */}
                    <button
                      type="button"
                      onClick={() => setIsMockupPlaying((prev) => !prev)}
                      aria-label={
                        isMockupPlaying
                          ? 'Pausar vista previa del video'
                          : 'Reproducir vista previa del video'
                      }
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/25 flex items-center justify-center text-white transition-all cursor-pointer"
                    >
                      {isMockupPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5 fill-white translate-x-0.5" />
                      )}
                    </button>

                    {/* Right Side Vertical Action Rail */}
                    <div className="absolute right-3 bottom-20 z-20 flex flex-col items-center gap-3.5 text-white">
                      <button
                        type="button"
                        onClick={onExploreGuest}
                        aria-label="Dar me gusta en la demo"
                        className="flex flex-col items-center gap-0.5 cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center hover:border-[#E84393]/60 transition-colors">
                          <Heart className="w-4 h-4 text-[#E84393] fill-[#E84393]" />
                        </span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {activeReel.likesLabel}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={onExploreGuest}
                        aria-label="Ver comentarios en la demo"
                        className="flex flex-col items-center gap-0.5 cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center hover:border-[#00B4D8]/60 transition-colors">
                          <MessageCircle className="w-4 h-4 text-white" />
                        </span>
                        <span className="font-mono text-[10px] tabular-nums">
                          {activeReel.commentsLabel}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openAuthModal('signup')}
                        aria-label="Enviar monedas"
                        className="flex flex-col items-center gap-0.5 cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center hover:border-[#00B4D8]/60 transition-colors">
                          <Coins className="w-4 h-4 text-[#00B4D8]" />
                        </span>
                        <span className="text-[10px]">Regalar</span>
                      </button>

                      <button
                        type="button"
                        onClick={onExploreGuest}
                        aria-label="Explorar klip completo"
                        className="flex flex-col items-center gap-0.5 cursor-pointer"
                      >
                        <span className="w-9 h-9 rounded-full bg-black/45 backdrop-blur-md border border-white/15 flex items-center justify-center">
                          <Share2 className="w-4 h-4 text-white" />
                        </span>
                      </button>
                    </div>

                    {/* Bottom Creator Info Overlay */}
                    <div className="absolute bottom-4 left-3.5 right-14 z-20 space-y-2">
                      <div className="flex items-center gap-2">
                        <AvatarImg
                          src={activeReel.authorAvatarUrl}
                          alt={activeReel.authorDisplayName}
                          fallbackText={activeReel.authorDisplayName}
                          sizeClass="w-8 h-8"
                        />
                        <div className="min-w-0">
                          <p className="font-display text-xs font-bold text-white truncate">
                            @{activeReel.authorUsername}
                          </p>
                          <p className="text-[10px] text-zinc-300 truncate">
                            {activeReel.authorDisplayName}
                          </p>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-100 leading-snug line-clamp-2">
                        {activeReel.caption}
                      </p>

                      <div className="flex items-center gap-1.5 text-[10px] text-zinc-300 truncate">
                        <Music2 className="w-3 h-3 text-[#00B4D8] shrink-0" />
                        <span className="truncate">{activeReel.audioTitle}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Creator Clip Switcher */}
              <div className="w-full max-w-[330px] grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10">
                {PHONE_REELS.map((reel, idx) => (
                  <button
                    key={reel.id}
                    type="button"
                    onClick={() => setActiveReelIndex(idx)}
                    className={`min-h-[38px] px-2 rounded-xl text-xs font-semibold transition-all truncate cursor-pointer ${
                      idx === activeReelIndex
                        ? 'bg-gradient-to-r from-[#E84393] to-[#00B4D8] text-white shadow'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    @{reel.authorUsername.split('.')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF SECTION */}
        <section
          id="prueba-social"
          className="border-y border-white/10 bg-white/[0.02] backdrop-blur-md"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex -space-x-3">
                  {SOCIAL_AVATARS.map((person) => (
                    <img
                      key={person.name}
                      src={person.src}
                      alt={person.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover ring-2 ring-[#0B0D14]"
                    />
                  ))}
                </div>
                <p className="font-display text-base sm:text-lg font-bold text-white">
                  Creadores de todo el mundo ya están usando Viroklipz
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 text-[#00B4D8] font-medium">
                  <Globe2 className="w-3.5 h-3.5" />
                  Comunidad activa en:
                </span>
                {REGION_COUNTRIES.map((country, idx) => (
                  <span key={country.code} className="inline-flex items-center gap-1.5">
                    {idx > 0 && (
                      <span className="text-zinc-600 mr-1.5" aria-hidden="true">
                        ·
                      </span>
                    )}
                    <span className="font-mono text-[11px] font-semibold text-zinc-300">
                      {country.code}
                    </span>
                    <span>{country.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Stats Bar */}
            <div className="w-full lg:w-auto grid grid-cols-3 gap-6 sm:gap-10 pt-4 lg:pt-0 border-t lg:border-t-0 border-white/10">
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#E84393]">
                  10K+
                </p>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Creadores</p>
              </div>
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#00B4D8]">
                  1M+
                </p>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">Reproducciones</p>
              </div>
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white">
                  100%
                </p>
                <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">PWA</p>
              </div>
            </div>
          </div>
        </section>

        {/* "TODO LO QUE PUEDES HACER" - 4-Card Glassmorphism Grid */}
        <section id="funciones" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20 space-y-10">
          <div className="max-w-2xl space-y-2.5">
            <h2
              className="font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight"
              style={{ textWrap: 'balance' }}
            >
              Todo lo que puedes hacer
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
              Una plataforma social completa pensada para crear, transmitir en vivo y crecer sin barreras técnicas.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURE_CARDS.map((card) => {
              const Icon = card.icon;
              const isCyan = card.accent === 'cyan';
              return (
                <article
                  key={card.title}
                  className="bg-white/[0.04] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-white/20 rounded-2xl p-6 flex flex-col justify-between gap-6 transition-all duration-200"
                >
                  <div className="space-y-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${
                        isCyan
                          ? 'bg-[#00B4D8]/12 border-[#00B4D8]/30 text-[#00B4D8]'
                          : 'bg-[#E84393]/12 border-[#E84393]/30 text-[#E84393]'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-display text-lg font-bold text-white">
                        {card.title}
                      </h3>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {card.description}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* "¿POR QUÉ PWA?" SECTION */}
        <section
          id="porque-pwa"
          className="border-t border-white/10 bg-white/[0.02]"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
              {/* Human Lifestyle Image */}
              <div className="lg:col-span-6 relative min-h-[300px] sm:min-h-[380px] bg-[#131622]">
                {!pwaPhotoError ? (
                  <img
                    src={pwaUserImg}
                    alt="Creadora sonriendo mientras usa Viroklipz PWA desde su teléfono"
                    referrerPolicy="no-referrer"
                    onError={() => setPwaPhotoError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-zinc-400">
                    <Sparkles className="w-10 h-10 text-[#00B4D8]" />
                    <p className="text-sm font-medium">Viroklipz PWA en cualquier pantalla</p>
                  </div>
                )}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#0B0D14]/80 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-[#0F111A]/60"
                />
              </div>

              {/* Copy & Checklist */}
              <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center space-y-6">
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#00B4D8]">
                    Tecnología sin fricción
                  </p>
                  <h2
                    className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight"
                    style={{ textWrap: 'balance' }}
                  >
                    ¿Por qué PWA?
                  </h2>
                  <p className="text-base text-zinc-300 leading-relaxed">
                    Viroklipz no te obliga a descargar nada de la App Store. Es una Aplicación Web Progresiva (PWA).
                  </p>
                </div>

                <ul className="space-y-3.5 text-sm sm:text-base text-zinc-200">
                  {PWA_BENEFITS.map((benefit, index) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                          index % 2 === 0
                            ? 'bg-[#00B4D8]/20 text-[#00B4D8]'
                            : 'bg-[#E84393]/20 text-[#E84393]'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                      </span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <PWAInstallButton />
                  <button
                    type="button"
                    onClick={onExploreGuest}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Probar en el navegador
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CONVERSION BANNER */}
        <section id="empezar" className="max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-20">
          <div className="relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:p-14 border border-white/20 bg-gradient-to-br from-[#E84393]/25 via-[#151827] to-[#00B4D8]/25 backdrop-blur-xl shadow-2xl">
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="space-y-3 max-w-2xl">
                <h2
                  className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight"
                  style={{ textWrap: 'balance' }}
                >
                  ¿Listo para hacerte viral?
                </h2>
                <p className="text-sm sm:text-base text-zinc-200 leading-relaxed">
                  Abre tu perfil gratis hoy mismo, publica tus primeros klips, transmite en vivo y recibe apoyo de tu comunidad con VEX Pay.
                </p>
              </div>

              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="w-full sm:w-auto min-h-[54px] px-8 py-4 rounded-2xl bg-gradient-to-r from-[#E84393] to-[#00B4D8] hover:brightness-110 text-white text-base font-bold inline-flex items-center justify-center gap-2.5 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-xl shadow-[#E84393]/30"
              >
                Crear mi cuenta ahora
                <ArrowRight className="w-5 h-5 shrink-0" />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 border-t border-white/10 py-7 bg-[#0B0D14]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <span className="font-display font-bold text-white">
              Viro<span className="bg-gradient-to-r from-[#E84393] to-[#00B4D8] bg-clip-text text-transparent">klipz</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>La Red Social PWA de Videos y Lives</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="#funciones" className="hover:text-white transition-colors">
              Funciones
            </a>
            <a href="#porque-pwa" className="hover:text-white transition-colors">
              Por qué PWA
            </a>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              Términos de Uso
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
            >
              Política de Privacidad
            </button>
          </div>
        </div>
      </footer>

      <AuthModal
        isOpen={authMode !== null}
        initialMode={authMode ?? 'login'}
        onClose={() => setAuthMode(null)}
        onSuccess={(profile) => {
          setAuthMode(null);
          onAuthSuccess(profile);
        }}
        onOpenLegal={(tab) => setLegalTab(tab)}
      />

      <LegalModal
        isOpen={legalTab !== null}
        initialTab={legalTab || 'terms'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
