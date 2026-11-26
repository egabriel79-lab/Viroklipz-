import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Eye, EyeOff, ShieldCheck, X } from 'lucide-react';
import {
  mapAuthErrorMessage,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../lib/viroklipzService';
import { MAX_DISPLAY_NAME_LEN, MAX_EMAIL_LEN } from '../lib/validation';
import type { UserProfile } from '../types/viroklipz';

export type AuthModalMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: AuthModalMode;
  onClose: () => void;
  onSuccess: (profile: UserProfile) => void;
  onNotify?: (message: string) => void;
  onOpenLegal?: (tab: 'terms' | 'privacy') => void;
}

export function AuthModal({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
  onNotify,
  onOpenLegal,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ageInput, setAgeInput] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianSurname, setGuardianSurname] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [guardianAuthorized, setGuardianAuthorized] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [localSnackBar, setLocalSnackBar] = useState<string | null>(null);
  const snackTimerRef = useRef<number | null>(null);

  const parsedAge =
    ageInput.trim() === '' ? null : Number.parseInt(ageInput.trim(), 10);
  const isValidAgeNumber =
    parsedAge !== null && Number.isFinite(parsedAge) && parsedAge >= 1 && parsedAge <= 120;
  const isMinor = mode === 'signup' && isValidAgeNumber && parsedAge < 18;

  const triggerSnackBar = (message: string) => {
    if (onNotify) {
      onNotify(message);
      return;
    }
    setLocalSnackBar(message);
    if (snackTimerRef.current) {
      window.clearTimeout(snackTimerRef.current);
    }
    snackTimerRef.current = window.setTimeout(() => {
      setLocalSnackBar(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (snackTimerRef.current) {
        window.clearTimeout(snackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAuthError(null);
      setLocalSnackBar(null);
      setPassword('');
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthModalMode) => {
    setAuthError(null);
    setLocalSnackBar(null);
    setMode(nextMode);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Introduce un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (mode === 'signup') {
      if (displayName.trim().length < 2) {
        setAuthError('Escribe tu nombre para crear tu perfil en Viroklipz.');
        return;
      }
      if (!isValidAgeNumber || parsedAge === null) {
        setAuthError('Ingresa tu edad en años (entre 1 y 120).');
        return;
      }

      if (parsedAge < 18) {
        const cleanGuardianName = guardianName.trim();
        const cleanGuardianSurname = guardianSurname.trim();
        const cleanGuardianId = guardianId.trim();
        if (
          !cleanGuardianName ||
          !cleanGuardianSurname ||
          cleanGuardianId.length < 3 ||
          !guardianAuthorized
        ) {
          const msg = 'Debes contar con la autorización de un tutor legal';
          setAuthError(msg);
          triggerSnackBar(msg);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const profile =
        mode === 'signup' && parsedAge !== null
          ? await signUpWithEmail({
              displayName: displayName.trim(),
              email: trimmedEmail,
              password,
              age: parsedAge,
              guardianData:
                parsedAge < 18
                  ? {
                      name: guardianName.trim(),
                      surname: guardianSurname.trim(),
                      id: guardianId.trim(),
                      authorized: guardianAuthorized,
                    }
                  : undefined,
            })
          : await signInWithEmail({
              email: trimmedEmail,
              password,
            });
      onSuccess(profile);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message === 'Debes contar con la autorización de un tutor legal'
      ) {
        setAuthError(err.message);
        triggerSnackBar(err.message);
      } else {
        setAuthError(mapAuthErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    let overrides: Parameters<typeof signInWithGoogle>[0] | undefined;

    if (mode === 'signup' && ageInput.trim() !== '') {
      if (!isValidAgeNumber || parsedAge === null) {
        setAuthError('Ingresa una edad válida (entre 1 y 120) o déjala vacía para continuar.');
        return;
      }
      if (parsedAge < 18) {
        const cleanGuardianName = guardianName.trim();
        const cleanGuardianSurname = guardianSurname.trim();
        const cleanGuardianId = guardianId.trim();
        if (
          !cleanGuardianName ||
          !cleanGuardianSurname ||
          cleanGuardianId.length < 3 ||
          !guardianAuthorized
        ) {
          const msg = 'Debes contar con la autorización de un tutor legal';
          setAuthError(msg);
          triggerSnackBar(msg);
          return;
        }
        overrides = {
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          age: parsedAge,
          isMinor: true,
          guardianData: {
            name: cleanGuardianName,
            surname: cleanGuardianSurname,
            id: cleanGuardianId,
            authorized: true,
          },
        };
      } else {
        overrides = {
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
          age: parsedAge,
          isMinor: false,
        };
      }
    }

    setGoogleSubmitting(true);
    try {
      const profile = await signInWithGoogle(overrides);
      if (profile) {
        onSuccess(profile);
      }
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const fullGuardianDisplay =
    `${guardianName.trim()} ${guardianSurname.trim()}`.trim() || '[Nombre del tutor]';
  const guardianIdDisplay = guardianId.trim() || '[Cédula]';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-3xl p-6 sm:p-7 space-y-5 my-auto shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              {mode === 'signup' ? 'Crear cuenta en Viroklipz' : 'Iniciar sesión'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {mode === 'signup'
                ? 'Completa tus datos para crear tu cuenta en Viroklipz.'
                : 'Ingresa tu correo electrónico y contraseña para continuar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
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
            onClick={() => switchMode('signup')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'signup'
                ? 'bg-white dark:bg-white text-zinc-950 shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
          >
            Crear cuenta
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              mode === 'login'
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

        <button
          type="button"
          disabled={submitting || googleSubmitting}
          onClick={() => void handleGoogleAuth()}
          className="w-full min-h-[46px] px-4 rounded-xl bg-zinc-100 dark:bg-white text-zinc-950 hover:bg-zinc-200 dark:hover:bg-zinc-100 disabled:opacity-50 border border-zinc-300 dark:border-white/20 text-sm font-semibold flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="w-4 h-4 shrink-0"
          >
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.74-2.49 1.18-4.22 1.18-3.25 0-6-2.19-6.98-5.15H1.01v3.14C3.05 21.2 7.24 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.02 14.02A7.22 7.22 0 0 1 4.64 12c0-.7.13-1.38.38-2.02V6.84H1.01A11.98 11.98 0 0 0 0 12c0 1.93.46 3.76 1.01 5.16l4.01-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.24 0 3.05 2.8 1.01 6.84l4.01 3.14c.98-2.96 3.73-5.23 6.98-5.23Z"
            />
          </svg>
          <span>
            {googleSubmitting
              ? 'Conectando con Google...'
              : mode === 'signup'
                ? 'Registrarse con Google'
                : 'Continuar con Google'}
          </span>
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            o con correo electrónico
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          {mode === 'signup' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="auth-name"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Nombre completo
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  autoComplete="name"
                  maxLength={MAX_DISPLAY_NAME_LEN}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej. Eloy Gabriel"
                  className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-age"
                  className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
                >
                  Edad
                </label>
                <input
                  id="auth-age"
                  type="number"
                  min={1}
                  max={120}
                  step={1}
                  inputMode="numeric"
                  required
                  value={ageInput}
                  onChange={(e) => {
                    const nextVal = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                    setAgeInput(nextVal);
                  }}
                  placeholder="Ej. 18"
                  className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Correo electrónico
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              maxLength={MAX_EMAIL_LEN}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              className="w-full min-h-[44px] bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3.5 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
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

          {/* Sección condicional animada para menores de 18 años */}
          <AnimatePresence initial={false}>
            {isMinor && (
              <motion.div
                key="guardian-section"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="pt-1">
                  <div className="rounded-2xl bg-zinc-50 dark:bg-[#0F111A] border border-[#6C5CE7]/40 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#6C5CE7]/15 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-[#6C5CE7] dark:text-[#8B7CF6]" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-zinc-900 dark:text-white">
                          Autorización de Representante Legal
                        </h3>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Requerida para cuentas de menores de 18 años.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label
                          htmlFor="guardian-name"
                          className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                        >
                          Nombres del representante
                        </label>
                        <input
                          id="guardian-name"
                          type="text"
                          maxLength={60}
                          value={guardianName}
                          onChange={(e) => setGuardianName(e.target.value)}
                          placeholder="Ej. María Elena"
                          className="w-full min-h-[40px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="guardian-surname"
                          className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                        >
                          Apellidos del representante
                        </label>
                        <input
                          id="guardian-surname"
                          type="text"
                          maxLength={60}
                          value={guardianSurname}
                          onChange={(e) => setGuardianSurname(e.target.value)}
                          placeholder="Ej. Pérez Gómez"
                          className="w-full min-h-[40px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="guardian-id"
                        className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 mb-1"
                      >
                        Cédula/DNI
                      </label>
                      <input
                        id="guardian-id"
                        type="text"
                        maxLength={32}
                        value={guardianId}
                        onChange={(e) => setGuardianId(e.target.value)}
                        placeholder="Ej. V-12345678"
                        className="w-full min-h-[40px] bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={guardianAuthorized}
                        onClick={() => setGuardianAuthorized((v) => !v)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                          guardianAuthorized
                            ? 'bg-gradient-to-r from-[#00B4D8] to-[#E84393] border-transparent text-white'
                            : 'bg-white dark:bg-[#161926] border-zinc-300 dark:border-white/25 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                      <span className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                        Yo, <strong className="text-zinc-900 dark:text-white">{fullGuardianDisplay}</strong>, con cédula{' '}
                        <strong className="text-zinc-900 dark:text-white">{guardianIdDisplay}</strong>, en calidad de representante legal, autorizo expresamente el registro del menor en Viroklipz. Asumo total responsabilidad por el contenido publicado y el uso que el menor haga de la plataforma.
                      </span>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={submitting || googleSubmitting}
            className="w-full min-h-[46px] rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            {submitting
              ? mode === 'signup'
                ? 'Creando cuenta...'
                : 'Iniciando sesión...'
              : mode === 'signup'
                ? 'Crear cuenta'
                : 'Iniciar sesión'}
          </button>
        </form>

        {mode === 'signup' && onOpenLegal && (
          <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
            Al continuar aceptas nuestros{' '}
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
            >
              Términos de Uso
            </button>{' '}
            y la{' '}
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
            >
              Política de Privacidad
            </button>
            .
          </p>
        )}
      </div>

      {/* SnackBar fallback si no se provee onNotify */}
      {localSnackBar && (
        <div
          role="status"
          aria-live="assertive"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-3 rounded-xl bg-rose-600 text-white text-xs font-semibold shadow-2xl border border-rose-400/50 max-w-[92vw] text-center"
        >
          {localSnackBar}
        </div>
      )}
    </div>
  );
}
