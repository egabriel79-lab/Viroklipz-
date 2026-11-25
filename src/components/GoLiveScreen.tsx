import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  Camera,
  Check,
  Crown,
  Gift,
  Globe,
  Heart,
  Lock,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  UserPlus,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import { audioEngine } from '../lib/audioEngine';
import { auth } from '../lib/firebase';
import {
  DEFAULT_AUDIENCE_FAVORITES,
  DEFAULT_FAN_CLUB_NAME,
  DEFAULT_FAN_PERKS,
  DEFAULT_FAN_POINTS_PER_COIN,
  DEFAULT_VIP_ALERT_CONFIG,
  resolveFanLevel,
  VIP_ALERT_STYLES,
} from '../lib/liveGifts';
import {
  endFirestoreLiveStream,
  startFirestoreLiveStream,
  subscribeCreatorLiveConfig,
  subscribeLiveStreamMessages,
  updateFirestoreLiveGuest,
} from '../lib/viroklipzService';
import type {
  AudienceFavorite,
  ClipCategory,
  FanClubPerk,
  LiveAudience,
  LiveQuality,
  LiveStreamMessage,
  LiveVisualEffect,
  UserProfile,
  VipAlertStyle,
} from '../types/viroklipz';
import { AvatarImg } from './AvatarImg';
import { FanLevelBadge } from './FanLevelBadge';
import {
  LiveClubConfiguratorModal,
  type LiveClubConfigTab,
} from './LiveClubConfiguratorModal';

interface GoLiveScreenProps {
  currentUser: UserProfile;
  onBack: () => void;
  onClose: () => void;
}

const LIVE_CATEGORIES: { id: ClipCategory; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'musica', label: 'Música' },
  { id: 'baile', label: 'Baile' },
  { id: 'cocina', label: 'Cocina' },
  { id: 'deportes', label: 'Deportes' },
  { id: 'arte', label: 'Arte' },
  { id: 'comedia', label: 'Comedia' },
  { id: 'viajes', label: 'Viajes' },
];

const VISUAL_EFFECTS: {
  id: LiveVisualEffect;
  label: string;
  filterClass: string;
  swatchClass: string;
}[] = [
  {
    id: 'none',
    label: 'Natural',
    filterClass: '',
    swatchClass: 'from-zinc-500 to-zinc-700',
  },
  {
    id: 'neon_purple',
    label: 'Neón Morado',
    filterClass: 'contrast-110 saturate-125 hue-rotate-[245deg] brightness-105',
    swatchClass: 'from-[#6C5CE7] to-[#8B7CF6]',
  },
  {
    id: 'electric_blue',
    label: 'Azul Eléctrico',
    filterClass: 'contrast-110 saturate-130 hue-rotate-[175deg]',
    swatchClass: 'from-[#00B4D8] to-[#2563EB]',
  },
  {
    id: 'magenta_glow',
    label: 'Magenta Glow',
    filterClass: 'contrast-110 saturate-150 brightness-105',
    swatchClass: 'from-[#E84393] to-[#6C5CE7]',
  },
  {
    id: 'noir',
    label: 'Noir Studio',
    filterClass: 'grayscale contrast-125 brightness-95',
    swatchClass: 'from-zinc-900 to-zinc-400',
  },
];

function formatLiveDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function GoLiveScreen({ currentUser, onBack, onClose }: GoLiveScreenProps) {
  const [title, setTitle] = useState('Bienvenidos a mi Live');
  const [about, setAbout] = useState('');
  const [category, setCategory] = useState<ClipCategory>('general');
  const [audience, setAudience] = useState<LiveAudience>('public');
  const [quality, setQuality] = useState<LiveQuality>('720p');
  const [visualEffect, setVisualEffect] = useState<LiveVisualEffect>('none');
  const [practiceMode, setPracticeMode] = useState(false);
  const [isRehearsing, setIsRehearsing] = useState(false);
  const [rehearsalLeftSec, setRehearsalLeftSec] = useState(30);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [isEffectsOpen, setIsEffectsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isGeneratingBio, setIsGeneratingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [multiplayerEnabled, setMultiplayerEnabled] = useState(false);
  const [guestName, setGuestName] = useState('Invitado Viroklipz');

  const [isConnecting, setIsConnecting] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<LiveStreamMessage[]>([]);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [statusError, setStatusError] = useState<string | null>(null);

  // PARTE 1 & 2: Club de Fans, Favoritos del Público y Alerta VIP
  const [fanPerks, setFanPerks] = useState<FanClubPerk[]>(DEFAULT_FAN_PERKS);
  const [audienceFavorites, setAudienceFavorites] = useState<AudienceFavorite[]>(
    DEFAULT_AUDIENCE_FAVORITES,
  );
  const [fanClubName, setFanClubName] = useState(DEFAULT_FAN_CLUB_NAME);
  const [fanPointsPerCoin, setFanPointsPerCoin] = useState<number>(DEFAULT_FAN_POINTS_PER_COIN);
  const [vipAlertEnabled, setVipAlertEnabled] = useState<boolean>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
  );
  const [vipAlertTitle, setVipAlertTitle] = useState<string>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
  );
  const [vipAlertStyle, setVipAlertStyle] = useState<VipAlertStyle>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle,
  );
  const [vipAlertDurationSec, setVipAlertDurationSec] = useState<number>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
  );
  const [vipAlertSound, setVipAlertSound] = useState<boolean>(
    DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
  );
  const [clubConfigTab, setClubConfigTab] = useState<LiveClubConfigTab | null>(null);

  // PARTE 3: VIP Notification banner on Host Studio
  const [vipAlert, setVipAlert] = useState<{
    viewerName: string;
    giftName: string;
    action: string;
  } | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const aboutFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const whipResourceUrlRef = useRef<string | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const activeStreamIdRef = useRef<string | null>(null);
  const seenVipMsgIdsRef = useRef<Set<string>>(new Set());
  const vipTimerRef = useRef<number | null>(null);
  const vipConfigRef = useRef({
    vipAlertEnabled: DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
    vipAlertDurationSec: DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
    vipAlertSound: DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
  });

  useEffect(() => {
    vipConfigRef.current = {
      vipAlertEnabled,
      vipAlertDurationSec,
      vipAlertSound,
    };
  }, [vipAlertEnabled, vipAlertDurationSec, vipAlertSound]);

  useEffect(() => {
    activeStreamIdRef.current = activeStreamId;
  }, [activeStreamId]);

  useEffect(() => {
    const unsub = subscribeCreatorLiveConfig(currentUser.uid, (cfg) => {
      setFanPerks(cfg.fanPerks);
      setAudienceFavorites(cfg.audienceFavorites);
      setFanClubName(cfg.fanClubName || DEFAULT_FAN_CLUB_NAME);
      setFanPointsPerCoin(cfg.fanPointsPerCoin || DEFAULT_FAN_POINTS_PER_COIN);
      setVipAlertEnabled(
        typeof cfg.vipAlertEnabled === 'boolean'
          ? cfg.vipAlertEnabled
          : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
      );
      setVipAlertTitle(cfg.vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle);
      setVipAlertStyle(cfg.vipAlertStyle || DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle);
      setVipAlertDurationSec(
        cfg.vipAlertDurationSec || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
      );
      setVipAlertSound(
        typeof cfg.vipAlertSound === 'boolean'
          ? cfg.vipAlertSound
          : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
      );
    });
    return () => unsub();
  }, [currentUser.uid]);

  const stopBroadcastResources = useCallback(async () => {
    if (liveTimerRef.current) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    const resourceUrl = whipResourceUrlRef.current;
    whipResourceUrlRef.current = null;
    if (resourceUrl) {
      try {
        await fetch(resourceUrl, { method: 'DELETE' });
      } catch {
        // Ignore WHIP teardown errors
      }
    }
    const streamIdToClose = activeStreamIdRef.current;
    activeStreamIdRef.current = null;
    setActiveStreamId(null);
    if (streamIdToClose) {
      await endFirestoreLiveStream(streamIdToClose);
    }
    setLiveMessages([]);
    setIsLive(false);
    setLiveSeconds(0);
  }, []);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startPreview = useCallback(
    async (facing: 'user' | 'environment', targetQuality: LiveQuality) => {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Tu navegador no admite acceso a cámara y micrófono para transmitir en vivo.');
        return;
      }
      stopMediaStream();
      const targetWidth = targetQuality === '1080p' ? 1920 : 1280;
      const targetHeight = targetQuality === '1080p' ? 1080 : 720;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facing,
            width: { ideal: targetWidth },
            height: { ideal: targetHeight },
          },
          audio: true,
        });
        streamRef.current = stream;
        setCameraReady(true);
        window.setTimeout(() => {
          if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = stream;
            void previewVideoRef.current.play().catch(() => {
              // Autoplay fallback
            });
          }
        }, 50);
      } catch {
        setCameraError(
          'No se pudo iniciar la vista previa en vivo. Verifica los permisos de cámara y micrófono.',
        );
      }
    },
    [stopMediaStream],
  );

  useEffect(() => {
    void startPreview(facingMode, quality);
    return () => {
      void stopBroadcastResources();
      stopMediaStream();
    };
  }, [facingMode, quality, startPreview, stopBroadcastResources, stopMediaStream]);

  useEffect(() => {
    if (!isLive || !activeStreamId) {
      setLiveMessages([]);
      seenVipMsgIdsRef.current.clear();
      setVipAlert(null);
      return;
    }
    const unsub = subscribeLiveStreamMessages(activeStreamId, (msgs) => {
      setLiveMessages(msgs);
      const latestVip = [...msgs]
        .reverse()
        .find((m) => m.kind === 'gift' && m.triggeredAction && !seenVipMsgIdsRef.current.has(m.id));
      if (latestVip && latestVip.triggeredAction) {
        seenVipMsgIdsRef.current.add(latestVip.id);
        const cfg = vipConfigRef.current;
        if (!cfg.vipAlertEnabled) return;
        if (cfg.vipAlertSound) {
          audioEngine.playVipChime();
        }
        setVipAlert({
          viewerName: latestVip.authorDisplayName,
          giftName: latestVip.giftName || 'Regalo VIP',
          action: latestVip.triggeredAction,
        });
        if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
        vipTimerRef.current = window.setTimeout(
          () => setVipAlert(null),
          cfg.vipAlertDurationSec * 1000,
        );
      }
    });
    return () => unsub();
  }, [isLive, activeStreamId]);

  useEffect(() => {
    if (!isRehearsing) return;
    if (rehearsalLeftSec <= 0) {
      setIsRehearsing(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setRehearsalLeftSec((prev) => prev - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [isRehearsing, rehearsalLeftSec]);

  const handleToggleMic = () => {
    const nextMuted = !micMuted;
    setMicMuted(nextMuted);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
  };

  const handleToggleCam = () => {
    const nextOff = !camOff;
    setCamOff(nextOff);
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !nextOff;
      });
    }
  };

  const handleToggleMultiplayer = async () => {
    const nextEnabled = !multiplayerEnabled;
    setMultiplayerEnabled(nextEnabled);
    if (isLive && activeStreamId) {
      await updateFirestoreLiveGuest(
        activeStreamId,
        nextEnabled
          ? {
              guestUid: `cohost_${currentUser.uid.slice(0, 12)}`,
              guestDisplayName: guestName.trim() || 'Invitado Viroklipz',
              guestStreamUrl: '',
            }
          : {
              guestUid: '',
              guestDisplayName: '',
              guestStreamUrl: '',
            },
      );
    }
  };

  const handleGenerateAiBio = async () => {
    setBioError(null);
    if (!auth.currentUser) {
      setBioError('Inicia sesión para generar la descripción con IA.');
      return;
    }

    setIsGeneratingBio(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/live/generate-bio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title.trim() || 'Charla en directo',
          category,
          displayName: currentUser.displayName || currentUser.username,
        }),
      });

      const data = (await response.json()) as { about?: unknown; error?: unknown };
      if (!response.ok || typeof data.about !== 'string' || !data.about.trim()) {
        throw new Error(
          typeof data.error === 'string' && data.error
            ? data.error
            : 'No se pudo generar la descripción con IA.',
        );
      }

      setAbout(data.about.trim().slice(0, 220));
    } catch (err) {
      setBioError(
        err instanceof Error
          ? err.message
          : 'Error al generar tu presentación con Gemini.',
      );
    } finally {
      setIsGeneratingBio(false);
    }
  };

  const connectOptionalWhipIngest = async (cleanTitle: string): Promise<string> => {
    let whipUrlRaw = '';
    let playbackUrl = '';

    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';

    try {
      const cfgRes = await fetch('/api/live/config');
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { whipConfigured?: boolean };
        if (cfg.whipConfigured && idToken) {
          const proxyRes = await fetch('/api/live/whip-session', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              title: cleanTitle,
              username: currentUser.username,
            }),
          });
          if (proxyRes.ok) {
            const data = (await proxyRes.json()) as { whipUrl?: unknown; playbackUrl?: unknown };
            if (typeof data.whipUrl === 'string' && data.whipUrl.startsWith('https://')) {
              whipUrlRaw = data.whipUrl.trim();
            }
            if (typeof data.playbackUrl === 'string' && data.playbackUrl.startsWith('https://')) {
              playbackUrl = data.playbackUrl.trim();
            }
          }
        }
      }
    } catch {
      // Optional backend proxy unavailable
    }

    if (!whipUrlRaw) {
      const endpointRaw = String(import.meta.env.VITE_WHIP_TOKEN_ENDPOINT || '').trim();
      if (endpointRaw.startsWith('https://')) {
        const tokenRes = await fetch(endpointRaw, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({
            uid: currentUser.uid,
            username: currentUser.username,
            title: cleanTitle,
          }),
        });
        if (tokenRes.ok) {
          const tokenJson = (await tokenRes.json()) as { whipUrl?: unknown; playbackUrl?: unknown };
          if (typeof tokenJson.whipUrl === 'string' && tokenJson.whipUrl.startsWith('https://')) {
            whipUrlRaw = tokenJson.whipUrl.trim();
          }
          if (
            typeof tokenJson.playbackUrl === 'string' &&
            tokenJson.playbackUrl.startsWith('https://')
          ) {
            playbackUrl = tokenJson.playbackUrl.trim();
          }
        }
      }
    }

    if (whipUrlRaw && streamRef.current) {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
      });
      peerRef.current = pc;

      streamRef.current.getTracks().forEach((track) => {
        if (streamRef.current) {
          pc.addTrack(track, streamRef.current);
        }
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }
        const timer = window.setTimeout(resolve, 1500);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') {
            window.clearTimeout(timer);
            resolve();
          }
        };
      });

      const localSdp = pc.localDescription?.sdp || offer.sdp || '';
      const whipRes = await fetch(whipUrlRaw, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
        },
        body: localSdp,
      });

      if (whipRes.ok) {
        const answerSdp = await whipRes.text();
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

        const locationHeader = whipRes.headers.get('location');
        if (locationHeader) {
          try {
            whipResourceUrlRef.current = new URL(locationHeader, whipUrlRaw).toString();
          } catch {
            whipResourceUrlRef.current = null;
          }
        }
      } else {
        pc.close();
        peerRef.current = null;
      }
    }

    return playbackUrl;
  };

  const handleStartLive = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setStatusError('Escribe un título para tu transmisión en vivo.');
      return;
    }
    if (!streamRef.current) {
      setStatusError('Activa la cámara y el micrófono antes de iniciar el Live.');
      return;
    }

    if (practiceMode && !isRehearsing) {
      setStatusError(null);
      setRehearsalLeftSec(30);
      setIsRehearsing(true);
      return;
    }

    setIsRehearsing(false);
    setStatusError(null);
    setIsConnecting(true);

    try {
      const playbackUrl = await connectOptionalWhipIngest(cleanTitle).catch(() => '');
      const streamId = await startFirestoreLiveStream(currentUser, {
        title: cleanTitle,
        about: about.trim(),
        audience,
        quality,
        visualEffect,
        category,
        previewImageUrl: currentUser.avatarUrl,
        streamUrl: playbackUrl,
        ...(multiplayerEnabled
          ? {
              guestUid: `cohost_${currentUser.uid.slice(0, 12)}`,
              guestDisplayName: guestName.trim() || 'Invitado Viroklipz',
            }
          : {}),
        fanPerks,
        audienceFavorites,
        fanClubName,
        fanPointsPerCoin,
        vipAlertEnabled,
        vipAlertTitle,
        vipAlertStyle,
        vipAlertDurationSec,
        vipAlertSound,
        audioPreset: 'urban_beat',
      });

      activeStreamIdRef.current = streamId;
      setActiveStreamId(streamId);
      setIsLive(true);
      setLiveSeconds(0);
      liveTimerRef.current = window.setInterval(() => {
        setLiveSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      await stopBroadcastResources();
      setStatusError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar la transmisión en vivo. Verifica tu conexión.',
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleEndLive = async () => {
    await stopBroadcastResources();
  };

  const openSettingsForAbout = () => {
    setIsEffectsOpen(false);
    setIsSettingsOpen(true);
    window.setTimeout(() => {
      aboutFieldRef.current?.focus();
    }, 120);
  };

  const creatorFanLevel = resolveFanLevel(currentUser.fanLevel, currentUser.fanPoints);
  const activeFilterClass =
    VISUAL_EFFECTS.find((fx) => fx.id === visualEffect)?.filterClass || '';
  const activeVipStylePreset =
    VIP_ALERT_STYLES.find((s) => s.id === vipAlertStyle) || VIP_ALERT_STYLES[0];

  return (
    <div className="fixed inset-0 z-50 bg-[#090B12] flex flex-col overflow-hidden text-white">
      {/* Live Stage (Full screen or Split-Screen when Multiplayer is active) */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex flex-col md:flex-row">
        <div
          className={`relative overflow-hidden transition-all duration-300 ${
            multiplayerEnabled ? 'w-full h-1/2 md:w-1/2 md:h-full' : 'w-full h-full'
          }`}
        >
          {cameraReady ? (
            <video
              ref={previewVideoRef}
              muted
              playsInline
              autoPlay
              className={`w-full h-full object-cover transition-all duration-300 ${activeFilterClass} ${
                facingMode === 'user' ? 'scale-x-[-1]' : ''
              } ${camOff ? 'opacity-20' : ''}`}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0B0D18] via-[#191331] to-[#090C14] flex flex-col items-center justify-center p-6 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6C5CE7] via-[#00B4D8] to-[#E84393] p-[2px]">
                <div className="w-full h-full rounded-[14px] bg-[#0B0D18] flex items-center justify-center">
                  <Radio className="w-8 h-8 text-[#00B4D8]" />
                </div>
              </div>
              <div className="space-y-1.5 max-w-xs">
                <h2 className="font-display text-xl font-bold text-white">
                  Estudio Viroklipz Live
                </h2>
                <p className="text-xs text-zinc-400">
                  {cameraError || 'Preparando cámara y audio en alta definición...'}
                </p>
              </div>
              {cameraError && (
                <button
                  type="button"
                  onClick={() => void startPreview(facingMode, quality)}
                  className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Reintentar cámara
                </button>
              )}
            </div>
          )}

          {multiplayerEnabled && (
            <div className="absolute left-3 bottom-3 z-20 px-2.5 py-1 rounded-lg bg-[#0B0E1A]/80 backdrop-blur-md border border-[#6C5CE7]/50 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />
              <span>Anfitrión · @{currentUser.username}</span>
            </div>
          )}
        </div>

        {/* PARTE 4: Split-Screen Co-Host Panel */}
        {multiplayerEnabled && (
          <div className="relative w-full h-1/2 md:w-1/2 md:h-full bg-gradient-to-br from-[#17122B] via-[#10162B] to-[#231024] border-t md:border-t-0 md:border-l border-[#6C5CE7]/40 flex flex-col items-center justify-center p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#00B4D8] via-[#6C5CE7] to-[#E84393] p-[2.5px] shadow-[0_0_24px_rgba(0,180,216,0.35)] mb-3">
              <div className="w-full h-full rounded-full bg-[#111526] flex items-center justify-center">
                <UserPlus className="w-7 h-7 text-[#00B4D8]" />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#00B4D8]">
              Modo Multijugador Activo
            </p>
            <p className="text-sm font-bold text-white mt-1">
              {guestName.trim() || 'Invitado en Vivo'}
            </p>
            <p className="text-[11px] text-zinc-300 mt-1 max-w-xs">
              Pantalla dividida sincronizada para co-host e invitados en tiempo real.
            </p>
            <input
              type="text"
              maxLength={40}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Nombre del co-host invitado"
              className="mt-3 w-full max-w-[230px] h-9 px-3 rounded-xl bg-black/50 border border-white/15 focus:border-[#00B4D8] text-xs text-white text-center focus:outline-none"
            />
          </div>
        )}

        {/* Top & Bottom Scrims */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/35 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#090B12] via-[#090B12]/70 to-transparent"
        />

        {/* Top Bar */}
        <div className="absolute top-0 inset-x-0 z-20 px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              void stopBroadcastResources();
              stopMediaStream();
              onBack();
            }}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#0F1220]/70 hover:bg-[#171B2E] backdrop-blur-md border border-white/15 text-xs font-semibold text-white cursor-pointer"
          >
            Volver
          </button>

          {isLive ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00B4D8]/85 via-[#6C5CE7] to-[#E84393] text-white text-xs font-bold tracking-wide shadow-[0_0_20px_rgba(232,67,147,0.45)]">
              <span className="w-2 h-2 rounded-full bg-[#00B4D8] animate-pulse" />
              <span>EN VIVO</span>
              <span className="font-mono tabular-nums">{formatLiveDuration(liveSeconds)}</span>
            </div>
          ) : isRehearsing ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#00B4D8]/20 backdrop-blur-md border border-[#00B4D8]/60 text-[#9BE8FA] text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00B4D8] animate-ping" />
              <span>PRÁCTICA PRIVADA</span>
              <span className="font-mono tabular-nums">{formatLiveDuration(rehearsalLeftSec)}</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-xl bg-[#0F1220]/75 backdrop-blur-md border border-[#00B4D8]/35 text-xs font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00B4D8]" />
              <span>Studio</span>
              <FanLevelBadge level={creatorFanLevel} compact />
              <span className="text-[10px] text-[#00B4D8] font-bold">{quality}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              void stopBroadcastResources();
              stopMediaStream();
              onClose();
            }}
            aria-label="Cerrar Live"
            className="min-h-[38px] min-w-[38px] rounded-xl bg-[#0F1220]/70 hover:bg-[#171B2E] backdrop-blur-md border border-white/15 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PARTE 3: Host-Side Floating VIP Notification Banner */}
        {vipAlert && (
          <div className="absolute top-20 inset-x-4 z-30 flex justify-center pointer-events-none">
            <div
              className={`pointer-events-auto max-w-md w-full rounded-2xl p-[1.5px] bg-gradient-to-r ${activeVipStylePreset.wrapperGradient} ${activeVipStylePreset.glowShadow} animate-bounce`}
            >
              <div className="rounded-[15px] bg-[#0B0E1B]/95 backdrop-blur-2xl px-4 py-3 flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${activeVipStylePreset.wrapperGradient} flex items-center justify-center shrink-0`}
                >
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00B4D8]">
                    {vipAlertTitle || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle}
                  </p>
                  <p className="text-sm font-bold text-white leading-snug">
                    ¡{vipAlert.viewerName} ha enviado {vipAlert.giftName}!
                  </p>
                  <p className="text-xs font-semibold text-[#F9A8D4] mt-0.5">
                    Debes hacer: {vipAlert.action}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVipAlert(null)}
                  aria-label="Cerrar alerta VIP"
                  className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PARTE 1: Floating Viroklipz Right Rail (Girar cámara, Efectos, Ajustes, Multijugador, Mic, Cam) */}
        <div className="absolute right-3.5 top-24 z-20 flex flex-col gap-2.5">
          <button
            type="button"
            disabled={isLive}
            onClick={() => setFacingMode((m) => (m === 'user' ? 'environment' : 'user'))}
            aria-label="Girar cámara"
            className="flex flex-col items-center gap-1 disabled:opacity-45 cursor-pointer group"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#101424]/75 group-hover:bg-[#6C5CE7]/40 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-semibold text-white/90 drop-shadow">Girar</span>
          </button>

          <button
            type="button"
            onClick={() => setIsEffectsOpen((v) => !v)}
            aria-label="Efectos"
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <span
              className={`w-11 h-11 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-colors ${
                visualEffect !== 'none' || isEffectsOpen
                  ? 'bg-gradient-to-tr from-[#6C5CE7] to-[#E84393] border-white/40 text-white shadow-[0_0_16px_rgba(108,92,231,0.5)]'
                  : 'bg-[#101424]/75 group-hover:bg-[#6C5CE7]/40 border-white/15 text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-semibold text-white/90 drop-shadow">Efectos</span>
          </button>

          {!isLive && (
            <button
              type="button"
              onClick={() => {
                setIsEffectsOpen(false);
                setIsSettingsOpen(true);
              }}
              aria-label="Ajustes del Live"
              className="flex flex-col items-center gap-1 cursor-pointer group"
            >
              <span className="w-11 h-11 rounded-2xl bg-[#101424]/75 group-hover:bg-[#00B4D8]/35 backdrop-blur-xl border border-white/15 flex items-center justify-center text-white transition-colors">
                <SlidersHorizontal className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-semibold text-white/90 drop-shadow">Ajustes</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setIsEffectsOpen(false);
              setClubConfigTab('fan_level');
            }}
            aria-label="Configurar Nivel de Fan, Favoritos y Alerta VIP"
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <span className="w-11 h-11 rounded-2xl bg-[#101424]/75 group-hover:bg-[#E84393]/35 backdrop-blur-xl border border-[#E84393]/45 flex items-center justify-center text-[#F9A8D4] transition-colors shadow-[0_0_16px_rgba(232,67,147,0.28)]">
              <Crown className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-semibold text-white/90 drop-shadow">Club VIP</span>
          </button>

          <button
            type="button"
            onClick={() => void handleToggleMultiplayer()}
            aria-label="Modo Multijugador"
            className="flex flex-col items-center gap-1 cursor-pointer group"
          >
            <span
              className={`w-11 h-11 rounded-2xl backdrop-blur-xl border flex items-center justify-center transition-colors ${
                multiplayerEnabled
                  ? 'bg-gradient-to-tr from-[#00B4D8] to-[#6C5CE7] border-white/40 text-white shadow-[0_0_16px_rgba(0,180,216,0.45)]'
                  : 'bg-[#101424]/75 group-hover:bg-[#00B4D8]/35 border-white/15 text-white'
              }`}
            >
              <Users className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-semibold text-white/90 drop-shadow">Dúo</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMic}
            aria-label={micMuted ? 'Activar micrófono' : 'Silenciar micrófono'}
            className={`w-11 h-11 rounded-2xl backdrop-blur-xl border flex items-center justify-center cursor-pointer ${
              micMuted
                ? 'bg-[#E84393]/90 border-[#E84393] text-white'
                : 'bg-[#101424]/75 hover:bg-white/15 border-white/15 text-white'
            }`}
          >
            {micMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleToggleCam}
            aria-label={camOff ? 'Encender cámara' : 'Apagar cámara'}
            className={`w-11 h-11 rounded-2xl backdrop-blur-xl border flex items-center justify-center cursor-pointer ${
              camOff
                ? 'bg-[#E84393]/90 border-[#E84393] text-white'
                : 'bg-[#101424]/75 hover:bg-white/15 border-white/15 text-white'
            }`}
          >
            {camOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>

        {/* Floating Visual Effects Bar */}
        {isEffectsOpen && (
          <div className="absolute right-16 top-28 z-30 w-60 p-3 rounded-2xl bg-[#111424]/90 backdrop-blur-2xl border border-[#6C5CE7]/40 shadow-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Efectos de estudio</span>
              <button
                type="button"
                onClick={() => setIsEffectsOpen(false)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {VISUAL_EFFECTS.map((fx) => {
                const selected = visualEffect === fx.id;
                return (
                  <button
                    key={fx.id}
                    type="button"
                    onClick={() => setVisualEffect(fx.id)}
                    className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-xs font-semibold transition-colors cursor-pointer ${
                      selected
                        ? 'bg-gradient-to-r from-[#6C5CE7]/40 to-[#E84393]/40 border border-[#8B7CF6] text-white'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-200 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-3.5 h-3.5 rounded-full bg-gradient-to-tr ${fx.swatchClass}`}
                      />
                      {fx.label}
                    </span>
                    {selected && <Check className="w-3.5 h-3.5 text-[#00B4D8]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Glassmorphism Panel (PARTE 1) OR Active Live Chat Overlay */}
        <div className="absolute bottom-0 inset-x-0 z-20">
          {isLive ? (
            <div className="px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 max-w-md mx-auto space-y-3">
              {liveMessages.length > 0 && (
                <div className="max-h-40 overflow-y-auto no-scrollbar space-y-1.5">
                  {liveMessages.map((msg) =>
                    msg.kind === 'gift' ? (
                      <div
                        key={msg.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#101322]/85 backdrop-blur-md border border-[#E84393]/55 text-xs text-white shadow-[0_0_16px_rgba(232,67,147,0.3)]"
                      >
                        <Gift className="w-3.5 h-3.5 text-[#00B4D8] shrink-0" />
                        <FanLevelBadge level={msg.senderFanLevel || 1} compact />
                        <span>
                          <strong className="mr-1">{msg.authorDisplayName}</strong>
                          {msg.text}
                        </span>
                      </div>
                    ) : msg.kind === 'like' ? (
                      <div key={msg.id} className="flex items-center gap-2 text-xs">
                        <Heart className="w-3.5 h-3.5 text-[#E84393] fill-[#E84393] shrink-0" />
                        <p className="text-white/90 drop-shadow flex items-center flex-wrap gap-1">
                          <FanLevelBadge level={msg.senderFanLevel || 1} compact />
                          <span className="font-semibold">{msg.authorDisplayName}</span>
                          <span>{msg.text}</span>
                        </p>
                      </div>
                    ) : (
                      <div key={msg.id} className="flex items-start gap-2">
                        <AvatarImg
                          src={msg.authorAvatarUrl}
                          alt={msg.authorDisplayName}
                          fallbackText={msg.authorDisplayName}
                          sizeClass="w-5 h-5 mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <FanLevelBadge level={msg.senderFanLevel || 1} compact />
                            <span className="text-xs font-semibold text-[#00B4D8]">
                              {msg.authorDisplayName}
                            </span>
                          </div>
                          <p className="text-xs text-white drop-shadow break-words">
                            {msg.text}
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-[#0F1222]/80 backdrop-blur-xl border border-[#00B4D8]/35 shadow-[0_0_24px_rgba(0,180,216,0.18)] space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-zinc-300">
                  <span className="inline-flex items-center gap-1.5">
                    <span>@{currentUser.username}</span>
                    <FanLevelBadge level={creatorFanLevel} compact />
                  </span>
                  <span className="text-[#00B4D8]">
                    {audience === 'friends' ? 'Solo amigos' : 'Todo el mundo'} · {quality}
                  </span>
                </div>
                <p className="text-sm font-bold text-white">{title}</p>
                {about.trim() && (
                  <p className="text-xs text-zinc-300 line-clamp-2">{about}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleEndLive()}
                className="w-full min-h-[50px] px-6 rounded-2xl bg-gradient-to-r from-[#E84393] to-rose-600 hover:opacity-95 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Square className="w-4 h-4 fill-white" />
                Finalizar Live
              </button>
            </div>
          ) : (
            <div className="max-w-lg mx-auto rounded-t-[28px] bg-[#101322]/75 backdrop-blur-2xl border-t border-x border-white/15 px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(108,92,231,0.22)] space-y-3">
              {statusError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-100 leading-relaxed">
                  {statusError}
                </div>
              )}

              {isRehearsing && (
                <div className="p-3 rounded-xl bg-[#00B4D8]/15 border border-[#00B4D8]/40 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#BCEEFF] font-medium">
                    Modo Práctica activo ({rehearsalLeftSec}s). Nadie puede verte aún.
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRehearsing(false)}
                    className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold cursor-pointer shrink-0"
                  >
                    Detener
                  </button>
                </div>
              )}

              {/* Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {LIVE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                      category === cat.id
                        ? 'bg-gradient-to-r from-[#6C5CE7] to-[#E84393] text-white shadow'
                        : 'bg-white/10 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Glassmorphism Title Input + Acerca de mí Quick Button */}
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <label htmlFor="live-stream-title" className="sr-only">
                    Título de la transmisión
                  </label>
                  <input
                    id="live-stream-title"
                    type="text"
                    maxLength={80}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Bienvenidos a mi Live"
                    className="w-full min-h-[46px] px-4 rounded-2xl bg-white/10 border border-white/15 focus:border-[#00B4D8] text-sm text-white placeholder:text-zinc-400 focus:outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={openSettingsForAbout}
                  className={`min-h-[46px] px-3.5 rounded-2xl border text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors ${
                    about.trim()
                      ? 'bg-[#6C5CE7]/30 border-[#8B7CF6] text-white'
                      : 'bg-white/10 hover:bg-white/15 border-white/15 text-zinc-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00B4D8]" />
                  <span>Acerca de mí</span>
                </button>
              </div>

              {/* Status summary row */}
              <div className="flex items-center justify-between text-[11px] text-zinc-300 px-1">
                <span className="inline-flex items-center gap-1.5">
                  {audience === 'friends' ? (
                    <Lock className="w-3 h-3 text-[#E84393]" />
                  ) : (
                    <Globe className="w-3 h-3 text-[#00B4D8]" />
                  )}
                  {audience === 'friends' ? 'Solo amigos' : 'Todo el mundo'} · {quality}
                </span>
                {practiceMode && !isRehearsing && (
                  <span className="text-[#00B4D8] font-semibold">
                    Práctica de 30s activada
                  </span>
                )}
              </div>

              {/* Gradient Emit Button (Electric Blue -> Magenta) */}
              <button
                type="button"
                disabled={isConnecting || !cameraReady}
                onClick={() => void handleStartLive()}
                className="w-full min-h-[52px] px-6 rounded-2xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] hover:brightness-110 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-2.5 shadow-[0_8px_28px_rgba(232,67,147,0.35)] transition-all cursor-pointer"
              >
                <Radio className="w-4 h-4" />
                {isConnecting
                  ? 'Conectando Live...'
                  : isRehearsing
                    ? 'Pasar a En Vivo ahora'
                    : practiceMode
                      ? 'Probar cámara 30s (Modo Práctica)'
                      : 'Iniciar Live'}
              </button>
            </div>
          )}
        </div>

        {/* PARTE 2: Dark Settings Modal Bottom Sheet */}
        {isSettingsOpen && !isLive && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Configuración del Live"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-t-[28px] bg-[#121524] border-t border-x border-[#6C5CE7]/40 p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5 max-h-[88dvh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-bold text-white">
                    Configuración del Live
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Ajusta privacidad, práctica, presentación con IA y calidad
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Cerrar ajustes"
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Quién puede mirar */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  1. Quién puede mirar
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAudience('public')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      audience === 'public'
                        ? 'bg-[#6C5CE7]/25 border-[#00B4D8] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-[#00B4D8] mb-1.5" />
                    <p className="text-xs font-bold">Todo el mundo</p>
                    <p className="text-[11px] text-zinc-400">Visible en Para ti y En vivo</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudience('friends')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      audience === 'friends'
                        ? 'bg-[#E84393]/20 border-[#E84393] text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-[#E84393] mb-1.5" />
                    <p className="text-xs font-bold">Solo amigos</p>
                    <p className="text-[11px] text-zinc-400">Solo seguidores mutuos</p>
                  </button>
                </div>
              </div>

              {/* 2. Modo Práctica (30s) */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-white">2. Modo Práctica (30 segundos)</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Prueba cámara y audio en privado antes de que alguien te vea.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={practiceMode}
                  onClick={() => setPracticeMode((prev) => !prev)}
                  className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                    practiceMode ? 'bg-gradient-to-r from-[#00B4D8] to-[#6C5CE7]' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                      practiceMode ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* 3. Acerca de mí + Generar con IA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="live-about-textarea"
                    className="text-xs font-bold uppercase tracking-wider text-zinc-300"
                  >
                    3. Acerca de mí
                  </label>
                  <button
                    type="button"
                    disabled={isGeneratingBio}
                    onClick={() => void handleGenerateAiBio()}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#6C5CE7] to-[#E84393] hover:brightness-110 disabled:opacity-50 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isGeneratingBio ? 'Generando...' : 'Generar con IA'}
                  </button>
                </div>
                <textarea
                  ref={aboutFieldRef}
                  id="live-about-textarea"
                  rows={3}
                  maxLength={220}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Cuéntale a la comunidad de qué tratará tu Live hoy..."
                  className="w-full p-3 rounded-2xl bg-black/40 border border-white/15 focus:border-[#00B4D8] text-xs text-white placeholder:text-zinc-500 focus:outline-none resize-none"
                />
                {bioError && (
                  <p className="text-[11px] text-rose-300">{bioError}</p>
                )}
              </div>

              {/* 4. Calidad del Live */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  4. Calidad del Live
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {(['720p', '1080p'] as LiveQuality[]).map((opt) => {
                    const active = quality === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setQuality(opt)}
                        className={`min-h-[44px] px-4 rounded-2xl border text-xs font-bold flex items-center justify-between cursor-pointer ${
                          active
                            ? 'bg-[#00B4D8]/20 border-[#00B4D8] text-white'
                            : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                        }`}
                      >
                        <span>{opt === '1080p' ? '1080p Full HD' : '720p HD'}</span>
                        {active && <Check className="w-4 h-4 text-[#00B4D8]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Club de Fans, Favoritos del Público y Alerta VIP */}
              <div className="space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  5. Club de Fans, Favoritos y Alerta VIP
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setClubConfigTab('fan_level');
                    }}
                    className="p-3.5 rounded-2xl bg-[#14182B]/90 hover:bg-[#1B2038] border border-[#00B4D8]/45 shadow-[0_0_18px_rgba(0,180,216,0.2)] text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                        <Star className="w-4 h-4 text-[#00B4D8] fill-[#00B4D8]/40" />
                        Nivel y Ventajas
                      </span>
                      <span className="text-[11px] font-bold text-[#00B4D8]">
                        {fanPerks.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      {fanClubName} · {fanPointsPerCoin}x XP
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setClubConfigTab('favorites');
                    }}
                    className="p-3.5 rounded-2xl bg-[#14182B]/90 hover:bg-[#1B2038] border border-[#E84393]/45 shadow-[0_0_18px_rgba(232,67,147,0.2)] text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                        <Crown className="w-4 h-4 text-[#E84393]" />
                        Favoritos Público
                      </span>
                      <span className="text-[11px] font-bold text-[#E84393]">
                        {audienceFavorites.length}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Acciones por regalos
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsSettingsOpen(false);
                      setClubConfigTab('vip_alert');
                    }}
                    className="p-3.5 rounded-2xl bg-[#14182B]/90 hover:bg-[#1B2038] border border-[#6C5CE7]/50 shadow-[0_0_18px_rgba(108,92,231,0.25)] text-left transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                        <BellRing className="w-4 h-4 text-[#00B4D8]" />
                        Alerta VIP Live
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          vipAlertEnabled
                            ? 'bg-[#00B4D8]/20 text-[#9BE8FA]'
                            : 'bg-white/10 text-zinc-400'
                        }`}
                      >
                        {vipAlertEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {activeVipStylePreset.label} · {vipAlertDurationSec}s
                    </p>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full min-h-[46px] rounded-2xl bg-gradient-to-r from-[#00B4D8] via-[#6C5CE7] to-[#E84393] text-white text-sm font-bold cursor-pointer"
              >
                Guardar configuración
              </button>
            </div>
          </div>
        )}

        <LiveClubConfiguratorModal
          isOpen={clubConfigTab !== null}
          initialTab={clubConfigTab || 'fan_level'}
          currentUser={currentUser}
          activeStreamId={isLive ? activeStreamId : null}
          onPreviewVipAlert={(preview) => {
            if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
            setVipAlert(preview);
            vipTimerRef.current = window.setTimeout(
              () => setVipAlert(null),
              vipConfigRef.current.vipAlertDurationSec * 1000,
            );
          }}
          onClose={() => setClubConfigTab(null)}
        />
      </div>
    </div>
  );
}
