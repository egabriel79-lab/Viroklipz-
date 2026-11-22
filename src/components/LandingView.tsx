import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  Flame,
  Gauge,
  Heart,
  MessageSquare,
  Music2,
  Play,
  ShieldCheck,
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
    <div className="min-h-[100dvh] bg-[#09090B] text-zinc-100 flex flex-col pb-[env(safe-area-inset-bottom)]">
      {/* Three-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090B]/90 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#inicio"
            className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Viro<span className="text-[#FF3B5C]">klipz</span>
          </a>

          <nav
            aria-label="Secciones principales"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400"
          >
            <a
              href="#formato"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Formato
            </a>
            <a
              href="#studio"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Viroklipz Studio
            </a>
            <a
              href="#comunidad"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Comunidad
            </a>
            <a
              href="#empezar"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Empezar
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#121216] hover:bg-white/10 border border-white/15 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section
          id="inicio"
          className="max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Proposition & Dual Auth CTAs */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <p className="text-xs font-medium text-zinc-400 tracking-wide">
                Video vertical 9:16
                <span className="mx-2 text-zinc-600" aria-hidden="true">·</span>
                Compresión inteligente
                <span className="mx-2 text-zinc-600" aria-hidden="true">·</span>
                Métricas en vivo
              </p>

              <h1
                className="font-display font-extrabold tracking-tight text-white leading-[1.06]"
                style={{
                  fontSize: 'clamp(2.25rem, 4.4vw, 3.75rem)',
                  textWrap: 'balance',
                }}
              >
                Klips verticales hechos para cargar rápido y conectar sin filtros.
              </h1>

              <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
                Graba a pantalla completa, publica con control real de consumo de datos y mide visualizaciones, me gusta y guardados en Viroklipz Studio desde cualquier móvil o escritorio.
              </p>

              {/* Requested Dual Buttons: Iniciar sesión & Crear cuenta */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm sm:text-base font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Crear cuenta
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#121216] hover:bg-white/[0.08] border border-white/15 text-white text-sm sm:text-base font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1 text-xs text-zinc-400">
                <button
                  type="button"
                  onClick={onExploreGuest}
                  className="font-medium text-zinc-300 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
                >
                  Explorar el feed público
                </button>
                <span className="text-zinc-600" aria-hidden="true">·</span>
                <PWAInstallButton compact />
              </div>
            </div>

            {/* Right Interactive Vertical Klip Showcase */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4">
              <div className="relative flex-1 min-h-[430px] sm:min-h-[480px] max-w-[360px] w-full mx-auto rounded-3xl overflow-hidden bg-[#121216] border border-white/10">
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

                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs text-white/85">
                  <span className="capitalize font-medium">
                    {activeClip.category}
                    <span className="mx-1.5 text-white/50">·</span>
                    <span className="font-mono tabular-nums">{activeClip.viewsLabel}</span> vistas
                  </span>
                  <span className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center">
                    <Play className="w-4 h-4 text-white fill-white translate-x-0.5" />
                  </span>
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
                      <Music2 className="w-3.5 h-3.5 text-[#FF3B5C] shrink-0" />
                      <span className="truncate">{activeClip.audioTitle}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums text-white shrink-0 ml-2">
                      <Heart className="w-3.5 h-3.5 text-[#FF3B5C] fill-[#FF3B5C]" />
                      {(activeClip.likesCount / 1000).toFixed(1)}k
                    </span>
                  </div>
                </div>
              </div>

              {/* Interactive Creator Reel Switcher */}
              <div className="max-w-[360px] w-full mx-auto grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#121216] border border-white/10">
                {HERO_SHOWCASE_CLIPS.map((clip, idx) => (
                  <button
                    key={clip.id}
                    type="button"
                    onClick={() => setShowcaseIndex(idx)}
                    className={`min-h-[38px] px-2 rounded-lg text-xs font-medium transition-colors truncate cursor-pointer ${
                      idx === showcaseIndex
                        ? 'bg-white text-zinc-950'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    @{clip.authorUsername.split('.')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4-Column Quantitative Strip */}
          <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white">
                720 kbps
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Modo ahorro de datos al grabar
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white">
                9:16
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Grabación y reproducción a pantalla completa
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white">
                3 métricas
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Visualizaciones, me gusta y guardados en Studio
              </p>
            </div>
            <div>
              <p className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-white">
                4 salas
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                Comunidades en tiempo real por categoría
              </p>
            </div>
          </div>
        </section>

        {/* Asymmetric Editorial Capabilities */}
        <section
          id="formato"
          className="border-t border-white/10 bg-[#0D0D10]"
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Pensado para creadores que priorizan velocidad y claridad
              </h2>
              <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
                Cada pantalla elimina fricciones: desde capturar un klip en un toque hasta revisar el impacto real de cada publicación.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#121216] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <Video className="w-4 h-4 text-[#FF3B5C]" />
                    <span>01. Captura a pantalla completa</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Graba sin ventanas flotantes y publica en dos pasos
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                    Activa tu cámara en formato completo, elige compresión estándar (2.5 Mbps) o ahorro móvil (720 kbps), y pasa directamente a añadir descripción, categoría, etiquetas y ritmo.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-white/10 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Gauge className="w-4 h-4 text-[#FF3B5C]" />
                    Hasta 60 s por klip
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-zinc-400" />
                    Visibilidad pública o privada
                  </span>
                </div>
              </div>

              <div
                id="studio"
                className="lg:col-span-5 bg-[#121216] border border-white/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <BarChart3 className="w-4 h-4 text-[#FF3B5C]" />
                    <span>02. Viroklipz Studio</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Métricas transparentes en tu perfil
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Consulta cuántas visualizaciones, me gusta y guardados acumula cada uno de tus klips y edita tu descripción al instante desde el menú de perfil.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/10">
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-white">142k</p>
                    <p className="text-[11px] text-zinc-500">Vistas</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-white">18.4k</p>
                    <p className="text-[11px] text-zinc-500">Me gusta</p>
                  </div>
                  <div>
                    <p className="font-mono text-lg font-bold tabular-nums text-white">2.1k</p>
                    <p className="text-[11px] text-zinc-500">Guardados</p>
                  </div>
                </div>
              </div>

              <div
                id="comunidad"
                className="lg:col-span-12 bg-[#121216] border border-white/10 rounded-2xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
              >
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <MessageSquare className="w-4 h-4 text-[#FF3B5C]" />
                    <span>03. Salas en tiempo real y rachas</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Conversa por temática y mantén tu racha diaria
                  </h3>
                  <p className="text-sm text-zinc-400 leading-relaxed max-w-xl">
                    Únete a las salas de General, Música, Baile y Cocina. Cada klip publicado, comentario o mensaje activo suma a tu racha diaria dentro de Viroklipz.
                  </p>
                </div>

                <div className="md:col-span-5 flex flex-wrap md:justify-end gap-4 text-xs text-zinc-300">
                  <div className="px-4 py-3 rounded-xl bg-[#09090B] border border-white/10 flex items-center gap-2.5">
                    <Flame className="w-4 h-4 text-[#FF3B5C]" />
                    <span>Racha diaria sincronizada</span>
                  </div>
                  <div className="px-4 py-3 rounded-xl bg-[#09090B] border border-white/10 flex items-center gap-2.5">
                    <Eye className="w-4 h-4 text-zinc-400" />
                    <span>Reproductor limpio sin distracciones</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final Conversion Section */}
        <section id="empezar" className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-2 max-w-xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                Tu espacio en Viroklipz está listo
              </h2>
              <p className="text-sm sm:text-base text-zinc-400">
                Crea tu cuenta con correo electrónico y contraseña o entra con Google para empezar directo en la pantalla Inicio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#121216] hover:bg-white/[0.08] border border-white/15 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Iniciar sesión
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-zinc-300">
              Viro<span className="text-[#FF3B5C]">klipz</span>
            </span>
            <span>· Red social de klips verticales</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
            >
              Términos de Uso
            </button>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-zinc-200 underline underline-offset-4 cursor-pointer"
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
          <div className="w-full max-w-md bg-[#121216] border border-white/10 rounded-3xl p-6 sm:p-7 space-y-5 my-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {authMode === 'signup' ? 'Crear cuenta en Viroklipz' : 'Iniciar sesión'}
                </h2>
                <p className="text-xs text-zinc-400">
                  {authMode === 'signup'
                    ? 'Completa tus datos para entrar directo a la pantalla Inicio.'
                    : 'Accede con tu correo electrónico o con Google.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthMode(null)}
                aria-label="Cerrar"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode('signup');
                }}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'signup' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
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
                  authMode === 'login' ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Iniciar sesión
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-xs text-[#FF8A9E] leading-relaxed">
                {authError}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {authMode === 'signup' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-semibold text-zinc-300 mb-1.5">
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
                    className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-semibold text-zinc-300 mb-1.5">
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
                  className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-zinc-300 mb-1.5">
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
                    className="w-full min-h-[44px] bg-zinc-900 border border-white/10 focus:border-[#FF3B5C] rounded-xl pl-3.5 pr-11 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[46px] rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
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
              <span className="h-px flex-1 bg-white/10" />
              <span>o</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleGoogleAuth()}
              className="w-full min-h-[44px] px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Continuar con Google
            </button>

            <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
              Al continuar aceptas nuestros{' '}
              <button
                type="button"
                onClick={() => setLegalTab('terms')}
                className="text-zinc-300 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                Términos de Uso
              </button>{' '}
              y la{' '}
              <button
                type="button"
                onClick={() => setLegalTab('privacy')}
                className="text-zinc-300 hover:text-white underline underline-offset-2 cursor-pointer"
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
