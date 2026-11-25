import { useEffect, useState, type FormEvent } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import {
  mapAuthErrorMessage,
  resetUserPassword,
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
  onOpenLegal?: (tab: 'terms' | 'privacy') => void;
}

export function AuthModal({
  isOpen,
  initialMode,
  onClose,
  onSuccess,
  onOpenLegal,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authInfo, setAuthInfo] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setAuthError(null);
      setAuthInfo(null);
      setPassword('');
      setShowPassword(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const switchMode = (nextMode: AuthModalMode) => {
    setAuthError(null);
    setAuthInfo(null);
    setMode(nextMode);
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthInfo(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Introduce un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (mode === 'signup' && displayName.trim().length < 2) {
      setAuthError('Escribe tu nombre para crear tu perfil en Viroklipz.');
      return;
    }

    setSubmitting(true);
    try {
      const profile =
        mode === 'signup'
          ? await signUpWithEmail({
              displayName: displayName.trim(),
              email: trimmedEmail,
              password,
            })
          : await signInWithEmail({
              email: trimmedEmail,
              password,
            });
      onSuccess(profile);
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setAuthError(null);
    setAuthInfo(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setAuthError('Escribe tu correo electrónico arriba y luego toca "¿Olvidaste tu contraseña?".');
      return;
    }
    setResettingPassword(true);
    try {
      await resetUserPassword(trimmedEmail);
      setAuthInfo(
        `Te enviamos un enlace para restablecer tu contraseña a ${trimmedEmail}. Revisa tu bandeja o spam.`,
      );
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    setAuthInfo(null);
    setSubmitting(true);
    try {
      const profile = await signInWithGoogle();
      if (profile) {
        onSuccess(profile);
      }
    } catch (err) {
      setAuthError(mapAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

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
                ? 'Completa tus datos o continúa con Google para entrar a Viroklipz.'
                : 'Accede con tu correo electrónico o con tu cuenta de Google.'}
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

        {authInfo && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
            {authInfo}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="space-y-3.5" noValidate>
          {mode === 'signup' && (
            <div>
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
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="auth-password"
                className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300"
              >
                Contraseña
              </label>
              {mode === 'login' && (
                <button
                  type="button"
                  disabled={resettingPassword || submitting}
                  onClick={() => void handleForgotPassword()}
                  className="text-[11px] font-semibold text-[#00B4D8] hover:underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                >
                  {resettingPassword ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                </button>
              )}
            </div>
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

          <button
            type="submit"
            disabled={submitting}
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

        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
          <span>o</span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-white/10" />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleGoogleAuth()}
          className="w-full min-h-[44px] px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/15 disabled:opacity-50 text-zinc-900 dark:text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.09.73-2.48 1.16-4.22 1.16-3.24 0-5.99-2.19-6.97-5.14H1.03v3.14C3.04 21.14 7.21 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.03 14.01c-.25-.73-.39-1.51-.39-2.31s.14-1.58.39-2.31V6.25H1.03C.37 7.57 0 9.05 0 11.7s.37 4.13 1.03 5.45l4-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.79 0 3.4.62 4.67 1.83l3.5-3.5C18.07 1.19 15.3 0 12 0 7.21 0 3.04 2.86 1.03 6.25l4 3.14C6.01 6.94 8.76 4.75 12 4.75Z"
            />
          </svg>
          Continuar con Google
        </button>

        {onOpenLegal && (
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
    </div>
  );
}
