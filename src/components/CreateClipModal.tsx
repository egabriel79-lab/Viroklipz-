import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Film,
  Lock,
  Music2,
  Radio,
  RotateCcw,
  Square,
  Upload,
  Video,
  X,
} from 'lucide-react';
import { VISUAL_PRESETS } from '../data/starterClips';
import { AUDIO_PRESET_OPTIONS } from '../lib/audioEngine';
import {
  ALLOWED_CATEGORIES,
  MAX_AUDIO_TITLE_LEN,
  parseHashtags,
  validateClipMediaFile,
  validateClipPayload,
} from '../lib/validation';
import type {
  AudioPreset,
  ClipCategory,
  ClipVisibility,
  UserProfile,
} from '../types/viroklipz';
import { GoLiveScreen } from './GoLiveScreen';

interface CreateClipModalProps {
  isOpen: boolean;
  initialMode?: 'video' | 'preset' | 'live';
  currentUser: UserProfile | null;
  defaultDataSaver?: boolean;
  onClose: () => void;
  onRequestSignIn: () => void;
  onPublish: (input: {
    caption: string;
    category: ClipCategory;
    hashtags: string[];
    audioTitle: string;
    audioPreset: AudioPreset;
    visualPreset: string;
    durationSec: number;
    visibility: ClipVisibility;
    mediaBlob?: Blob | null;
    mediaBytes?: Uint8Array | null;
    mediaMimeType?: string;
  }) => Promise<void>;
}

const RECORD_DURATION_OPTIONS = [10, 15, 30, 60] as const;
type RecordDurationOption = (typeof RECORD_DURATION_OPTIONS)[number];

const MIN_LIVE_FOLLOWERS = 1000;

const CATEGORY_LABELS: Record<ClipCategory, string> = {
  general: 'General',
  baile: 'Baile',
  musica: 'Música',
  cocina: 'Cocina',
  deportes: 'Deportes',
  arte: 'Arte',
  comedia: 'Comedia',
  viajes: 'Viajes',
};

function formatTimerClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function CreateClipModal({
  isOpen,
  initialMode = 'video',
  currentUser,
  defaultDataSaver = false,
  onClose,
  onRequestSignIn,
  onPublish,
}: CreateClipModalProps) {
  const [step, setStep] = useState<'capture' | 'details'>('capture');
  const [mode, setMode] = useState<'video' | 'preset' | 'live'>(initialMode);
  const [lowBitrateCapture, setLowBitrateCapture] = useState(defaultDataSaver);
  const [selectedMaxDuration, setSelectedMaxDuration] = useState<RecordDurationOption>(15);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<ClipCategory | ''>('');
  const [hashtagsRaw, setHashtagsRaw] = useState('');
  const [audioPreset, setAudioPreset] = useState<AudioPreset>('urban_beat');
  const [audioTitle, setAudioTitle] = useState('');
  const [visualPreset, setVisualPreset] = useState(VISUAL_PRESETS[0].imageUrl);
  const [durationSec, setDurationSec] = useState(15);
  const [visibility, setVisibility] = useState<ClipVisibility>('public');

  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
  const [mediaBytes, setMediaBytes] = useState<Uint8Array | null>(null);
  const [mediaMimeType, setMediaMimeType] = useState<string>('video/mp4');
  const [mediaKind, setMediaKind] = useState<'video' | 'image'>('video');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setIsRecording(false);
  }, []);

  const startCamera = useCallback(
    async (silentIfDenied: boolean) => {
      setErrorMsg(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!silentIfDenied) {
          setErrorMsg(
            'Tu navegador no permite acceso a la cámara. Puedes subir un archivo o usar una escena visual.',
          );
        }
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', aspectRatio: 9 / 16 },
          audio: true,
        });
        streamRef.current = stream;
        setCameraActive(true);
        setMediaBlob(null);
        setMediaBytes(null);
        setMediaKind('video');
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        window.setTimeout(() => {
          if (liveVideoRef.current) {
            liveVideoRef.current.srcObject = stream;
            void liveVideoRef.current.play();
          }
        }, 60);
      } catch {
        if (!silentIfDenied) {
          setErrorMsg(
            'No se pudo acceder a la cámara o micrófono. Revisa los permisos o sube un archivo.',
          );
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('capture');
      setMode('video');
      setErrorMsg(null);
      return;
    }
    setMode(initialMode);
    setLowBitrateCapture(defaultDataSaver);
    if (currentUser && initialMode === 'video' && step === 'capture' && !previewUrl) {
      void startCamera(true);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, initialMode, currentUser, defaultDataSaver, stopCamera]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFilePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateClipMediaFile(file);
    if (!check.ok) {
      setErrorMsg(check.message);
      return;
    }
    stopCamera();
    setErrorMsg(null);
    try {
      // Materialize file bytes immediately as Uint8Array to eliminate InvalidBlob errors in browser IndexedDB/uploads
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.byteLength <= 0) {
        setErrorMsg('No se pudieron leer los bytes del archivo seleccionado.');
        return;
      }
      const standaloneBlob = new Blob([buffer], { type: check.mimeType });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(standaloneBlob);
      setMediaBytes(bytes);
      setMediaMimeType(check.mimeType);
      setMediaKind(check.kind);
      setMediaBlob(standaloneBlob);
      setPreviewUrl(url);
      if (check.kind === 'image') {
        setDurationSec(selectedMaxDuration);
      }
      setStep('details');
    } catch {
      setErrorMsg('No se pudo procesar el archivo seleccionado. Inténtalo con otro archivo.');
    }
  };

  const handleToggleRecording = () => {
    if (!streamRef.current) return;
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const maxDurationForRun = selectedMaxDuration;
    chunksRef.current = [];
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: lowBitrateCapture ? 720_000 : 2_500_000,
    };
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(streamRef.current, options);
    } catch {
      recorder = new MediaRecorder(streamRef.current);
    }
    recorderRef.current = recorder;

    let latestSeconds = 0;
    recorder.ondataavailable = (ev) => {
      if (ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };
    recorder.onstop = () => {
      const mimeType = recorder.mimeType || 'video/webm';
      const rawBlob = new Blob(chunksRef.current, { type: mimeType });
      if (rawBlob.size > 0) {
        void rawBlob
          .arrayBuffer()
          .then((buffer) => {
            const bytes = new Uint8Array(buffer);
            const safeBlob = new Blob([buffer], { type: mimeType });
            const url = URL.createObjectURL(safeBlob);
            setMediaBytes(bytes);
            setMediaMimeType(mimeType);
            setMediaKind('video');
            setMediaBlob(safeBlob);
            setPreviewUrl(url);
            setDurationSec(Math.max(3, Math.min(maxDurationForRun, latestSeconds || maxDurationForRun)));
            setStep('details');
          })
          .catch(() => {
            setErrorMsg('Error al guardar los datos de la grabación.');
          });
      }
      stopCamera();
    };

    setRecordSeconds(0);
    setIsRecording(true);
    recorder.start(250);
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => {
        const next = s + 1;
        latestSeconds = next;
        if (next >= maxDurationForRun) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          if (recorder.state !== 'inactive') {
            recorder.stop();
          }
          return maxDurationForRun;
        }
        return next;
      });
    }, 1000);
  };

  const handleResetCapture = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMediaBlob(null);
    setMediaBytes(null);
    setMediaKind('video');
    setStep('capture');
    if (mode === 'video') {
      void startCamera(true);
    }
  };

  const handleProceedToDetails = () => {
    stopCamera();
    setErrorMsg(null);
    setStep('details');
  };

  const handleSelectLiveMode = () => {
    stopCamera();
    setErrorMsg(null);
    setMode('live');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    const resolvedCategory: ClipCategory = category || 'general';
    const resolvedVisibility: ClipVisibility = visibility || 'public';
    const resolvedAudioTitle = audioTitle.trim() || 'Audio original';
    const check = validateClipPayload({
      caption,
      audioTitle: resolvedAudioTitle,
      category: resolvedCategory,
      audioPreset,
      durationSec,
    });
    if (!check.ok) {
      setErrorMsg(check.message);
      return;
    }

    setErrorMsg(null);
    setPublishing(true);
    try {
      await onPublish({
        caption: caption.trim(),
        category: resolvedCategory,
        hashtags: parseHashtags(hashtagsRaw),
        audioTitle: resolvedAudioTitle,
        audioPreset,
        visualPreset,
        durationSec,
        visibility: resolvedVisibility,
        mediaBlob: mode === 'video' ? mediaBlob : null,
        mediaBytes: mode === 'video' ? mediaBytes : null,
        mediaMimeType: mode === 'video' ? mediaMimeType : undefined,
      });
      setCaption('');
      setCategory('');
      setHashtagsRaw('');
      setAudioTitle('');
      setVisibility('public');
      setMediaBlob(null);
      setMediaBytes(null);
      setMediaKind('video');
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setStep('capture');
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Error al publicar el klip. Verifica tu conexión.',
      );
    } finally {
      setPublishing(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-[#0F111A] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 h-14 flex items-center justify-between border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622]">
          <span className="font-display text-lg font-bold text-zinc-900 dark:text-white">Crear klip</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Video className="w-11 h-11 text-[#6C5CE7]" />
          <h2 className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
            Inicia sesión para publicar en Viroklipz
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 max-w-md">
            Conecta tu cuenta para grabar a pantalla completa, subir videos y publicar klips en la comunidad.
          </p>
          <button
            type="button"
            onClick={onRequestSignIn}
            className="min-h-[46px] px-6 py-3 rounded-xl bg-neon-cta text-white text-sm font-semibold transition-all cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const followersCount = currentUser.followersCount ?? 0;
  const canGoLive = followersCount >= MIN_LIVE_FOLLOWERS;

  if (mode === 'live') {
    if (!canGoLive) {
      const progressPct = Math.min(100, Math.round((followersCount / MIN_LIVE_FOLLOWERS) * 100));
      return (
        <div className="fixed inset-0 z-50 bg-zinc-50 dark:bg-[#0F111A] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          <div className="px-4 h-14 flex items-center justify-between border-b border-zinc-200 dark:border-white/10 bg-white dark:bg-[#131622]">
            <button
              type="button"
              onClick={() => setMode('video')}
              className="min-h-[40px] px-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-white/5 text-sm font-semibold text-zinc-700 dark:text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
            <span className="font-display text-base font-bold text-zinc-900 dark:text-white">Transmitir en vivo</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-sm w-full bg-white dark:bg-[#161926] border border-zinc-200 dark:border-white/10 rounded-2xl p-6 space-y-5 shadow-lg dark:shadow-none">
              <div className="w-14 h-14 rounded-2xl bg-[#6C5CE7]/15 border border-[#6C5CE7]/35 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 text-[#6C5CE7] dark:text-[#8B7CF6]" />
              </div>
              <div className="space-y-2">
                <h2 className="font-display text-xl font-bold text-zinc-900 dark:text-white">
                  Live disponible con 1,000 seguidores
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Necesitas al menos 1,000 seguidores en tu perfil de Viroklipz para desbloquear las transmisiones en vivo.
                </p>
              </div>

              <div className="space-y-2 text-left bg-zinc-100 dark:bg-[#0F111A] border border-zinc-200 dark:border-white/10 rounded-xl p-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Tu progreso actual</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-white tabular-nums">
                    {followersCount.toLocaleString('es-ES')} / 1,000
                  </span>
                </div>
                <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6C5CE7] to-[#00B4D8] transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMode('video');
                  if (!previewUrl) void startCamera(true);
                }}
                className="w-full min-h-[46px] px-5 rounded-xl bg-neon-cta text-white text-sm font-semibold transition-all cursor-pointer"
              >
                Grabar o subir un klip
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <GoLiveScreen
        currentUser={currentUser}
        onBack={() => {
          setMode('video');
          if (!previewUrl) void startCamera(true);
        }}
        onClose={onClose}
      />
    );
  }

  const remainingSeconds = Math.max(0, selectedMaxDuration - recordSeconds);

  // Step 1: Full-Screen Capture / Media Stage (No floating boxes)
  if (step === 'capture') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
        {/* Full-bleed Media / Camera Stage */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {mode === 'video' ? (
            cameraActive ? (
              <video
                ref={liveVideoRef}
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : previewUrl ? (
              mediaKind === 'image' ? (
                <img
                  src={previewUrl}
                  alt="Vista previa de imagen seleccionada"
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={previewUrl}
                  autoPlay
                  loop
                  playsInline
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 60) {
                      setErrorMsg('El video supera los 60 segundos máximos permitidos.');
                      handleResetCapture();
                      return;
                    }
                    if (Number.isFinite(d) && d >= 3) {
                      setDurationSec(Math.min(60, Math.round(d)));
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full bg-[#0F111A] flex flex-col items-center justify-center p-6 text-center space-y-5">
                <Film className="w-11 h-11 text-[#6C5CE7]" />
                <div className="space-y-1.5 max-w-xs">
                  <h2 className="font-display text-xl font-bold text-white">
                    Graba o elige tu archivo
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Elige la duración (10s, 15s, 30s o 60s), sube un video o imagen desde tu dispositivo, o transmite en vivo.
                  </p>
                </div>

                {errorMsg && (
                  <p className="max-w-xs text-xs text-rose-200 bg-[#E84393]/15 border border-[#E84393]/40 rounded-xl px-3.5 py-2.5">
                    {errorMsg}
                  </p>
                )}

                <div className="w-full max-w-xs flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => void startCamera(false)}
                    className="min-h-[48px] px-5 rounded-xl bg-neon-cta text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Activar cámara
                  </button>

                  <label className="min-h-[48px] px-5 rounded-xl bg-[#161926] hover:bg-white/10 border border-[#00B4D8]/35 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4 text-[#00B4D8]" />
                    Subir video o imagen
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={(ev) => void handleFilePick(ev)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSelectLiveMode}
                    className="min-h-[48px] px-5 rounded-xl bg-[#6C5CE7]/15 hover:bg-[#6C5CE7]/25 border border-[#6C5CE7]/45 text-[#A29BFE] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Radio className="w-4 h-4" />
                    Transmitir en vivo
                  </button>
                </div>
              </div>
            )
          ) : (
            <img
              src={visualPreset}
              alt="Escena seleccionada"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          )}

          {/* Subtle Top & Bottom Scrims */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/35 to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
          />

          {/* Top Full-Screen Edge Bar */}
          <div className="absolute top-0 inset-x-0 z-20 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar estudio de creación"
              className="min-h-[44px] min-w-[44px] rounded-full bg-black/45 hover:bg-black/70 backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-black/55 backdrop-blur-md border border-white/15">
              <button
                type="button"
                onClick={() => {
                  setMode('video');
                  if (!previewUrl) void startCamera(true);
                }}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'video' ? 'bg-white text-zinc-950' : 'text-zinc-200 hover:text-white'
                }`}
              >
                Cámara
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setMode('preset');
                }}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'preset' ? 'bg-white text-zinc-950' : 'text-zinc-200 hover:text-white'
                }`}
              >
                Escena
              </button>
              <button
                type="button"
                onClick={handleSelectLiveMode}
                className="min-h-[34px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer text-red-400 hover:text-red-300 inline-flex items-center gap-1"
              >
                <Radio className="w-3.5 h-3.5" />
                En vivo
              </button>
            </div>

            {mode === 'video' ? (
                <button
                  type="button"
                  onClick={() => setLowBitrateCapture((v) => !v)}
                  className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-semibold backdrop-blur-md border transition-colors whitespace-nowrap cursor-pointer ${
                    lowBitrateCapture
                      ? 'bg-[#00B4D8] border-[#00B4D8] text-[#0F111A]'
                      : 'bg-[#0F111A]/65 border-white/15 text-zinc-200'
                  }`}
                >
                  {lowBitrateCapture ? '720 kbps' : '2.5 Mbps'}
                </button>
              ) : (
                <div className="w-[44px]" />
              )}
          </div>

          {/* Bottom Full-Screen Controls */}
          <div className="absolute bottom-0 inset-x-0 z-20 px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
            {mode === 'video' ? (
              cameraActive ? (
                <div className="flex flex-col items-center gap-3">
                  {/* Visual Countdown Timer */}
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0F111A]/85 border border-rose-500/40 backdrop-blur-md">
                    <span
                      className={`w-2 h-2 rounded-full bg-rose-500 ${
                        isRecording ? 'animate-pulse' : ''
                      }`}
                    />
                    <span className="font-mono text-sm font-bold tabular-nums text-rose-400">
                      {isRecording
                        ? formatTimerClock(remainingSeconds)
                        : formatTimerClock(selectedMaxDuration)}
                    </span>
                  </div>

                  {/* Duration Selector Buttons: 10s, 15s, 30s, 60s */}
                  <div
                    role="group"
                    aria-label="Duración máxima de grabación"
                    className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F111A]/75 backdrop-blur-md border border-white/15"
                  >
                    {RECORD_DURATION_OPTIONS.map((sec) => {
                      const active = selectedMaxDuration === sec;
                      return (
                        <button
                          key={sec}
                          type="button"
                          disabled={isRecording}
                          onClick={() => setSelectedMaxDuration(sec)}
                          className={`min-h-[32px] px-3 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                            active
                              ? 'bg-[#6C5CE7] text-white'
                              : 'text-zinc-300 hover:text-white'
                          }`}
                        >
                          {sec}s
                        </button>
                      );
                    })}
                  </div>

                  <div className="w-full max-w-sm flex items-center justify-between gap-4">
                    <label className="min-h-[44px] px-3.5 rounded-xl bg-[#0F111A]/70 hover:bg-[#0F111A]/90 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <Upload className="w-4 h-4 text-[#00B4D8]" />
                      Subir
                      <input
                        type="file"
                        accept="video/*,image/*"
                        onChange={(ev) => void handleFilePick(ev)}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleToggleRecording}
                      aria-label={isRecording ? 'Detener y continuar' : 'Grabar klip'}
                      className={`w-18 h-18 rounded-full border-4 border-white flex items-center justify-center transition-transform cursor-pointer ${
                        isRecording ? 'bg-[#E84393] scale-95' : 'bg-[#E84393] hover:scale-105'
                      }`}
                    >
                      {isRecording ? <Square className="w-6 h-6 fill-white text-white" /> : null}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setMode('preset');
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#0F111A]/70 hover:bg-[#0F111A]/90 backdrop-blur-md border border-white/15 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                    >
                      Escenas
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="max-w-md mx-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleResetCapture}
                    className="min-h-[48px] px-4 rounded-xl bg-[#0F111A]/75 hover:bg-[#0F111A] backdrop-blur-md border border-white/20 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Regrabar
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToDetails}
                    className="flex-1 min-h-[48px] px-6 rounded-xl bg-neon-cta text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : null
            ) : (
              <div className="max-w-md mx-auto space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {VISUAL_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setVisualPreset(preset.imageUrl)}
                      title={preset.label}
                      className={`aspect-[9/14] rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        visualPreset === preset.imageUrl
                          ? 'border-[#00B4D8] scale-[1.03]'
                          : 'border-white/20 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={preset.imageUrl}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleProceedToDetails}
                  className="w-full min-h-[48px] px-6 rounded-xl bg-neon-cta text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Full-Screen Details & "Publicar klip" Screen
  return (
    <div className="fixed inset-0 z-50 bg-[#0F111A] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="min-h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 sm:px-6 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#131622]">
        <button
          type="button"
          onClick={() => setStep('capture')}
          className="min-h-[44px] px-2.5 rounded-xl hover:bg-white/5 text-sm font-semibold text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Atrás
        </button>

        <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
          Publicar klip
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
          <div className="max-w-xl mx-auto space-y-4">
            {/* Compact Clip Summary */}
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#161926] border border-white/10">
              <div className="w-14 aspect-[9/14] rounded-xl overflow-hidden bg-[#0F111A] border border-white/10 shrink-0">
                {mode === 'video' && previewUrl ? (
                  mediaKind === 'image' ? (
                    <img
                      src={previewUrl}
                      alt="Vista previa de imagen"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={previewUrl}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <img
                    src={visualPreset}
                    alt="Vista previa del klip"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold text-white">
                  {mode === 'video' && previewUrl
                    ? mediaKind === 'image'
                      ? 'Imagen lista para publicar'
                      : 'Video listo para publicar'
                    : 'Escena visual + audio'}
                </p>
                <p className="text-xs text-zinc-400 font-mono tabular-nums">
                  {durationSec} s · {lowBitrateCapture ? 'Ahorro 720 kbps' : 'Estándar 2.5 Mbps'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetCapture}
                className="min-h-[38px] px-3 rounded-lg bg-[#0F111A] hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-200 shrink-0 cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#E84393]/15 border border-[#E84393]/40 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="klip-caption" className="text-xs font-semibold text-zinc-300">
                  Descripción
                </label>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {caption.length > 0 ? `${caption.length} car.` : 'Opcional'}
                </span>
              </div>
              <textarea
                id="klip-caption"
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Escribe una descripción para tu klip..."
                className="w-full bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="klip-category" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Categoría
                </label>
                <select
                  id="klip-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ClipCategory | '')}
                  className="w-full min-h-[44px] bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-sm text-white focus:outline-none"
                >
                  <option value="">General (por defecto)</option>
                  {ALLOWED_CATEGORIES.filter((cat) => cat !== 'general').map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="klip-visibility" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Visibilidad
                </label>
                <select
                  id="klip-visibility"
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ClipVisibility)}
                  className="w-full min-h-[44px] bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-sm text-white focus:outline-none"
                >
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="klip-hashtags" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Etiquetas (opcional)
              </label>
              <input
                id="klip-hashtags"
                type="text"
                value={hashtagsRaw}
                onChange={(e) => setHashtagsRaw(e.target.value)}
                placeholder="Ej. #ofimatica #tutorial"
                className="w-full min-h-[44px] bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="klip-audio-preset" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Ritmo / Beat
                </label>
                <div className="relative">
                  <Music2 className="w-4 h-4 text-[#00B4D8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="klip-audio-preset"
                    value={audioPreset}
                    onChange={(e) => setAudioPreset(e.target.value as AudioPreset)}
                    className="w-full min-h-[44px] bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl pl-9 pr-3 text-sm text-white focus:outline-none"
                  >
                    {AUDIO_PRESET_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="klip-audio-title" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Nombre del audio
                </label>
                <input
                  id="klip-audio-title"
                  type="text"
                  maxLength={MAX_AUDIO_TITLE_LEN}
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  placeholder="Opcional: nombre del audio"
                  className="w-full min-h-[44px] bg-[#161926] border border-white/10 focus:border-[#00B4D8] rounded-xl px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Publish Bar */}
        <div className="border-t border-white/10 bg-[#0F111A]/95 backdrop-blur-md px-4 sm:px-6 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shrink-0">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-xl border border-white/15 bg-[#161926] hover:bg-white/10 text-zinc-100 text-sm font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={publishing}
              className="flex-1 min-h-[48px] px-6 rounded-xl bg-neon-cta disabled:opacity-50 text-white text-sm font-semibold transition-all cursor-pointer shadow-lg shadow-[#E84393]/25"
            >
              {publishing ? 'Publicando...' : 'Publicar klip'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
