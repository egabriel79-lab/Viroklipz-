import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  Heart,
  MessageSquare,
  Music2,
  Play,
  Radio,
  ShieldCheck,
  Smartphone,
  Video,
  X,
} from 'lucide-react';
import { STARTER_CLIPS } from '../data/starterClips';
import {
  mapAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/viroklipzService';
import { MAX_DISPLAY_NAME_LEN, MAX_EMAIL_LEN } from '../lib/validation';
import { AvatarImg } from './AvatarImg';
import { LegalModal } from './LegalModal';
import { PWAInstallButton } from './PWAInstallButton';

interface LandingViewProps {
  onAuthSuccess: () => void;
  onExploreGuest: () => void;
}

type AuthModalMode = 'login' | 'signup' | null;

const HERO_SHOWCASE_CLIPS = STARTER_CLIPS.slice(0, 3);

const FAQ_ITEMS = [
  {
    question: '¿Qué es Viroklipz y qué ventajas tiene ser una aplicación web PWA?',
    answer:
      'Viroklipz es una red social de videos cortos verticales y transmisiones en vivo construida como Aplicación Web Progresiva (PWA). Se abre directo en el navegador, se instala en segundos en tu pantalla de inicio sin tiendas, ocupa espacio mínimo y se mantiene siempre actualizada.',
  },
  {
    question: '¿Cómo se instala Viroklipz en Android, iPhone o computadora?',
    answer:
      'En Android o escritorio con Chrome o Edge basta pulsar el botón Instalar app PWA. En iPhone o iPad con Safari, toca Compartir y elige Añadir a pantalla de inicio para usarla en pantalla completa.',
  },
  {
    question: '¿Cuántos datos móviles y espacio ahorra Viroklipz?',
    answer:
      'Su caché inicial pesa menos de 3 MB frente a los cientos de megabytes de las apps tradicionales. Además, puedes grabar con compresión inteligente a 720 kbps y activar el modo ahorro de datos para reproducir videos sin gastar tu plan.',
  },
  {
    question: '¿Qué funciones incluye Viroklipz para creadores y espectadores?',
    answer:
      'Incluye feed Para ti y Siguiendo con klips 9:16 y transmisiones LIVE en tiempo real, grabación de 10s a 60s, historias interactivas, mensajes directos, sala de la comunidad, rachas diarias, bordes personalizables y métricas en Viroklipz Studio.',
  },
];

export function LandingView({ onAuthSuccess, onExploreGuest }: LandingViewProps) {
  const [authMode, setAuthMode] = useState<AuthModalMode>(null);
  const [showcaseIndex, setShowcaseIndex] = useState(0);

  // Auth form fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy' | null>(null);

  const activeClip = HERO_SHOWCASE_CLIPS[showcaseIndex] || STARTER_CLIPS[0];

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

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthError(null);
    setPassword('');
    setShowPassword(false);
    setAuthMode(mode);
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Introduce un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (authMode === 'signup' && displayName.trim().length < 2) {
      setAuthError('Escribe tu nombre para crear tu perfil en Viroklipz.');
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === 'signup') {
        await signUpWithEmail({
          displayName: displayName.trim(),
          email: trimmedEmail,
          password,
        });
      } else {
        await signInWithEmail({
          email: trimmedEmail,
          password,
        });
      }
      setAuthMode(null);
      onAuthSuccess();
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      setAuthMode(null);
      onAuthSuccess();
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-zinc-50 dark:bg-[#0F111A] text-zinc-900 dark:text-zinc-100 flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-white/10 bg-white/90 dark:bg-[#0F111A]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#inicio"
            className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Viro<span className="text-neon-gradient">klipz</span>
          </a>

          <nav
            aria-label="Secciones principales"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600 dark:text-zinc-400"
          >
            <a
              href="#ventajas"
              className="hover:text-[#00B4D8] transition-colors whitespace-nowrap shrink-0"
            >
              Ventajas PWA
            </a>
            <a
              href="#como-funciona"
              className="hover:text-[#6C5CE7] dark:hover:text-[#8B7CF6] transition-colors whitespace-nowrap shrink-0"
            >
              Cómo funciona
            </a>
            <a
              href="#comunidad"
              className="hover:text-[#00B4D8] transition-colors whitespace-nowrap shrink-0"
            >
              Comunidad y Live
            </a>
            <a
              href="#preguntas"
              className="hover:text-zinc-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Preguntas
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-[#161926] dark:hover:bg-white/10 border border-zinc-200 dark:border-white/15 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('signup')}
              className="min-h-[40px] px-3 sm:px-4 py-2 rounded-xl bg-neon-cta text-xs sm:text-sm font-semibold text-white transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-md shadow-[#E84393]/25"
            >
              Crear cuenta
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section
          id="inicio"
          className="relative max-w-7xl mx-auto px-5 sm:px-8 pt-8 pb-14 lg:pt-14 lg:pb-20 overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Proposition & Call to Action */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 tracking-wide flex flex-wrap items-center gap-2">
                <span className="text-[#00B4D8]">Aplicación Web Progresiva (PWA)</span>
                <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>
                <span className="text-[#6C5CE7] dark:text-[#8B7CF6]">Video vertical 9:16</span>
                <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>
                <span className="text-zinc-700 dark:text-zinc-300">Transmisiones en vivo</span>
              </p>

              <h1
                className="font-display font-extrabold tracking-tight text-zinc-900 dark:text-white leading-[1.06]"
                style={{
                  fontSize: 'clamp(2.2rem, 4.3vw, 3.65rem)',
                  textWrap: 'balance',
                }}
              >
                Tu red social PWA de{' '}
                <span className="text-neon-gradient">videos cortos y en vivo</span>{' '}
                sin ocupar espacio.
              </h1>

              <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed">
                Abre Viroklipz desde tu navegador, instálala en tu pantalla de inicio en
                segundos y disfruta klips 9:16, transmisiones LIVE, historias y chat en
                tiempo real con la fluidez de una app nativa.
              </p>

              {/* Clean PWA Advantages List (No decorative emoji clutter) */}
              <ul className="border-t border-b border-zinc-200 dark:border-white/10 divide-y divide-zinc-200 dark:divide-white/10 text-sm">
                <li className="py-3 flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#00B4D8] shrink-0 mt-0.5" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    <strong className="font-semibold text-zinc-900 dark:text-white">
                      Instalación instantánea sin tiendas:
                    </strong>{' '}
                    Añádela a tu pantalla de inicio en Android, iOS o PC con actualizaciones automáticas.
                  </span>
                </li>
                <li className="py-3 flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6] shrink-0 mt-0.5" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    <strong className="font-semibold text-zinc-900 dark:text-white">
                      Ahorro real de datos y batería:
                    </strong>{' '}
                    Compresión inteligente a 720 kbps al grabar y reproducción optimizada en segundo plano.
                  </span>
                </li>
                <li className="py-3 flex items-start gap-3">
                  <Check className="w-4 h-4 text-[#E84393] shrink-0 mt-0.5" />
                  <span className="text-zinc-700 dark:text-zinc-300">
                    <strong className="font-semibold text-zinc-900 dark:text-white">
                      Todo en pantalla completa:
                    </strong>{' '}
                    Feed híbrido con videos cortos e inicios LIVE, historias, mensajes y Studio en vivo.
                  </span>
                </li>
              </ul>

              {/* Primary CTA + Direct Entry */}
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 max-w-md sm:max-w-none">
                  <button
                    type="button"
                    onClick={() => openAuthModal('signup')}
                    className="min-h-[48px] px-4 sm:px-6 py-3 rounded-xl bg-neon-cta text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#E84393]/25"
                  >
                    Crear cuenta gratis
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="min-h-[48px] px-4 sm:px-6 py-3 rounded-xl bg-white hover:bg-zinc-100 dark:bg-[#161926] dark:hover:bg-white/[0.08] border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Iniciar sesión
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={onExploreGuest}
                    className="font-semibold text-zinc-800 hover:text-[#6C5CE7] dark:text-zinc-200 dark:hover:text-[#00B4D8] underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Explorar el feed público ahora
                  </button>
                  <span className="text-zinc-400 dark:text-zinc-600" aria-hidden="true">·</span>
                  <span>Sin tarjeta ni descargas pesadas</span>
                  <PWAInstallButton compact />
                </div>
              </div>
            </div>

            {/* Right Interactive Vertical Klip Showcase */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4">
              <div className="relative flex-1 min-h-[430px] sm:min-h-[480px] max-w-[360px] w-full mx-auto rounded-3xl overflow-hidden bg-zinc-900 border border-zinc-200 dark:border-white/15 shadow-2xl">
                {activeClip.visualPreset ? (
                  <img
                    src={activeClip.visualPreset}
                    alt={activeClip.caption}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-zinc-950" />
                )}

                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/35"
                />

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs text-white/90">
                  <span className="capitalize font-medium">
                    {activeClip.category}
                    <span className="mx-1.5 text-white/50">·</span>
                    <span className="font-mono tabular-nums text-[#00B4D8]">{activeClip.viewsLabel}</span> vistas
                  </span>
                  <button
                    type="button"
                    onClick={onExploreGuest}
                    aria-label="Explorar klips en vivo en Viroklipz"
                    className="w-9 h-9 rounded-full bg-[#0F111A]/65 hover:bg-[#0F111A]/90 backdrop-blur-md border border-[#00B4D8]/40 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                  </button>
                </div>

                <div className="absolute bottom-5 left-4 right-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <AvatarImg
                      src={activeClip.authorAvatarUrl}
                      alt={activeClip.authorDisplayName}
                      fallbackText={activeClip.authorDisplayName}
                      sizeClass="w-9 h-9"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold text-white truncate">
                        @{activeClip.authorUsername}
                      </p>
                      <p className="text-[11px] text-zinc-300 truncate">
                        {activeClip.authorDisplayName}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-100 leading-snug line-clamp-2">
                    {activeClip.caption}
                  </p>

                  <div className="flex items-center justify-between text-xs text-zinc-300 pt-1">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Music2 className="w-3.5 h-3.5 text-[#00B4D8] shrink-0" />
                      <span className="truncate">{activeClip.audioTitle}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-white shrink-0 ml-2">
                      <Heart className="w-3.5 h-3.5 text-[#6C5CE7] fill-[#6C5CE7]" />
                      {(activeClip.likesCount / 1000).toFixed(1)}k
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Creator Reel Switcher */}
              <div className="max-w-[360px] w-full mx-auto grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 shadow-sm dark:shadow-none">
                {HERO_SHOWCASE_CLIPS.map((clip, idx) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => setShowcaseIndex(idx)}
                    className={`min-h-[38px] px-2 rounded-lg text-xs font-semibold transition-colors truncate cursor-pointer ${
                      idx === showcaseIndex
                        ? 'bg-[#6C5CE7] text-white'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    @{clip.authorUsername.split('.')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Strip */}
          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#00B4D8]">
                &lt; 3 MB
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Caché ligera frente a apps que superan los 300 MB
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#6C5CE7] dark:text-[#8B7CF6]">
                720 kbps
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Compresión inteligente en modo ahorro de datos
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-[#00B4D8]">
                9:16 + LIVE
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Klips cortos y transmisiones en vivo en Para ti
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-zinc-900 dark:text-white">
                100% Web
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
                Instalable en Android, iPhone, tablet y escritorio
              </p>
            </div>
          </div>
        </section>

        {/* Asymmetric PWA Capabilities */}
        <section
          id="ventajas"
          className="border-t border-zinc-200 dark:border-white/10 bg-zinc-100/70 dark:bg-[#131622]"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                Ventajas reales de una aplicación web PWA construida para creadores
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Cada función está pensada para eliminar fricciones técnicas: arranca al
                instante, protege el almacenamiento de tu equipo y entrega video fluido en cualquier red.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#00B4D8]">
                    <Smartphone className="w-4 h-4 text-[#00B4D8]" />
                    <span>01. Arquitectura Web Progresiva</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                    Instálala sin pasar por tiendas y olvídate de actualizar manualmente
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                    Viroklipz vive en tu navegador y se fija en tu pantalla de inicio con su
                    propio icono. El Service Worker guarda en caché los recursos esenciales para
                    abrir en milisegundos, mantener soporte offline de interfaz y estrenar cada
                    mejora automáticamente.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-[#6C5CE7]" />
                    Carga instantánea sin descargas de 300 MB
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#00B4D8]" />
                    Compatible con Chrome, Edge y Safari
                  </span>
                </div>
              </div>

              <div
                id="studio"
                className="lg:col-span-5 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6C5CE7] dark:text-[#8B7CF6]">
                    <BarChart3 className="w-4 h-4 text-[#6C5CE7]" />
                    <span>02. Viroklipz Studio y perfil</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                    Métricas transparentes y personalización visual
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Consulta visualizaciones, me gusta y guardados en vivo, edita tu descripción
                    con colores y elige bordes de video que se adaptan al modo Claro u Oscuro.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-200 dark:border-white/10">
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#00B4D8]">142k</p>
                    <p className="text-[11px] text-zinc-500">Vistas</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#6C5CE7] dark:text-[#8B7CF6]">18.4k</p>
                    <p className="text-[11px] text-zinc-500">Me gusta</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-zinc-900 dark:text-white">2.1k</p>
                    <p className="text-[11px] text-zinc-500">Guardados</p>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#E84393]">
                    <Radio className="w-4 h-4 text-[#E84393]" />
                    <span>03. Feed híbrido Para ti + En vivo</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                    Videos cortos y transmisiones LIVE en un mismo desplazamiento
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Desliza klips verticales de 10s a 60s, descubre creadores transmitiendo en
                    vivo con entrada directa a su sala e interactúa en sus historias de hasta 10 publicaciones.
                  </p>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-[#00B4D8]" />
                    Cámara 9:16 y fondo animado
                  </span>
                </div>
              </div>

              <div
                id="comunidad"
                className="lg:col-span-7 bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-sm dark:shadow-none"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#00B4D8]">
                    <MessageSquare className="w-4 h-4" />
                    <span>04. Ahorro móvil y comunidad en tiempo real</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                    Conversa en vivo, cuida tus datos y suma tu racha diaria
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                    Graba en calidad estándar (2.5 Mbps) o ahorro móvil (720 kbps), comparte
                    notas rápidas, envía mensajes directos y participa en la sala de la comunidad
                    con estado activo sincronizado al instante.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-200 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
                  <span className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 inline-flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[#6C5CE7]" />
                    Racha diaria sincronizada
                  </span>
                  <span className="px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 inline-flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#00B4D8]" />
                    Modo Claro y Oscuro adaptable
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="como-funciona" className="border-t border-zinc-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                Empieza en tres pasos desde cualquier navegador
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                Sin configuraciones complejas ni instalaciones pesadas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 space-y-2.5">
                <p className="font-mono text-xs font-semibold text-[#00B4D8]">01</p>
                <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Abre o instala la PWA
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Entra por URL y pulsa Instalar para fijar Viroklipz en tu pantalla de inicio en
                  segundos con consumo mínimo.
                </p>
              </div>

              <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 space-y-2.5">
                <p className="font-mono text-xs font-semibold text-[#6C5CE7] dark:text-[#8B7CF6]">02</p>
                <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Publica klips, historias o LIVE
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Graba video vertical 9:16, personaliza tu fondo animado y descripción o abre tu
                  transmisión en vivo para tu audiencia.
                </p>
              </div>

              <div className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 space-y-2.5">
                <p className="font-mono text-xs font-semibold text-[#E84393]">03</p>
                <h3 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
                  Crece con métricas en tiempo real
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Conversa en comunidad, responde mensajes directos y sigue el rendimiento real de
                  tus klips desde Viroklipz Studio.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Semantic FAQ Section for Search & AI Engines */}
        <section
          id="preguntas"
          className="border-t border-zinc-200 dark:border-white/10 bg-zinc-100/70 dark:bg-[#131622]"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                Preguntas frecuentes sobre Viroklipz PWA
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                Todo lo que necesitas saber sobre compatibilidad, instalación, ahorro de datos y
                creación de contenido.
              </p>
            </div>

            <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FAQ_ITEMS.map((item) => (
                <div
                  key={item.question}
                  className="bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 space-y-2"
                >
                  <dt className="font-display text-base font-bold text-zinc-900 dark:text-white leading-snug">
                    {item.question}
                  </dt>
                  <dd className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final Call to Action */}
        <section id="empezar" className="border-t border-zinc-200 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
                Lleva <span className="text-neon-gradient">Viroklipz</span> en tu pantalla de inicio hoy mismo
              </h2>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Crea tu cuenta gratuita en segundos o entra al feed público ahora mismo. Disfruta
                klips verticales, transmisiones en vivo y comunidad en tiempo real sin llenar tu teléfono.
              </p>
            </div>

            <div className="w-full lg:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-neon-cta text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer shadow-lg shadow-[#E84393]/25"
              >
                Crear cuenta gratis
                <ArrowRight className="w-4 h-4 shrink-0" />
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="min-h-[48px] px-5 sm:px-6 py-3 rounded-xl bg-white hover:bg-zinc-100 dark:bg-[#161926] dark:hover:bg-white/[0.08] border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white text-sm font-semibold inline-flex items-center justify-center transition-colors whitespace-nowrap cursor-pointer"
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={onExploreGuest}
                className="min-h-[48px] px-4 py-3 rounded-xl text-sm font-semibold text-[#6C5CE7] dark:text-[#00B4D8] hover:underline underline-offset-4 inline-flex items-center justify-center whitespace-nowrap cursor-pointer"
              >
                Ver feed público
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-zinc-200 dark:border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="font-display font-bold text-zinc-900 dark:text-zinc-300">
              Viro<span className="text-neon-gradient">klipz</span>
            </span>
            <span>· Red social PWA de klips verticales y transmisiones en vivo</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <a href="#ventajas" className="hover:text-zinc-900 dark:hover:text-zinc-200">
              Ventajas PWA
            </a>
            <a href="#preguntas" className="hover:text-zinc-900 dark:hover:text-zinc-200">
              Preguntas
            </a>
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
            >
              Términos de Uso
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-zinc-900 dark:hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
            >
              Política de Privacidad
            </button>
            <PWAInstallButton compact />
          </div>
        </div>
      </footer>

      {/* Auth Modal (Crear cuenta / Iniciar sesión) */}
      {authMode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 space-y-5 my-auto shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
                  {authMode === 'signup' ? 'Crear cuenta en Viroklipz' : 'Iniciar sesión'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {authMode === 'signup'
                    ? 'Completa tus datos para entrar directo a la pantalla Inicio.'
                    : 'Accede con tu correo electrónico o con Google.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthMode(null)}
                aria-label="Cerrar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 dark:bg-[#0F111A] rounded-xl border border-zinc-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode('signup');
                }}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode('login');
                }}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/40 text-xs text-rose-600 dark:text-rose-300 leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    maxLength={MAX_DISPLAY_NAME_LEN}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. Eloy Gabriel"
                    className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={MAX_EMAIL_LEN}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl pl-3.5 pr-11 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[46px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer"
              >
                {submitting
                  ? authMode === 'signup'
                    ? 'Creando cuenta...'
                    : 'Iniciando sesión...'
                  : authMode === 'signup'
                    ? 'Crear cuenta'
                    : 'Iniciar sesión'}
              </button>
            </form>

            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
              <span>o</span>
              <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleGoogleAuth()}
              className="w-full min-h-[44px] px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/15 disabled:opacity-50 text-zinc-900 dark:text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Continuar con Google
            </button>

            <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
              Al continuar aceptas nuestros{' '}
              <button
                type="button"
                onClick={() => setLegalTab('terms')}
                className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Términos de Uso
              </button>{' '}
              y la{' '}
              <button
                type="button"
                onClick={() => setLegalTab('privacy')}
                className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Política de Privacidad
              </button>
              .
            </p>
          </div>
        </div>
      )}

      <LegalModal
        isOpen={legalTab !== null}
        initialTab={legalTab || 'terms'}
        onClose={() => setLegalTab(null)}
      />
    </div>
  );
}
