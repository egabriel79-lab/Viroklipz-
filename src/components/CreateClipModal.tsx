import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Film,
  Music2,
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
  MAX_CAPTION_LEN,
  parseHashtags,
  validateClipPayload,
  validateVideoFile,
} from '../lib/validation';
import type {
  AudioPreset,
  ClipCategory,
  ClipVisibility,
  UserProfile,
} from '../types/viroklipz';

interface CreateClipModalProps {
  isOpen: boolean;
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
  }) => Promise<void>;
}

const CATEGORY_LABELS: Record<ClipCategory, string> = {
  baile: 'Baile',
  musica: 'Música',
  cocina: 'Cocina',
  deportes: 'Deportes',
  arte: 'Arte',
  comedia: 'Comedia',
  viajes: 'Viajes',
};

export function CreateClipModal({
  isOpen,
  currentUser,
  defaultDataSaver = false,
  onClose,
  onRequestSignIn,
  onPublish,
}: CreateClipModalProps) {
  const [step, setStep] = useState<'capture' | 'details'>('capture');
  const [mode, setMode] = useState<'video' | 'preset'>('video');
  const [lowBitrateCapture, setLowBitrateCapture] = useState(defaultDataSaver);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<ClipCategory | ''>('');
  const [hashtagsRaw, setHashtagsRaw] = useState('');
  const [audioPreset, setAudioPreset] = useState<AudioPreset>('urban_beat');
  const [audioTitle, setAudioTitle] = useState('');
  const [visualPreset, setVisualPreset] = useState(VISUAL_PRESETS[0].imageUrl);
  const [durationSec, setDurationSec] = useState(15);
  const [visibility, setVisibility] = useState<ClipVisibility>('public');

  const [mediaBlob, setMediaBlob] = useState<Blob | null>(null);
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
            'Tu navegador no permite acceso a la cámara. Puedes subir un video o usar una escena visual.',
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
      setErrorMsg(null);
      return;
    }
    setLowBitrateCapture(defaultDataSaver);
    if (currentUser && mode === 'video' && step === 'capture' && !previewUrl) {
      void startCamera(true);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, currentUser, defaultDataSaver, stopCamera]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!isOpen) return null;

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const check = validateVideoFile(file);
    if (!check.ok) {
      setErrorMsg(check.message);
      return;
    }
    stopCamera();
    setErrorMsg(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setMediaBlob(file);
    setPreviewUrl(url);
    setStep('details');
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
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setMediaBlob(blob);
        setPreviewUrl(url);
        setDurationSec(Math.max(3, Math.min(60, latestSeconds || 5)));
        setStep('details');
      }
      stopCamera();
    };

    setRecordSeconds(0);
    setIsRecording(true);
    recorder.start(250);
    timerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => {
        latestSeconds = s + 1;
        if (s >= 59) {
          recorder.stop();
          return 60;
        }
        return s + 1;
      });
    }, 1000);
  };

  const handleResetCapture = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMediaBlob(null);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequestSignIn();
      return;
    }

    if (!category) {
      setErrorMsg('Selecciona una categoría para tu klip.');
      return;
    }

    const resolvedAudioTitle = audioTitle.trim() || 'Audio original';
    const check = validateClipPayload({
      caption,
      audioTitle: resolvedAudioTitle,
      category,
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
        category,
        hashtags: parseHashtags(hashtagsRaw),
        audioTitle: resolvedAudioTitle,
        audioPreset,
        visualPreset,
        durationSec,
        visibility,
        mediaBlob: mode === 'video' ? mediaBlob : null,
      });
      setCaption('');
      setCategory('');
      setHashtagsRaw('');
      setAudioTitle('');
      setVisibility('public');
      setMediaBlob(null);
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
      <div className="fixed inset-0 z-50 bg-[#09090B] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="px-4 h-14 flex items-center justify-between border-b border-white/10">
          <span className="font-display text-lg font-bold text-white">Crear klip</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <Video className="w-11 h-11 text-[#FF3B5C]" />
          <h2 className="font-display text-2xl font-bold text-white">
            Inicia sesión para publicar en Viroklipz
          </h2>
          <p className="text-sm text-zinc-400 max-w-md">
            Conecta tu cuenta para grabar a pantalla completa, subir videos y publicar klips en la comunidad.
          </p>
          <button
            type="button"
            onClick={onRequestSignIn}
            className="min-h-[46px] px-6 py-3 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

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
            ) : (
              <div className="w-full h-full bg-[#09090B] flex flex-col items-center justify-center p-6 text-center space-y-5">
                <Film className="w-11 h-11 text-zinc-500" />
                <div className="space-y-1.5 max-w-xs">
                  <h2 className="font-display text-xl font-bold text-white">
                    Graba o elige tu video
                  </h2>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Captura hasta 60 segundos a pantalla completa o sube un archivo vertical desde tu galería.
                  </p>
                </div>

                {errorMsg && (
                  <p className="max-w-xs text-xs text-[#FF8A9E] bg-[#FF3B5C]/10 border border-[#FF3B5C]/30 rounded-xl px-3.5 py-2.5">
                    {errorMsg}
                  </p>
                )}

                <div className="w-full max-w-xs flex flex-col gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => void startCamera(false)}
                    className="min-h-[48px] px-5 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Activar cámara
                  </button>

                  <label className="min-h-[48px] px-5 rounded-xl bg-[#121216] hover:bg-white/10 border border-white/15 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Subir video
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFilePick}
                      className="hidden"
                    />
                  </label>
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
            className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/45 to-transparent"
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
            </div>

            {mode === 'video' ? (
              <button
                type="button"
                onClick={() => setLowBitrateCapture((v) => !v)}
                className={`min-h-[36px] px-2.5 rounded-xl text-[11px] font-semibold backdrop-blur-md border transition-colors whitespace-nowrap cursor-pointer ${
                  lowBitrateCapture
                    ? 'bg-[#FF3B5C]/90 border-[#FF3B5C] text-white'
                    : 'bg-black/50 border-white/15 text-zinc-200'
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
                  {isRecording && (
                    <span className="font-mono text-xs tabular-nums px-3 py-1 rounded-lg bg-black/75 border border-white/15 text-[#FF3B5C]">
                      REC {String(recordSeconds).padStart(2, '0')}s
                    </span>
                  )}

                  <div className="w-full max-w-sm flex items-center justify-between gap-4">
                    <label className="min-h-[44px] px-3.5 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <Upload className="w-4 h-4" />
                      Subir
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFilePick}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleToggleRecording}
                      aria-label={isRecording ? 'Detener y continuar' : 'Grabar klip'}
                      className={`w-18 h-18 rounded-full border-4 border-white flex items-center justify-center transition-transform cursor-pointer ${
                        isRecording ? 'bg-[#FF3B5C] scale-95' : 'bg-[#FF3B5C] hover:scale-105'
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
                      className="min-h-[44px] px-3.5 rounded-xl bg-black/55 hover:bg-black/75 backdrop-blur-md border border-white/15 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
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
                    className="min-h-[48px] px-4 rounded-xl bg-black/65 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Regrabar
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToDetails}
                    className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
                          ? 'border-[#FF3B5C] scale-[1.03]'
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
                  className="w-full min-h-[48px] px-6 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
    <div className="fixed inset-0 z-50 bg-[#09090B] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="min-h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] px-4 sm:px-6 border-b border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#0D0D10]">
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
            <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#121216] border border-white/10">
              <div className="w-14 aspect-[9/14] rounded-xl overflow-hidden bg-zinc-900 border border-white/10 shrink-0">
                {mode === 'video' && previewUrl ? (
                  <video
                    src={previewUrl}
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
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
                  {mode === 'video' && previewUrl ? 'Video listo para publicar' : 'Escena visual + audio'}
                </p>
                <p className="text-xs text-zinc-400 font-mono tabular-nums">
                  {durationSec} s · {lowBitrateCapture ? 'Ahorro 720 kbps' : 'Estándar 2.5 Mbps'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetCapture}
                className="min-h-[38px] px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 shrink-0 cursor-pointer"
              >
                Cambiar
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FF3B5C]/10 border border-[#FF3B5C]/40 text-xs text-[#FF8A9E]">
                {errorMsg}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="klip-caption" className="text-xs font-semibold text-zinc-300">
                  Descripción
                </label>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">
                  {caption.length}/{MAX_CAPTION_LEN}
                </span>
              </div>
                <textarea
                  id="klip-caption"
                  rows={3}
                  maxLength={MAX_CAPTION_LEN}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escribe una descripción para tu klip..."
                  className="w-full bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl p-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none resize-none"
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
                  className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3 text-sm text-white focus:outline-none"
                >
                  <option value="">Selecciona una categoría</option>
                  {ALLOWED_CATEGORIES.map((cat) => (
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
                  className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3 text-sm text-white focus:outline-none"
                >
                  <option value="public">Público</option>
                  <option value="private">Privado</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="klip-hashtags" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Etiquetas (máx. 8)
              </label>
              <input
                id="klip-hashtags"
                type="text"
                value={hashtagsRaw}
                onChange={(e) => setHashtagsRaw(e.target.value)}
                placeholder="Ej. #ofimatica #tutorial"
                className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="klip-audio-preset" className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Ritmo / Beat
                </label>
                <div className="relative">
                  <Music2 className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    id="klip-audio-preset"
                    value={audioPreset}
                    onChange={(e) => setAudioPreset(e.target.value as AudioPreset)}
                    className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl pl-9 pr-3 text-sm text-white focus:outline-none"
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
                  className="w-full min-h-[44px] bg-[#121216] border border-white/10 focus:border-[#FF3B5C] rounded-xl px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Publish Bar */}
        <div className="border-t border-white/10 bg-[#09090B]/95 backdrop-blur-md px-4 sm:px-6 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] shrink-0">
          <div className="max-w-xl mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] px-5 rounded-xl border border-white/15 bg-[#121216] hover:bg-white/5 text-zinc-200 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={publishing}
              className="flex-1 min-h-[48px] px-6 rounded-xl bg-[#FF3B5C] hover:bg-[#ff264b] disabled:opacity-50 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {publishing ? 'Publicando...' : 'Publicar klip'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
