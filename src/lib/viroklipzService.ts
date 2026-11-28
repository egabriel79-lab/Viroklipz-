import {
  createUserWithEmailAndPassword,
  deleteUser,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  calculateProgressiveFollowers,
  formatFollowersLabel,
  isOfficialViroklipzAccount,
  isOfficialViroklipzEmail,
  OFFICIAL_VIROKLIPZ_USERNAME,
} from './officialAccount';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  storage,
} from './firebase';
import { deleteClipMediaBlob, saveClipMediaBlob } from './mediaStorage';
import {
  ALLOWED_CATEGORIES,
  createSafeId,
  MAX_AUDIO_PRESET_LEN,
  MAX_AUDIO_TITLE_LEN,
  MAX_BIO_COLOR_LEN,
  MAX_BIO_LEN,
  MAX_CAPTION_LEN,
  MAX_CATEGORY_LEN,
  MAX_COMMENT_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_FCM_TOKEN_LEN,
  MAX_HASHTAGS,
  MAX_NAME_PART_LEN,
  MAX_NOTE_LEN,
  MAX_PERSONAL_LINK_LEN,
  MAX_PHONE_LEN,
  MAX_PRONOUNS_LEN,
  MAX_REPORT_DETAILS_LEN,
  MAX_VIDEO_FILE_BYTES,
  MAX_VISUAL_PRESET_LEN,
  makeUniqueUsernameWithUid,
  sanitizeAvatarUrl,
  sanitizeMediaUrl,
  sanitizePersonalLink,
  sanitizeUsername,
} from './validation';
import type {
  AudioPreset,
  BlockedUserEntry,
  ChatMessage,
  ChatRoomId,
  ClipCategory,
  ClipComment,
  ClipItem,
  ClipVisibility,
  CommunityChatMessage,
  CreatorFanLevelResult,
  CreatorSummary,
  DirectMessage,
  DirectThread,
  AudienceFavorite,
  CreatorLiveConfig,
  FanClubPerk,
  GuardianAuthorizationData,
  LiveAudience,
  LiveBackgroundPreset,
  LiveBattleGiftEvent,
  LiveBattleRecord,
  LiveCommentPermission,
  LiveGuestRecord,
  LiveJoinRequest,
  LiveQuality,
  LiveStreamMessage,
  LiveStreamRecord,
  LiveVisualEffect,
  PresenceStatus,
  RechargePackage,
  ReportReason,
  ReportTargetType,
  StatusNote,
  UserPrivateInfo,
  UserProfile,
  UserStreak,
  VipAlertStyle,
} from '../types/viroklipz';
import {
  DEFAULT_AUDIENCE_FAVORITES,
  DEFAULT_FAN_CLUB_NAME,
  DEFAULT_FAN_PERKS,
  DEFAULT_FAN_POINTS_PER_COIN,
  DEFAULT_VIP_ALERT_CONFIG,
  FULLSCREEN_GIFT_THRESHOLD_COINS,
  normalizeFanLevelThreshold,
  RECHARGE_PACKAGES,
  resolveFanLevel,
  WELCOME_BONUS_ROSES,
} from './liveGifts';

const actionTimestamps = new Map<string, number>();

function assertCooldown(actionKey: string, cooldownMs: number, waitMsg: string): void {
  const now = Date.now();
  const prev = actionTimestamps.get(actionKey) || 0;
  if (now - prev < cooldownMs) {
    throw new Error(waitMsg);
  }
  actionTimestamps.set(actionKey, now);
}

function toCleanArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function uploadClipToR2IfConfigured(
  clipId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  const rawEndpoint = String(import.meta.env.VITE_R2_UPLOAD_ENDPOINT || '').trim();
  if (!rawEndpoint) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawEndpoint);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('El endpoint de Cloudflare R2 debe usar HTTPS.');
  }
  if (bytes.byteLength > MAX_VIDEO_FILE_BYTES) {
    throw new Error('El archivo supera el límite permitido para subir.');
  }
  const safeBlob = new Blob([toCleanArrayBuffer(bytes)], { type: mimeType || 'video/mp4' });
  const ext = mimeType.includes('image/png')
    ? 'png'
    : mimeType.includes('image/webp')
      ? 'webp'
      : mimeType.includes('image/')
        ? 'jpg'
        : mimeType.includes('mp4')
          ? 'mp4'
          : 'webm';
  const form = new FormData();
  form.append('clipId', clipId);
  form.append('file', safeBlob, `${clipId}.${ext}`);

  const response = await fetch(parsed.toString(), {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error('No se pudo subir el archivo a Cloudflare R2.');
  }
  const json = (await response.json()) as { url?: unknown };
  const cleanUrl = sanitizeMediaUrl(typeof json.url === 'string' ? json.url : '');
  if (!cleanUrl) {
    throw new Error('El endpoint de almacenamiento devolvió una URL inválida.');
  }
  return cleanUrl;
}

async function uploadClipBytesToFirebaseStorage(
  uid: string,
  clipId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  if (!storage || !auth.currentUser) return null;
  try {
    const objectRef = storageRef(storage, `clips/${uid}/${clipId}`);
    const uploadPromise = uploadBytes(objectRef, bytes, {
      contentType: mimeType || 'video/mp4',
    }).then((snap) => getDownloadURL(snap.ref));

    const downloadUrl = await Promise.race([
      uploadPromise,
      new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('Firebase Storage upload timeout')), 15000);
      }),
    ]);
    const cleanUrl = sanitizeMediaUrl(downloadUrl);
    return cleanUrl || null;
  } catch (err) {
    console.warn('Firebase Storage uploadBytes skipped, falling back to local IndexedDB bytes:', err);
    return null;
  }
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

function mapClipDoc(id: string, data: Record<string, unknown>): ClipItem {
  const rawMediaType = typeof data.mediaType === 'string' ? data.mediaType.trim().toLowerCase() : '';
  return {
    id: String(data.id || id),
    authorId: String(data.authorId || ''),
    authorUsername: String(data.authorUsername || 'creador'),
    authorDisplayName: String(data.authorDisplayName || 'Creador'),
    authorAvatarUrl: String(data.authorAvatarUrl || ''),
    caption: String(data.caption || ''),
    category: typeof data.category === 'string' ? data.category : '',
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    audioTitle: typeof data.audioTitle === 'string' ? data.audioTitle : '',
    audioPreset: typeof data.audioPreset === 'string' ? data.audioPreset : '',
    visualPreset: String(data.visualPreset || ''),
    videoUrl: sanitizeMediaUrl(typeof data.videoUrl === 'string' ? data.videoUrl : ''),
    mediaType: !rawMediaType || rawMediaType === 'video' ? 'video' : undefined,
    durationSec: Number(data.durationSec || 15),
    hasLocalMedia: Boolean(data.hasLocalMedia),
    visibility: (data.visibility || 'public') as ClipVisibility,
    likesCount: Number(data.likesCount || 0),
    bookmarksCount: Number(data.bookmarksCount || 0),
    viewsCount: Number(data.viewsCount || 0),
    sharesCount: Number(data.sharesCount || 0),
    replaysCount: Number(data.replaysCount || 0),
    createdAtMs: toMillis(data.createdAt),
    isStarter: false,
  };
}

export function extractAuthErrorCode(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return String((err as { code?: unknown }).code || '');
  }
  if (err instanceof Error) {
    const match = err.message.match(/auth\/[a-z0-9-]+/i);
    if (match) return match[0].toLowerCase();
  }
  return '';
}

function canUseRedirectFallback(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self === window.top;
  } catch {
    return false;
  }
}

const GOOGLE_PENDING_SIGNUP_KEY = 'viroklipz_google_pending_signup';
let pendingGoogleSignupOverrides: EnsureProfileOverrides | null = null;

export async function signInWithGoogle(
  overrides?: EnsureProfileOverrides,
): Promise<UserProfile | null> {
  pendingGoogleSignupOverrides = overrides ?? null;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return await ensureUserProfile(result.user, overrides);
  } catch (err) {
    const code = extractAuthErrorCode(err);
    const shouldRedirect =
      canUseRedirectFallback() &&
      (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported');
    if (shouldRedirect) {
      if (overrides && typeof sessionStorage !== 'undefined') {
        try {
          sessionStorage.setItem(GOOGLE_PENDING_SIGNUP_KEY, JSON.stringify(overrides));
        } catch {
          // Ignore storage errors
        }
      }
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  } finally {
    if (pendingGoogleSignupOverrides === (overrides ?? null)) {
      pendingGoogleSignupOverrides = null;
    }
  }
}

export async function completeGoogleRedirectIfPending(): Promise<UserProfile | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    let storedOverrides: EnsureProfileOverrides | undefined;
    if (typeof sessionStorage !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(GOOGLE_PENDING_SIGNUP_KEY);
        if (raw) {
          storedOverrides = JSON.parse(raw) as EnsureProfileOverrides;
          sessionStorage.removeItem(GOOGLE_PENDING_SIGNUP_KEY);
        }
      } catch {
        storedOverrides = undefined;
      }
    }
    return await ensureUserProfile(result.user, storedOverrides);
  } catch (err) {
    console.warn('Google redirect auth warning:', err);
    throw err;
  }
}

export interface EnsureProfileOverrides {
  displayName?: string;
  email?: string;
  age?: number;
  isMinor?: boolean;
  guardianData?: GuardianAuthorizationData;
}

const pendingSignupOverridesByEmail = new Map<string, EnsureProfileOverrides>();

export async function signUpWithEmail(input: {
  displayName: string;
  email: string;
  password: string;
  age: number;
  guardianData?: GuardianAuthorizationData;
}): Promise<UserProfile> {
  const cleanName =
    input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador Viroklipz';
  const cleanEmail = input.email.trim().toLowerCase().slice(0, MAX_EMAIL_LEN);
  const parsedAge = Math.floor(Number(input.age));
  if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
    throw new Error('Ingresa una edad válida entre 1 y 120 años.');
  }

  const isMinor = parsedAge < 18;
  let cleanGuardian: GuardianAuthorizationData | undefined;

  if (isMinor) {
    const gName = (input.guardianData?.name || '').trim().slice(0, 60);
    const gSurname = (input.guardianData?.surname || '').trim().slice(0, 60);
    const gId = (input.guardianData?.id || '').trim().slice(0, 32);
    const authorized = Boolean(input.guardianData?.authorized);
    if (!gName || !gSurname || gId.length < 3 || !authorized) {
      throw new Error('Debes contar con la autorización de un tutor legal');
    }
    cleanGuardian = {
      name: gName,
      surname: gSurname,
      id: gId,
      authorized: true,
    };
  }

  const overrides: EnsureProfileOverrides = {
    displayName: cleanName,
    email: cleanEmail,
    age: parsedAge,
    isMinor,
    ...(cleanGuardian ? { guardianData: cleanGuardian } : {}),
  };

  pendingSignupOverridesByEmail.set(cleanEmail, overrides);
  try {
    const credential = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);
    try {
      await updateProfile(credential.user, { displayName: cleanName });
    } catch {
      // Non-fatal if displayName update lags
    }
    return await ensureUserProfile(credential.user, overrides);
  } finally {
    if (pendingSignupOverridesByEmail.get(cleanEmail) === overrides) {
      pendingSignupOverridesByEmail.delete(cleanEmail);
    }
  }
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<UserProfile> {
  const cleanEmail = input.email.trim().toLowerCase().slice(0, MAX_EMAIL_LEN);
  const credential = await signInWithEmailAndPassword(auth, cleanEmail, input.password);
  return await ensureUserProfile(credential.user, { email: cleanEmail });
}

export async function resetUserPassword(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase().slice(0, MAX_EMAIL_LEN);
  await sendPasswordResetEmail(auth, cleanEmail);
}

export function mapAuthErrorMessage(
  err: unknown,
  provider?: 'email' | 'google',
): string {
  const code = extractAuthErrorCode(err);
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con ese correo electrónico. Prueba iniciar sesión.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Correo electrónico o contraseña incorrectos.';
    case 'auth/user-disabled':
      return 'Esta cuenta está deshabilitada o suspendida.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
    case 'auth/configuration-not-found':
      if (provider === 'google') {
        return 'El acceso con Google aún no está activado en Firebase Console. Actívalo en Authentication > Sign-in method > Google.';
      }
      return 'El acceso con correo electrónico y contraseña aún no está activado en Firebase Console. Actívalo en Authentication > Sign-in method > Correo electrónico/Contraseña.';
    case 'auth/unauthorized-domain':
      return host
        ? `El dominio "${host}" no está autorizado en Firebase Console. Agrégalo en Authentication > Settings > Authorized domains.`
        : 'Este dominio no está autorizado en Firebase Console (Authentication > Settings > Authorized domains).';
    case 'auth/network-request-failed':
      return 'Error de red. Verifica tu conexión a internet e inténtalo nuevamente.';
    case 'auth/popup-closed-by-user':
      return 'Cerraste la ventana de Google antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'Tu navegador bloqueó la ventana emergente de Google. Abre Viroklipz en una pestaña del navegador o permite ventanas emergentes.';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Este visor integrado bloquea la ventana de Google. Abre Viroklipz en tu navegador para iniciar sesión con Google.';
    case 'auth/cancelled-popup-request':
      return 'Se canceló la solicitud anterior de Google. Inténtalo de nuevo.';
    case 'auth/account-exists-with-different-credential':
      return 'Ya existe una cuenta con ese correo usando otro método de acceso.';
    case 'auth/web-storage-unsupported':
      return 'Tu navegador bloquea las cookies o almacenamiento necesario para iniciar sesión. Desactiva el modo privado estricto o permite cookies.';
    case 'auth/internal-error':
      return 'Error interno de Firebase Auth. Verifica que este dominio esté autorizado y los proveedores activados en Firebase Console.';
    default: {
      if (err instanceof Error && err.message.startsWith('{')) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string; operationType?: string };
          if (parsed.error?.toLowerCase().includes('permission')) {
            return 'Tu cuenta se autenticó, pero Firestore rechazó el guardado del perfil. Revisa las reglas de Firestore.';
          }
          if (parsed.error) {
            return `Error al cargar el perfil en Firestore: ${parsed.error}`;
          }
        } catch {
          // Ignore malformed JSON
        }
      }
      return code
        ? `No se pudo completar la autenticación (${code}). Verifica la configuración en Firebase Console.`
        : 'No se pudo completar la autenticación. Verifica tu conexión o la configuración en Firebase Console.';
    }
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

function isTransientUnavailableError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'firestore/unavailable' ||
    msg.includes('client is offline') ||
    msg.includes('could not reach cloud firestore')
  );
}

function buildFallbackProfile(
  user: User,
  overrides?: EnsureProfileOverrides,
): UserProfile {
  const effectiveEmail = (overrides?.email || user.email || '').trim().slice(0, MAX_EMAIL_LEN);
  const rawDisplayName = (
    overrides?.displayName ||
    user.displayName ||
    effectiveEmail.split('@')[0] ||
    'Creador Viroklipz'
  ).trim();
  const isOfficialEmail = isOfficialViroklipzEmail(effectiveEmail);
  const displayName = rawDisplayName.slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador';
  const username = sanitizeUsername(
    effectiveEmail.split('@')[0] || displayName || 'creador',
    user.uid,
    { allowReservedOfficial: isOfficialEmail },
  );
  const now = Date.now();
  const isOfficial = isOfficialViroklipzAccount({ username, email: effectiveEmail });
  const breakdown = calculateProgressiveFollowers({ username, email: effectiveEmail }, 0, 0);
  return {
    uid: user.uid,
    username,
    displayName,
    bio: '',
    avatarUrl: sanitizeAvatarUrl(user.photoURL),
    isPublic: true,
    isAdmin: isOfficial,
    isVerified: isOfficial,
    followersCount: breakdown.followersCount,
    realFollowersCount: breakdown.realFollowersCount,
    seededFollowersCount: breakdown.seededFollowersCount,
    ...(effectiveEmail ? { email: effectiveEmail } : {}),
    coins: 0,
    freeRoses: 0,
    welcomeRechargeClaimed: false,
    ...(typeof overrides?.age === 'number' ? { age: overrides.age } : {}),
    ...(typeof overrides?.isMinor === 'boolean' ? { isMinor: overrides.isMinor } : {}),
    ...(overrides?.guardianData ? { guardianData: overrides.guardianData } : {}),
    createdAtMs: now,
    updatedAtMs: now,
  };
}

const inFlightProfileEnsures = new Map<string, Promise<UserProfile>>();

export async function ensureUserProfile(
  user: User,
  overrides?: EnsureProfileOverrides,
): Promise<UserProfile> {
  const emailKey = (overrides?.email || user.email || '').trim().toLowerCase();
  const mergedOverrides =
    overrides ??
    (emailKey ? pendingSignupOverridesByEmail.get(emailKey) : undefined) ??
    pendingGoogleSignupOverrides ??
    undefined;

  const existingTask = inFlightProfileEnsures.get(user.uid);
  if (existingTask) {
    return existingTask;
  }

  const task = ensureUserProfileInternal(user, mergedOverrides).finally(() => {
    if (inFlightProfileEnsures.get(user.uid) === task) {
      inFlightProfileEnsures.delete(user.uid);
    }
  });
  inFlightProfileEnsures.set(user.uid, task);
  return task;
}

async function getDocWithTransientRetry(
  userRef: ReturnType<typeof doc>,
): Promise<Awaited<ReturnType<typeof getDoc>> | null> {
  const delays = [450, 1000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await getDoc(userRef);
    } catch (err) {
      if (!isTransientUnavailableError(err)) {
        throw err;
      }
      if (attempt < delays.length) {
        await new Promise((r) => window.setTimeout(r, delays[attempt]));
      }
    }
  }
  return null;
}

async function setDocWithTransientRetry(
  userRef: ReturnType<typeof doc>,
  payload: Record<string, unknown>,
): Promise<boolean> {
  const delays = [500, 1100];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      await setDoc(userRef, payload);
      return true;
    } catch (err) {
      if (!isTransientUnavailableError(err)) {
        throw err;
      }
      if (attempt < delays.length) {
        await new Promise((r) => window.setTimeout(r, delays[attempt]));
      }
    }
  }
  return false;
}

async function ensureUserProfileInternal(
  user: User,
  overrides?: EnsureProfileOverrides,
): Promise<UserProfile> {
  const emailKey = (overrides?.email || user.email || '').trim().toLowerCase();
  const effectiveOverrides =
    overrides ??
    (emailKey ? pendingSignupOverridesByEmail.get(emailKey) : undefined) ??
    pendingGoogleSignupOverrides ??
    undefined;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap: Awaited<ReturnType<typeof getDoc>> | null = null;
  try {
    snap = await getDocWithTransientRetry(userRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (snap === null) {
    return buildFallbackProfile(user, effectiveOverrides);
  }

  if (snap.exists()) {
    const d = snap.data() as Record<string, unknown>;
    const rawPresence = String(d.presenceStatus || 'online');
    const presenceStatus: PresenceStatus =
      rawPresence === 'busy' || rawPresence === 'hidden' ? rawPresence : 'online';
    const rawGuardian =
      d.guardianData && typeof d.guardianData === 'object'
        ? (d.guardianData as Record<string, unknown>)
        : null;
    const resolvedEmail =
      (typeof d.email === 'string' && d.email.trim()) ||
      effectiveOverrides?.email ||
      user.email ||
      '';
    const resolvedUsername = String(
      d.username ||
        sanitizeUsername(user.email?.split('@')[0] || 'creador', user.uid, {
          allowReservedOfficial: isOfficialViroklipzEmail(resolvedEmail),
        }),
    );
    const breakdown = calculateProgressiveFollowers(
      { username: resolvedUsername, email: resolvedEmail },
      d.followersCount,
      d.realFollowersCount,
    );
    const resolvedIsVerified = Boolean(d.isVerified ?? false) || breakdown.isOfficial;
    const resolvedIsAdmin = Boolean(d.isAdmin ?? false) || breakdown.isOfficial;

    if (
      breakdown.isOfficial &&
      (d.isVerified !== true ||
        d.isAdmin !== true ||
        d.followersCount !== breakdown.followersCount ||
        typeof d.realFollowersCount !== 'number' ||
        typeof d.seededFollowersCount !== 'number')
    ) {
      try {
        await updateDoc(userRef, {
          isAdmin: true,
          isVerified: true,
          realFollowersCount: breakdown.realFollowersCount,
          seededFollowersCount: breakdown.seededFollowersCount,
          followersCount: breakdown.followersCount,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('No se pudo sincronizar automáticamente el perfil oficial @viroklipz:', err);
      }
    }

    return {
      uid: String(d.uid || user.uid),
      username: resolvedUsername,
      displayName: String(d.displayName || effectiveOverrides?.displayName || user.displayName || 'Creador'),
      bio: String(d.bio || ''),
      bioColor: typeof d.bioColor === 'string' && d.bioColor ? d.bioColor : '#FFFFFF',
      personalLink: typeof d.personalLink === 'string' ? d.personalLink : '',
      pronouns: typeof d.pronouns === 'string' ? d.pronouns : '',
      avatarUrl: String(d.avatarUrl || ''),
      isPublic: Boolean(d.isPublic ?? true),
      isAdmin: resolvedIsAdmin,
      isVerified: resolvedIsVerified,
      followersCount: breakdown.followersCount,
      realFollowersCount: breakdown.realFollowersCount,
      seededFollowersCount: breakdown.seededFollowersCount,
      ...(resolvedEmail ? { email: resolvedEmail } : {}),
      fcmToken:
        typeof d.fcmToken === 'string'
          ? d.fcmToken
          : typeof d.fcmTokenWeb === 'string'
            ? d.fcmTokenWeb
            : undefined,
      fcmTokenWeb: typeof d.fcmTokenWeb === 'string' ? d.fcmTokenWeb : undefined,
      presenceStatus,
      mutedCommunityChat: Boolean(d.mutedCommunityChat ?? false),
      fanLevel:
        typeof d.fanLevel === 'number' && Number.isFinite(d.fanLevel)
          ? Math.min(50, Math.max(1, Math.floor(d.fanLevel)))
          : 1,
      fanPoints:
        typeof d.fanPoints === 'number' && Number.isFinite(d.fanPoints)
          ? Math.max(0, Math.floor(d.fanPoints))
          : 0,
      coins:
        typeof d.coins === 'number' && Number.isFinite(d.coins)
          ? Math.max(0, Math.floor(d.coins))
          : 0,
      freeRoses:
        typeof d.freeRoses === 'number' && Number.isFinite(d.freeRoses)
          ? Math.max(0, Math.floor(d.freeRoses))
          : 0,
      welcomeRechargeClaimed: Boolean(d.welcomeRechargeClaimed ?? false),
      age: typeof d.age === 'number' ? d.age : undefined,
      isMinor: typeof d.isMinor === 'boolean' ? d.isMinor : undefined,
      guardianData: rawGuardian
        ? {
            name: String(rawGuardian.name || ''),
            surname: String(rawGuardian.surname || ''),
            id: String(rawGuardian.id || ''),
            authorized: Boolean(rawGuardian.authorized),
          }
        : undefined,
      createdAtMs: toMillis(d.createdAt),
      updatedAtMs: toMillis(d.updatedAt),
    };
  }

  const fallback = buildFallbackProfile(user, effectiveOverrides);
  const effectiveEmail = (effectiveOverrides?.email || user.email || '').trim().slice(0, MAX_EMAIL_LEN);
  const isOfficialEmail = isOfficialViroklipzEmail(effectiveEmail);
  let uniqueUsername = fallback.username;
  if (!isOfficialEmail) {
    try {
      const collisionSnap = await getDocs(
        query(collection(db, 'users'), where('username', '==', uniqueUsername), limit(2)),
      );
      const takenByOther = collisionSnap.docs.some((docSnap) => docSnap.id !== user.uid);
      if (takenByOther) {
        uniqueUsername = makeUniqueUsernameWithUid(uniqueUsername, user.uid);
      }
    } catch {
      uniqueUsername = makeUniqueUsernameWithUid(uniqueUsername, user.uid);
    }
  }
  const initialBreakdown = calculateProgressiveFollowers(
    { username: uniqueUsername, email: effectiveEmail },
    0,
    0,
  );
  const userDocPayload: Record<string, unknown> = {
    uid: user.uid,
    username: uniqueUsername,
    displayName: fallback.displayName,
    bio: '',
    avatarUrl: fallback.avatarUrl,
    isPublic: true,
    followersCount: initialBreakdown.followersCount,
    realFollowersCount: initialBreakdown.realFollowersCount,
    seededFollowersCount: initialBreakdown.seededFollowersCount,
    ...(initialBreakdown.isOfficial && user.emailVerified ? { isAdmin: true, isVerified: true } : {}),
    ...(effectiveEmail ? { email: effectiveEmail } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof effectiveOverrides?.age === 'number') {
    userDocPayload.age = effectiveOverrides.age;
  }
  if (typeof effectiveOverrides?.isMinor === 'boolean') {
    userDocPayload.isMinor = effectiveOverrides.isMinor;
  } else {
    userDocPayload.isMinor = false;
  }
  if (effectiveOverrides?.isMinor && effectiveOverrides.guardianData) {
    userDocPayload.guardianData = {
      name: effectiveOverrides.guardianData.name,
      surname: effectiveOverrides.guardianData.surname,
      id: effectiveOverrides.guardianData.id,
      authorized: true,
    };
  }

  let persisted = false;
  try {
    persisted = await setDocWithTransientRetry(userRef, userDocPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  if (!persisted) {
    return { ...fallback, username: uniqueUsername };
  }

  try {
    await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
      uid: user.uid,
      firstName: '',
      lastName: '',
      phone: '',
      email: effectiveEmail,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo inicializar private/info (no bloquea el acceso):', err);
  }

  return { ...fallback, username: uniqueUsername };
}

export async function updateUserProfile(
  uid: string,
  updates: {
    username: string;
    displayName: string;
    bio: string;
    bioColor?: string;
    personalLink?: string;
    pronouns?: string;
  },
): Promise<void> {
  const path = `users/${uid}`;
  const isOfficialEmail = isOfficialViroklipzEmail(auth.currentUser?.email);
  const requestedRaw = updates.username.trim().toLowerCase();
  if (requestedRaw === OFFICIAL_VIROKLIPZ_USERNAME && !isOfficialEmail) {
    throw new Error('El usuario @viroklipz está reservado exclusivamente para la cuenta oficial.');
  }
  const cleanUsername = sanitizeUsername(updates.username, uid, {
    allowReservedOfficial: isOfficialEmail,
  });
  try {
    const existingHandleSnap = await getDocs(
      query(collection(db, 'users'), where('username', '==', cleanUsername), limit(2)),
    );
    const takenByOther = existingHandleSnap.docs.some((docSnap) => docSnap.id !== uid);
    if (takenByOther) {
      throw new Error('Ese @usuario ya pertenece a otra cuenta individual. Elige otro distinto.');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('pertenece a otra cuenta')) {
      throw err;
    }
  }
  const cleanDisplayName =
    updates.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador';
  const payload: Record<string, unknown> = {
    username: cleanUsername,
    displayName: cleanDisplayName,
    bio: updates.bio.trim().slice(0, MAX_BIO_LEN),
    updatedAt: serverTimestamp(),
  };
  if (updates.bioColor !== undefined) {
    payload.bioColor = updates.bioColor.trim().slice(0, MAX_BIO_COLOR_LEN) || '#FFFFFF';
  }
  if (updates.personalLink !== undefined) {
    payload.personalLink = sanitizePersonalLink(updates.personalLink).slice(0, MAX_PERSONAL_LINK_LEN);
  }
  if (updates.pronouns !== undefined) {
    payload.pronouns = updates.pronouns.trim().slice(0, MAX_PRONOUNS_LEN);
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }

  try {
    const clipsSnap = await getDocs(query(collection(db, 'clips'), where('authorId', '==', uid)));
    if (!clipsSnap.empty) {
      const docs = clipsSnap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = writeBatch(db);
        docs.slice(i, i + 400).forEach((clipDoc) => {
          batch.update(clipDoc.ref, {
            authorDisplayName: cleanDisplayName,
            authorUsername: cleanUsername,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }
  } catch (syncErr) {
    console.warn('No se pudieron sincronizar los klips tras actualizar perfil:', syncErr);
  }
}

export function subscribeUserPrivateInfo(
  uid: string,
  onData: (info: UserPrivateInfo) => void,
): Unsubscribe {
  const path = `users/${uid}/private/info`;
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'info'),
    (snap) => {
      if (!snap.exists()) {
        onData({
          uid,
          firstName: '',
          lastName: '',
          phone: '',
          email: '',
        });
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid || uid),
        firstName: String(d.firstName || ''),
        lastName: String(d.lastName || ''),
        phone: String(d.phone || ''),
        email: String(d.email || ''),
      });
    },
    (err) => handleFirestoreError(err, OperationType.GET, path),
  );
}

export async function updateUserPrivateInfo(
  uid: string,
  updates: { firstName: string; lastName: string; phone: string; email: string },
): Promise<void> {
  const path = `users/${uid}/private/info`;
  const ref = doc(db, 'users', uid, 'private', 'info');
  const payload = {
    uid,
    firstName: updates.firstName.trim().slice(0, MAX_NAME_PART_LEN),
    lastName: updates.lastName.trim().slice(0, MAX_NAME_PART_LEN),
    phone: updates.phone.trim().slice(0, MAX_PHONE_LEN),
    email: updates.email.trim().slice(0, MAX_EMAIL_LEN),
    updatedAt: serverTimestamp(),
  };

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        email: payload.email,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export const ELITE_MIN_FOLLOWERS = 2000;

export interface EliteCommunitySnapshot {
  loading: boolean;
  creators: CreatorSummary[];
  clips: ClipItem[];
}

export function subscribePublicClips(
  onData: (clips: ClipItem[]) => void,
): Unsubscribe {
  let disposed = false;
  let activeUnsub: Unsubscribe | null = null;

  const start = (useServerOrder: boolean) => {
    const q = useServerOrder
      ? query(
          collection(db, 'clips'),
          where('visibility', '==', 'public'),
          orderBy('createdAt', 'desc'),
        )
      : query(
          collection(db, 'clips'),
          where('visibility', '==', 'public'),
        );

    activeUnsub = onSnapshot(
      q,
      (snapshot) => {
        if (disposed) return;
        const items: ClipItem[] = snapshot.docs
          .map((d) => mapClipDoc(d.id, d.data() as Record<string, unknown>))
          .filter((item) => item.mediaType === 'video');
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        onData(items);
      },
      (err) => {
        if (disposed) return;
        const code = (err as { code?: string })?.code;
        if (useServerOrder && code === 'failed-precondition') {
          start(false);
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'clips');
      },
    );
  };

  start(true);
  return () => {
    disposed = true;
    activeUnsub?.();
  };
}

export function subscribeEliteCommunityClips(
  onData: (snapshot: EliteCommunitySnapshot) => void,
): Unsubscribe {
  let disposed = false;
  let usersUnsub: Unsubscribe | null = null;
  let clipUnsubs: Unsubscribe[] = [];
  let lastUidKey = '';
  let latestTopUsers: CreatorSummary[] = [];
  const chunkResults = new Map<number, ClipItem[]>();
  const loadedChunks = new Set<number>();
  let totalChunks = 0;

  onData({ loading: true, creators: [], clips: [] });

  const cleanupClipSubscriptions = () => {
    clipUnsubs.forEach((unsub) => unsub());
    clipUnsubs = [];
    chunkResults.clear();
    loadedChunks.clear();
    totalChunks = 0;
  };

  const emitMergedClips = () => {
    if (disposed) return;
    const rankMap = new Map<
      string,
      { followersCount: number; isVerified: boolean }
    >();
    latestTopUsers.forEach((creator) => {
      const followers = creator.followersCount ?? 0;
      rankMap.set(creator.uid, {
        followersCount: followers,
        isVerified: Boolean(creator.isVerified) || followers >= 10000,
      });
    });

    const merged: ClipItem[] = [];
    chunkResults.forEach((items) => {
      items.forEach((clip) => {
        const creatorMeta = rankMap.get(clip.authorId);
        if (!creatorMeta || clip.mediaType !== 'video') return;
        merged.push({
          ...clip,
          authorVerified: creatorMeta.isVerified,
          authorFollowersCount: creatorMeta.followersCount,
        });
      });
    });

    merged.sort((a, b) => {
      const followersDiff =
        (rankMap.get(b.authorId)?.followersCount ?? 0) -
        (rankMap.get(a.authorId)?.followersCount ?? 0);
      if (followersDiff !== 0) return followersDiff;
      return b.createdAtMs - a.createdAtMs;
    });

    onData({
      loading: totalChunks > 0 && loadedChunks.size < totalChunks,
      creators: latestTopUsers,
      clips: merged,
    });
  };

  const subscribeClipsForTopUsers = (topUsers: CreatorSummary[]) => {
    latestTopUsers = topUsers;
    const nextUidKey = topUsers.map((u) => u.uid).join(',');

    if (topUsers.length === 0) {
      lastUidKey = '';
      cleanupClipSubscriptions();
      onData({ loading: false, creators: [], clips: [] });
      return;
    }

    if (nextUidKey === lastUidKey && clipUnsubs.length > 0) {
      emitMergedClips();
      return;
    }

    lastUidKey = nextUidKey;
    cleanupClipSubscriptions();

    const chunks: string[][] = [];
    for (let i = 0; i < topUsers.length; i += 10) {
      chunks.push(topUsers.slice(i, i + 10).map((u) => u.uid));
    }
    totalChunks = chunks.length;

    chunks.forEach((uidChunk, chunkIdx) => {
      const clipsQuery = query(
        collection(db, 'clips'),
        where('visibility', '==', 'public'),
        where('authorId', 'in', uidChunk),
      );
      const unsub = onSnapshot(
        clipsQuery,
        (snap) => {
          if (disposed) return;
          const items = snap.docs
            .map((d) => mapClipDoc(d.id, d.data() as Record<string, unknown>))
            .filter((item) => item.mediaType === 'video');
          chunkResults.set(chunkIdx, items);
          loadedChunks.add(chunkIdx);
          emitMergedClips();
        },
        (err) => {
          if (disposed) return;
          loadedChunks.add(chunkIdx);
          emitMergedClips();
          handleFirestoreError(err, OperationType.LIST, 'clips');
        },
      );
      clipUnsubs.push(unsub);
    });
  };

  const startUsersQuery = (useIndexedQuery: boolean) => {
    const usersQuery = useIndexedQuery
      ? query(
          collection(db, 'users'),
          where('isPublic', '==', true),
          where('followersCount', '>=', ELITE_MIN_FOLLOWERS),
          orderBy('followersCount', 'desc'),
          limit(20),
        )
      : query(
          collection(db, 'users'),
          where('isPublic', '==', true),
        );

    usersUnsub = onSnapshot(
      usersQuery,
      (snap) => {
        if (disposed) return;
        const eliteCreators: CreatorSummary[] = snap.docs
          .map((d) => {
            const data = d.data();
            const username = String(data.username || 'creador');
            const email = typeof data.email === 'string' ? data.email : '';
            const breakdown = calculateProgressiveFollowers(
              { username, email },
              data.followersCount,
              data.realFollowersCount,
            );
            return {
              uid: String(data.uid || d.id),
              username,
              displayName: String(data.displayName || 'Creador'),
              bio: String(data.bio || 'Creador en Viroklipz'),
              avatarUrl: String(data.avatarUrl || ''),
              followersLabel: formatFollowersLabel(breakdown.followersCount),
              followersCount: breakdown.followersCount,
              realFollowersCount: breakdown.realFollowersCount,
              seededFollowersCount: breakdown.seededFollowersCount,
              isVerified:
                Boolean(data.isVerified ?? false) ||
                breakdown.isOfficial ||
                breakdown.followersCount >= 10000,
              fanLevel:
                typeof data.fanLevel === 'number' && Number.isFinite(data.fanLevel)
                  ? Math.min(50, Math.max(1, Math.floor(data.fanLevel)))
                  : 1,
            };
          })
          .filter((u) => (u.followersCount ?? 0) >= ELITE_MIN_FOLLOWERS)
          .sort((a, b) => (b.followersCount ?? 0) - (a.followersCount ?? 0))
          .slice(0, 20);

        subscribeClipsForTopUsers(eliteCreators);
      },
      (err) => {
        if (disposed) return;
        const code = (err as { code?: string })?.code;
        if (useIndexedQuery && code === 'failed-precondition') {
          console.warn(
            'Índice compuesto para ranking Comunidad no disponible aún; usando fallback ordenado.',
            err,
          );
          startUsersQuery(false);
          return;
        }
        onData({ loading: false, creators: [], clips: [] });
        handleFirestoreError(err, OperationType.LIST, 'users');
      },
    );
  };

  startUsersQuery(true);

  return () => {
    disposed = true;
    usersUnsub?.();
    cleanupClipSubscriptions();
  };
}

export function subscribeUserPrivateClips(
  uid: string,
  onData: (clips: ClipItem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'clips'),
    where('authorId', '==', uid),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ClipItem[] = snapshot.docs
        .map((d) => mapClipDoc(d.id, d.data() as Record<string, unknown>))
        .filter((item) => item.visibility === 'private');
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, `clips(authorId=${uid})`);
    },
  );
}

export function subscribeUserReactions(
  uid: string,
  onLikes: (ids: Set<string>) => void,
  onBookmarks: (ids: Set<string>) => void,
  onFollowing: (ids: Set<string>) => void,
): () => void {
  const likesPath = `users/${uid}/likes`;
  const unsubLikes = onSnapshot(
    query(collection(db, 'users', uid, 'likes'), where('userId', '==', uid)),
    (snap) => {
      onLikes(new Set(snap.docs.map((d) => d.id)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, likesPath),
  );

  const bookmarksPath = `users/${uid}/bookmarks`;
  const unsubBookmarks = onSnapshot(
    query(collection(db, 'users', uid, 'bookmarks'), where('userId', '==', uid)),
    (snap) => {
      onBookmarks(new Set(snap.docs.map((d) => d.id)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, bookmarksPath),
  );

  const followingPath = `users/${uid}/following`;
  const unsubFollowing = onSnapshot(
    query(collection(db, 'users', uid, 'following'), where('followerId', '==', uid)),
    (snap) => {
      onFollowing(new Set(snap.docs.map((d) => d.id)));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, followingPath),
  );

  return () => {
    unsubLikes();
    unsubBookmarks();
    unsubFollowing();
  };
}

export async function toggleClipLike(
  uid: string,
  clip: ClipItem,
  currentlyLiked: boolean,
): Promise<void> {
  const likeRef = doc(db, 'users', uid, 'likes', clip.id);
  const likePath = `users/${uid}/likes/${clip.id}`;

  if (clip.isStarter) {
    try {
      if (currentlyLiked) {
        await deleteDoc(likeRef);
      } else {
        await setDoc(likeRef, {
          userId: uid,
          clipId: clip.id,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, likePath);
    }
    return;
  }

  const clipRef = doc(db, 'clips', clip.id);
  const batch = writeBatch(db);
  if (currentlyLiked) {
    batch.delete(likeRef);
    batch.update(clipRef, { likesCount: increment(-1) });
  } else {
    batch.set(likeRef, {
      userId: uid,
      clipId: clip.id,
      createdAt: serverTimestamp(),
    });
    batch.update(clipRef, { likesCount: increment(1) });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clips/${clip.id}`);
  }
}

export async function toggleClipBookmark(
  uid: string,
  clip: ClipItem,
  currentlyBookmarked: boolean,
): Promise<void> {
  const bookmarkRef = doc(db, 'users', uid, 'bookmarks', clip.id);
  const path = `users/${uid}/bookmarks/${clip.id}`;

  if (clip.isStarter) {
    try {
      if (currentlyBookmarked) {
        await deleteDoc(bookmarkRef);
      } else {
        await setDoc(bookmarkRef, {
          userId: uid,
          clipId: clip.id,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
    return;
  }

  const clipRef = doc(db, 'clips', clip.id);
  const batch = writeBatch(db);
  if (currentlyBookmarked) {
    batch.delete(bookmarkRef);
    batch.update(clipRef, { bookmarksCount: increment(-1) });
  } else {
    batch.set(bookmarkRef, {
      userId: uid,
      clipId: clip.id,
      createdAt: serverTimestamp(),
    });
    batch.update(clipRef, { bookmarksCount: increment(1) });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `clips/${clip.id}`);
  }
}

export async function toggleFollowCreator(
  uid: string,
  targetId: string,
  targetUsername: string,
  currentlyFollowing: boolean,
): Promise<void> {
  if (uid === targetId) return;
  const followRef = doc(db, 'users', uid, 'following', targetId);
  const targetRef = doc(db, 'users', targetId);
  const path = `users/${uid}/following/${targetId}`;
  try {
    await runTransaction(db, async (tx) => {
      const [followSnap, targetSnap] = await Promise.all([
        tx.get(followRef),
        tx.get(targetRef),
      ]);
      const isAlreadyFollowing = followSnap.exists();

      if (isAlreadyFollowing || (currentlyFollowing && !followSnap.exists())) {
        if (!isAlreadyFollowing) return;
        tx.delete(followRef);
        if (targetSnap.exists()) {
          const d = targetSnap.data() as Record<string, unknown>;
          const accountRef = {
            username: String(d.username || targetUsername),
            email: typeof d.email === 'string' ? d.email : '',
          };
          const currentBreakdown = calculateProgressiveFollowers(
            accountRef,
            d.followersCount,
            d.realFollowersCount,
          );
          if (currentBreakdown.realFollowersCount > 0) {
            const nextReal = Math.max(0, currentBreakdown.realFollowersCount - 1);
            const nextBreakdown = calculateProgressiveFollowers(accountRef, nextReal, nextReal);
            tx.update(targetRef, {
              realFollowersCount: nextBreakdown.realFollowersCount,
              seededFollowersCount: nextBreakdown.seededFollowersCount,
              followersCount: nextBreakdown.followersCount,
              updatedAt: serverTimestamp(),
            });
          }
        }
        return;
      }

      tx.set(followRef, {
        followerId: uid,
        targetId,
        targetUsername: sanitizeUsername(targetUsername, targetId),
        createdAt: serverTimestamp(),
      });

      if (targetSnap.exists()) {
        const d = targetSnap.data() as Record<string, unknown>;
        const accountRef = {
          username: String(d.username || targetUsername),
          email: typeof d.email === 'string' ? d.email : '',
        };
        const currentBreakdown = calculateProgressiveFollowers(
          accountRef,
          d.followersCount,
          d.realFollowersCount,
        );
        const nextReal = currentBreakdown.realFollowersCount + 1;
        const nextBreakdown = calculateProgressiveFollowers(accountRef, nextReal, nextReal);
        tx.update(targetRef, {
          realFollowersCount: nextBreakdown.realFollowersCount,
          seededFollowersCount: nextBreakdown.seededFollowersCount,
          followersCount: nextBreakdown.followersCount,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeClipComments(
  clip: ClipItem,
  onData: (comments: ClipComment[]) => void,
): Unsubscribe {
  if (clip.isStarter) {
    const q = query(
      collection(db, 'starterComments'),
      where('clipId', '==', clip.id),
    );
    return onSnapshot(
      q,
      (snap) => {
        const items: ClipComment[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            clipId: String(data.clipId || clip.id),
            authorId: String(data.authorId || ''),
            authorUsername: String(data.authorUsername || 'creador'),
            authorAvatarUrl: String(data.authorAvatarUrl || ''),
            text: String(data.text || ''),
            createdAtMs: toMillis(data.createdAt),
            isStarterComment: false,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        onData(items);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'starterComments'),
    );
  }

  const path = `clips/${clip.id}/comments`;
  const q = query(
    collection(db, 'clips', clip.id, 'comments'),
    where('clipId', '==', clip.id),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ClipComment[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          clipId: String(data.clipId || clip.id),
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorAvatarUrl: String(data.authorAvatarUrl || ''),
          text: String(data.text || ''),
          createdAtMs: toMillis(data.createdAt),
          isStarterComment: false,
        };
      });
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function addClipComment(
  clip: ClipItem,
  profile: UserProfile,
  text: string,
): Promise<void> {
  assertCooldown('comment', 1500, 'Espera un segundo antes de comentar de nuevo.');
  const commentId = createSafeId('cmt');
  const payload = {
    id: commentId,
    clipId: clip.id,
    authorId: profile.uid,
    authorUsername: sanitizeUsername(profile.username, profile.uid),
    authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
    text: text.trim().slice(0, MAX_COMMENT_LEN),
    createdAt: serverTimestamp(),
  };

  if (clip.isStarter) {
    const path = `starterComments/${commentId}`;
    try {
      await setDoc(doc(db, 'starterComments', commentId), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    return;
  }

  const path = `clips/${clip.id}/comments/${commentId}`;
  try {
    await setDoc(doc(db, 'clips', clip.id, 'comments', commentId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteClipComment(
  clip: ClipItem,
  commentId: string,
): Promise<void> {
  if (clip.isStarter) {
    const path = `starterComments/${commentId}`;
    try {
      await deleteDoc(doc(db, 'starterComments', commentId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
    return;
  }

  const path = `clips/${clip.id}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'clips', clip.id, 'comments', commentId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function publishClip(
  profile: UserProfile,
  input: {
    caption: string;
    category: string;
    hashtags: string[];
    audioTitle: string;
    audioPreset: string;
    visualPreset: string;
    durationSec: number;
    visibility: ClipVisibility;
    mediaBlob?: Blob | null;
    mediaBytes?: Uint8Array | null;
    mediaMimeType?: string;
  },
): Promise<string> {
  assertCooldown('publishClip', 5000, 'Espera unos segundos antes de publicar otro klip.');
  const clipId = createSafeId('klip');
  let hasLocalMedia = false;
  let videoUrl = '';

  const resolvedMime =
    input.mediaMimeType || (input.mediaBlob?.type ? input.mediaBlob.type : 'video/mp4');
  if (resolvedMime.startsWith('image/') || !resolvedMime.startsWith('video/')) {
    throw new Error('Solo se permite publicar videos en Viroklipz.');
  }

  const resolvedBytes =
    input.mediaBytes && input.mediaBytes.byteLength > 0
      ? input.mediaBytes
      : input.mediaBlob
        ? new Uint8Array(await input.mediaBlob.arrayBuffer())
        : null;

  if (!resolvedBytes || resolvedBytes.byteLength === 0) {
    throw new Error('Debes grabar o seleccionar un video válido antes de publicar.');
  }

  if (resolvedBytes.byteLength > MAX_VIDEO_FILE_BYTES) {
    throw new Error('El video supera el límite máximo permitido.');
  }
  const r2Url = await uploadClipToR2IfConfigured(clipId, resolvedBytes, resolvedMime);
  if (r2Url) {
    videoUrl = r2Url;
  } else {
    const firebaseStorageUrl = await uploadClipBytesToFirebaseStorage(
      profile.uid,
      clipId,
      resolvedBytes,
      resolvedMime,
    );
    if (firebaseStorageUrl) {
      videoUrl = firebaseStorageUrl;
    } else {
      await Promise.race([
        saveClipMediaBlob(clipId, resolvedBytes, resolvedMime),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Timeout saving local media')), 12000);
        }),
      ]);
      hasLocalMedia = true;
    }
  }

  const resolvedAudioTitle = input.audioTitle.trim().slice(0, MAX_AUDIO_TITLE_LEN);
  const resolvedAudioPreset = input.audioPreset.trim().slice(0, MAX_AUDIO_PRESET_LEN);
  const resolvedCategory = input.category.trim().slice(0, MAX_CATEGORY_LEN);
  const resolvedVisibility: ClipVisibility =
    input.visibility === 'private' ? 'private' : 'public';
  const resolvedCaption = input.caption.trim().slice(0, MAX_CAPTION_LEN);
  const path = `clips/${clipId}`;
  try {
    await setDoc(doc(db, 'clips', clipId), {
      id: clipId,
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorDisplayName: profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador',
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      caption: resolvedCaption,
      category: resolvedCategory,
      hashtags: input.hashtags.slice(0, MAX_HASHTAGS),
      audioTitle: resolvedAudioTitle,
      audioPreset: resolvedAudioPreset,
      visualPreset: input.visualPreset.slice(0, MAX_VISUAL_PRESET_LEN),
      videoUrl,
      mediaType: 'video',
      durationSec: Math.min(60, Math.max(3, Math.round(input.durationSec))),
      hasLocalMedia,
      visibility: resolvedVisibility,
      likesCount: 0,
      bookmarksCount: 0,
      viewsCount: 0,
      sharesCount: 0,
      replaysCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    if (hasLocalMedia) {
      await deleteClipMediaBlob(clipId);
    }
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return clipId;
}

export async function deleteUserClip(clipId: string): Promise<void> {
  const path = `clips/${clipId}`;
  try {
    await deleteDoc(doc(db, 'clips', clipId));
    await deleteClipMediaBlob(clipId);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function registerClipShare(clip: ClipItem): Promise<void> {
  if (clip.isStarter) return;
  const path = `clips/${clip.id}`;
  try {
    await updateDoc(doc(db, 'clips', clip.id), {
      sharesCount: increment(1),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function registerClipView(clip: ClipItem): Promise<void> {
  if (clip.isStarter || clip.visibility !== 'public') return;
  if (!auth.currentUser) return;
  const path = `clips/${clip.id}`;
  try {
    await updateDoc(doc(db, 'clips', clip.id), {
      viewsCount: increment(1),
    });
  } catch (err) {
    // Non-blocking view telemetry
    console.warn('View count update skipped:', path, err);
  }
}

export async function registerClipReplay(clip: ClipItem): Promise<void> {
  if (clip.isStarter || clip.visibility !== 'public') return;
  if (!auth.currentUser) return;
  const path = `clips/${clip.id}`;
  try {
    await updateDoc(doc(db, 'clips', clip.id), {
      replaysCount: increment(1),
    });
  } catch (err) {
    // Non-blocking replay telemetry
    console.warn('Replay count update skipped:', path, err);
  }
}

function getLocalDayKey(offsetDays = 0): string {
  const dt = new Date(Date.now() + offsetDays * 86_400_000);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function subscribeUserStreak(
  uid: string,
  onData: (streak: UserStreak | null) => void,
): Unsubscribe {
  const path = `users/${uid}/private/streak`;
  return onSnapshot(
    doc(db, 'users', uid, 'private', 'streak'),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        uid: String(d.uid || uid),
        currentStreak: Number(d.currentStreak || 0),
        longestStreak: Number(d.longestStreak || 0),
        lastActiveDate: String(d.lastActiveDate || ''),
      });
    },
    (err) => handleFirestoreError(err, OperationType.GET, path),
  );
}

export async function recordDailyStreakAction(uid: string): Promise<void> {
  const path = `users/${uid}/private/streak`;
  const ref = doc(db, 'users', uid, 'private', 'streak');
  const today = getLocalDayKey(0);
  const yesterday = getLocalDayKey(-1);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }

  if (!snap.exists()) {
    try {
      await setDoc(ref, {
        uid,
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: today,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
    return;
  }

  const data = snap.data();
  const lastDate = String(data.lastActiveDate || '');
  if (lastDate === today) return;

  const prevStreak = Number(data.currentStreak || 0);
  const prevLongest = Number(data.longestStreak || 0);
  const nextStreak = lastDate === yesterday ? Math.min(10000, prevStreak + 1) : 1;
  const nextLongest = Math.max(prevLongest, nextStreak);

  try {
    await updateDoc(ref, {
      currentStreak: nextStreak,
      longestStreak: nextLongest,
      lastActiveDate: today,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeChatRoom(
  roomId: ChatRoomId,
  onData: (messages: ChatMessage[]) => void,
): Unsubscribe {
  const path = `chats/${roomId}/messages`;
  const q = query(
    collection(db, 'chats', roomId, 'messages'),
    where('roomId', '==', roomId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: ChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          roomId,
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorAvatarUrl: String(data.authorAvatarUrl || ''),
          text: String(data.text || ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items.slice(-80));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function sendChatMessage(
  roomId: ChatRoomId,
  profile: UserProfile,
  text: string,
): Promise<void> {
  assertCooldown('chatMessage', 1200, 'Espera un momento antes de enviar otro mensaje.');
  const messageId = createSafeId('msg');
  const path = `chats/${roomId}/messages/${messageId}`;
  try {
    await setDoc(doc(db, 'chats', roomId, 'messages', messageId), {
      id: messageId,
      roomId,
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      text: text.trim().slice(0, MAX_COMMENT_LEN),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteChatMessage(
  roomId: ChatRoomId,
  messageId: string,
): Promise<void> {
  const path = `chats/${roomId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'chats', roomId, 'messages', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeCommunityChat(
  onData: (messages: CommunityChatMessage[]) => void,
): Unsubscribe {
  const path = 'community_chat';
  const q = query(
    collection(db, 'community_chat'),
    where('roomId', '==', 'community'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CommunityChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          roomId: 'community',
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorAvatarUrl: String(data.authorAvatarUrl || ''),
          text: String(data.text || ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items.slice(-100));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function sendCommunityChatMessage(
  profile: UserProfile,
  text: string,
): Promise<void> {
  assertCooldown('communityChat', 1200, 'Espera un momento antes de enviar otro mensaje.');
  const messageId = createSafeId('cmsg');
  const path = `community_chat/${messageId}`;
  try {
    await setDoc(doc(db, 'community_chat', messageId), {
      id: messageId,
      roomId: 'community',
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      text: text.trim().slice(0, MAX_COMMENT_LEN),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCommunityChatMessage(messageId: string): Promise<void> {
  const path = `community_chat/${messageId}`;
  try {
    await deleteDoc(doc(db, 'community_chat', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function updateUserPresenceStatus(
  uid: string,
  presenceStatus: PresenceStatus,
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      presenceStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateCommunityChatMute(
  uid: string,
  mutedCommunityChat: boolean,
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      mutedCommunityChat,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeUserBlocked(
  uid: string,
  onData: (blocked: BlockedUserEntry[]) => void,
): Unsubscribe {
  const path = `users/${uid}/blocked`;
  const q = query(collection(db, 'users', uid, 'blocked'), where('blockerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items: BlockedUserEntry[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          targetId: String(data.targetId || d.id),
          targetUsername: String(data.targetUsername || 'usuario'),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function blockUser(
  uid: string,
  targetId: string,
  targetUsername: string,
): Promise<void> {
  if (uid === targetId) return;
  const path = `users/${uid}/blocked/${targetId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'blocked', targetId), {
      blockerId: uid,
      targetId,
      targetUsername: sanitizeUsername(targetUsername, targetId),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function unblockUser(uid: string, targetId: string): Promise<void> {
  const path = `users/${uid}/blocked/${targetId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'blocked', targetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function submitContentReport(input: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  targetAuthorId: string;
  reason: ReportReason;
  details: string;
}): Promise<void> {
  assertCooldown('report', 3000, 'Espera unos segundos antes de enviar otro reporte.');
  const reportId = createSafeId('rep');
  const path = `reports/${reportId}`;
  try {
    await setDoc(doc(db, 'reports', reportId), {
      id: reportId,
      reporterId: input.reporterId,
      reporterUid: input.reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.targetType === 'clip' ? { videoId: input.targetId } : {}),
      targetAuthorId: input.targetAuthorId,
      reason: input.reason,
      details: input.details.trim().slice(0, MAX_REPORT_DETAILS_LEN),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function saveUserFcmTokenWeb(uid: string, token: string): Promise<void> {
  const cleanToken = token.trim().slice(0, MAX_FCM_TOKEN_LEN);
  if (!cleanToken) return;
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fcmToken: cleanToken,
      fcmTokenWeb: cleanToken,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export const saveUserFcmToken = saveUserFcmTokenWeb;

export function subscribeHashtagSearchClips(
  hashtag: string,
  onData: (clips: ClipItem[]) => void,
): Unsubscribe {
  const cleanTag = hashtag.replace(/^#+/, '').trim().toLowerCase();
  if (!cleanTag) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'clips'),
    where('visibility', '==', 'public'),
    where('hashtags', 'array-contains', cleanTag),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ClipItem[] = snapshot.docs.map((d) =>
        mapClipDoc(d.id, d.data() as Record<string, unknown>),
      );
      items.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'clips');
    },
  );
}

export function subscribeUsernamePrefixSearch(
  rawText: string,
  onData: (users: CreatorSummary[]) => void,
): Unsubscribe {
  const cleanPrefix = rawText.trim().toLowerCase().replace(/^@+/, '');
  if (!cleanPrefix) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, 'users'),
    where('isPublic', '==', true),
    where('username', '>=', cleanPrefix),
    where('username', '<=', `${cleanPrefix}\uf8ff`),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: CreatorSummary[] = snap.docs.map((d) => {
        const data = d.data();
        const username = String(data.username || 'creador');
        const email = typeof data.email === 'string' ? data.email : '';
        const breakdown = calculateProgressiveFollowers(
          { username, email },
          data.followersCount,
          data.realFollowersCount,
        );
        return {
          uid: String(data.uid || d.id),
          username,
          displayName: String(data.displayName || 'Creador'),
          bio: String(data.bio || 'Creador en Viroklipz'),
          avatarUrl: String(data.avatarUrl || ''),
          followersLabel: formatFollowersLabel(breakdown.followersCount),
          followersCount: breakdown.followersCount,
          realFollowersCount: breakdown.realFollowersCount,
          seededFollowersCount: breakdown.seededFollowersCount,
          isVerified:
            Boolean(data.isVerified ?? false) ||
            breakdown.isOfficial ||
            breakdown.followersCount >= 10000,
          fanLevel:
            typeof data.fanLevel === 'number' && Number.isFinite(data.fanLevel)
              ? Math.min(50, Math.max(1, Math.floor(data.fanLevel)))
              : 1,
        };
      });
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
  );
}

export function buildDirectThreadId(uidA: string, uidB: string): string {
  const cleanA = uidA.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56) || 'u1';
  const cleanB = uidB.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 56) || 'u2';
  const sorted = [cleanA, cleanB].sort();
  return `dm_${sorted[0]}__${sorted[1]}`.slice(0, 128);
}

export function subscribePublicUsers(
  onData: (users: CreatorSummary[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'users'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items: CreatorSummary[] = snap.docs.map((d) => {
        const data = d.data();
        const username = String(data.username || 'creador');
        const email = typeof data.email === 'string' ? data.email : '';
        const breakdown = calculateProgressiveFollowers(
          { username, email },
          data.followersCount,
          data.realFollowersCount,
        );
        return {
          uid: String(data.uid || d.id),
          username,
          displayName: String(data.displayName || 'Creador'),
          bio: String(data.bio || 'Creador en Viroklipz'),
          avatarUrl: String(data.avatarUrl || ''),
          followersLabel: formatFollowersLabel(breakdown.followersCount),
          followersCount: breakdown.followersCount,
          realFollowersCount: breakdown.realFollowersCount,
          seededFollowersCount: breakdown.seededFollowersCount,
          isVerified:
            Boolean(data.isVerified ?? false) ||
            breakdown.isOfficial ||
            breakdown.followersCount >= 10000,
          fanLevel:
            typeof data.fanLevel === 'number' && Number.isFinite(data.fanLevel)
              ? Math.min(50, Math.max(1, Math.floor(data.fanLevel)))
              : 1,
        };
      });
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users'),
  );
}

export function subscribeStatusNotes(
  onData: (notes: StatusNote[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'statusNotes'),
    where('presence', 'in', ['online', 'busy', 'hidden']),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: StatusNote[] = snap.docs.map((d) => {
        const data = d.data();
        const presenceRaw = String(data.presence || 'online');
        const presence: PresenceStatus =
          presenceRaw === 'busy' || presenceRaw === 'hidden' ? presenceRaw : 'online';
        return {
          uid: String(data.uid || d.id),
          username: String(data.username || 'creador'),
          displayName: String(data.displayName || 'Creador'),
          avatarUrl: String(data.avatarUrl || ''),
          note: String(data.note || ''),
          presence,
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'statusNotes'),
  );
}

export async function saveStatusNote(
  profile: UserProfile,
  note: string,
  presence: PresenceStatus,
): Promise<void> {
  assertCooldown('statusNote', 1200, 'Espera un momento antes de actualizar tu nota.');
  const path = `statusNotes/${profile.uid}`;
  try {
    await setDoc(doc(db, 'statusNotes', profile.uid), {
      uid: profile.uid,
      username: sanitizeUsername(profile.username, profile.uid),
      displayName: profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador',
      avatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      note: note.trim().slice(0, MAX_NOTE_LEN),
      presence,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteStatusNote(uid: string): Promise<void> {
  const path = `statusNotes/${uid}`;
  try {
    await deleteDoc(doc(db, 'statusNotes', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

function getCalendarDayDiff(fromMs: number, toMs: number): number | null {
  if (!fromMs) return null;
  const fromDate = new Date(fromMs);
  const toDate = new Date(toMs);
  const fromDayUtc = Date.UTC(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );
  const toDayUtc = Date.UTC(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate(),
  );
  return Math.round((toDayUtc - fromDayUtc) / 86_400_000);
}

function computeNextChatStreak(
  prevStreakVal: unknown,
  lastMessageDateVal: unknown,
): number {
  const prevStreak =
    typeof prevStreakVal === 'number' && Number.isFinite(prevStreakVal)
      ? Math.max(0, Math.floor(prevStreakVal))
      : 0;
  const lastMs = toMillis(lastMessageDateVal);
  const diffDays = getCalendarDayDiff(lastMs, Date.now());
  if (diffDays === null || diffDays > 1 || diffDays < 0) {
    return 1;
  }
  if (diffDays === 1) {
    return prevStreak + 1;
  }
  return prevStreak;
}

export function subscribeUserDirectThreads(
  uid: string,
  onData: (threads: DirectThread[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'directThreads'),
    where('participantIds', 'array-contains', uid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DirectThread[] = snap.docs.map((d) => {
        const data = d.data();
        const rawParticipants = Array.isArray(data.participantIds)
          ? data.participantIds.map(String)
          : [uid, ''];
        return {
          id: String(data.id || d.id),
          participantIds: [rawParticipants[0] || '', rawParticipants[1] || ''],
          lastMessageText: String(data.lastMessageText || ''),
          lastSenderId: String(data.lastSenderId || ''),
          streak: typeof data.streak === 'number' ? data.streak : 0,
          lastMessageDateMs: toMillis(data.lastMessageDate),
          createdAtMs: toMillis(data.createdAt),
          updatedAtMs: toMillis(data.updatedAt),
        };
      });
      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'directThreads'),
  );
}

export function subscribeDirectThreadMessages(
  threadId: string,
  onData: (messages: DirectMessage[]) => void,
): Unsubscribe {
  const path = `directThreads/${threadId}/messages`;
  const q = query(
    collection(db, 'directThreads', threadId, 'messages'),
    where('threadId', '==', threadId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: DirectMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          threadId,
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorAvatarUrl: String(data.authorAvatarUrl || ''),
          text: String(data.text || ''),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items.slice(-100));
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path),
  );
}

export async function sendDirectMessage(
  profile: UserProfile,
  targetUserId: string,
  text: string,
  _knownThreadExists: boolean,
): Promise<string> {
  assertCooldown('directMessage', 900, 'Espera un momento antes de enviar otro mensaje.');
  const cleanTarget = targetUserId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanTarget || cleanTarget === profile.uid) {
    throw new Error('Destinatario no válido.');
  }
  const threadId = buildDirectThreadId(profile.uid, cleanTarget);
  const threadRef = doc(db, 'directThreads', threadId);
  const cleanText = text.trim().slice(0, MAX_COMMENT_LEN);

  try {
    let existingSnapData: Record<string, unknown> | null = null;
    try {
      const snap = await getDoc(threadRef);
      if (snap.exists()) {
        existingSnapData = snap.data();
      }
    } catch {
      existingSnapData = null;
    }

    if (existingSnapData) {
      const nextStreak = computeNextChatStreak(
        existingSnapData.streak,
        existingSnapData.lastMessageDate ?? existingSnapData.updatedAt,
      );
      await updateDoc(threadRef, {
        lastMessageText: cleanText,
        lastSenderId: profile.uid,
        streak: nextStreak,
        lastMessageDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      try {
        await setDoc(threadRef, {
          id: threadId,
          participantIds: [profile.uid, cleanTarget].sort(),
          lastMessageText: cleanText,
          lastSenderId: profile.uid,
          streak: 1,
          lastMessageDate: serverTimestamp(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        const snapRetry = await getDoc(threadRef).catch(() => null);
        const retryData = snapRetry?.exists() ? snapRetry.data() : null;
        const nextStreak = retryData
          ? computeNextChatStreak(
              retryData.streak,
              retryData.lastMessageDate ?? retryData.updatedAt,
            )
          : 1;
        await updateDoc(threadRef, {
          lastMessageText: cleanText,
          lastSenderId: profile.uid,
          streak: nextStreak,
          lastMessageDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const messageId = createSafeId('dm');
    await setDoc(doc(db, 'directThreads', threadId, 'messages', messageId), {
      id: messageId,
      threadId,
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    return threadId;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `directThreads/${threadId}`);
  }
}

export async function deleteDirectMessage(
  threadId: string,
  messageId: string,
): Promise<void> {
  const path = `directThreads/${threadId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'directThreads', threadId, 'messages', messageId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function deleteUserAccount(uid: string): Promise<void> {
  const current = auth.currentUser;
  if (!current || current.uid !== uid) {
    throw new Error('Debes iniciar sesión para eliminar tu cuenta.');
  }

  await Promise.allSettled([
    deleteDoc(doc(db, 'users', uid, 'private', 'info')),
    deleteDoc(doc(db, 'users', uid, 'private', 'streak')),
    deleteDoc(doc(db, 'statusNotes', uid)),
    deleteDoc(doc(db, 'users', uid)),
    deleteClipMediaBlob(`avatar_${uid}`),
    deleteClipMediaBlob(`banner_${uid}`),
  ]);

  try {
    await deleteUser(current);
  } catch (err: unknown) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    if (code === 'auth/requires-recent-login') {
      throw new Error(
        'Por seguridad, cierra sesión, vuelve a iniciar sesión e inténtalo de nuevo para eliminar tu cuenta.',
      );
    }
    throw err;
  }
}

function sanitizeLivePreviewUrl(raw: string | null | undefined): string {
  if (!raw) return '/src/assets/images/clip_urban_dance_1795372621458.jpg';
  const trimmed = raw.trim();
  if (trimmed.length > 300) return '/src/assets/images/clip_urban_dance_1795372621458.jpg';
  if (trimmed.startsWith('/src/assets/') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return '/src/assets/images/clip_urban_dance_1795372621458.jpg';
}

function sanitizeFanPerksList(raw: unknown): FanClubPerk[] {
  if (!Array.isArray(raw)) return [];
  const items: FanClubPerk[] = [];
  for (const entry of raw.slice(0, 12)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const title = String(obj.title || '').trim().slice(0, 60);
    if (!title) continue;
    items.push({
      id: String(obj.id || createSafeId('perk')).slice(0, 48),
      title,
      minLevel: normalizeFanLevelThreshold(obj.minLevel),
    });
  }
  return items;
}

function sanitizeAudienceFavoritesList(raw: unknown): AudienceFavorite[] {
  if (!Array.isArray(raw)) return [];
  const items: AudienceFavorite[] = [];
  for (const entry of raw.slice(0, 12)) {
    if (typeof entry !== 'object' || entry === null) continue;
    const obj = entry as Record<string, unknown>;
    const action = String(obj.action || '').trim().slice(0, 80);
    const giftId = String(obj.giftId || '').trim().slice(0, 32);
    const giftName = String(obj.giftName || '').trim().slice(0, 40);
    const coins = Math.max(1, Math.min(100000, Math.round(Number(obj.coins || 10))));
    if (!action || !giftId || !giftName) continue;
    items.push({
      id: String(obj.id || createSafeId('fav')).slice(0, 48),
      action,
      giftId,
      giftName,
      coins,
    });
  }
  return items;
}

function sanitizeFanClubName(raw: unknown): string {
  const clean = typeof raw === 'string' ? raw.trim().slice(0, 36) : '';
  return clean || DEFAULT_FAN_CLUB_NAME;
}

function sanitizeFanPointsPerCoin(raw: unknown): number {
  const n = Math.round(Number(raw || DEFAULT_FAN_POINTS_PER_COIN));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_FAN_POINTS_PER_COIN;
  return Math.min(20, n);
}

function sanitizeVipAlertTitle(raw: unknown): string {
  const clean = typeof raw === 'string' ? raw.trim().slice(0, 40) : '';
  return clean || DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle;
}

function sanitizeVipAlertStyle(raw: unknown): VipAlertStyle {
  if (raw === 'electric_pulse' || raw === 'aurora_vip') return raw;
  return 'crystal_magenta';
}

function sanitizeVipAlertDuration(raw: unknown): number {
  const n = Math.round(Number(raw || DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec));
  if (!Number.isFinite(n) || n < 3) return DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec;
  return Math.min(10, n);
}

export async function updateUserFanLevelConfig(
  uid: string,
  input: { fanLevel: number; fanPoints?: number },
): Promise<{ fanLevel: number; fanPoints: number }> {
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Inicia sesión para configurar tu nivel de fan.');
  }
  const safeLevel = Math.min(50, Math.max(1, Math.round(Number(input.fanLevel || 1))));
  const minPointsForLevel = Math.max(0, (safeLevel - 1) * 50);
  const safePoints =
    typeof input.fanPoints === 'number' && Number.isFinite(input.fanPoints)
      ? Math.min(10_000_000, Math.max(minPointsForLevel, Math.round(input.fanPoints)))
      : minPointsForLevel;

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      fanLevel: safeLevel,
      fanPoints: safePoints,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
  return { fanLevel: safeLevel, fanPoints: safePoints };
}

export function subscribeCreatorLiveConfig(
  creatorUid: string,
  onData: (config: CreatorLiveConfig) => void,
): Unsubscribe {
  if (!creatorUid) {
    return () => {};
  }
  const ref = doc(db, 'liveConfigs', creatorUid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({
          creatorUid,
          fanPerks: DEFAULT_FAN_PERKS,
          audienceFavorites: DEFAULT_AUDIENCE_FAVORITES,
          fanClubName: DEFAULT_FAN_CLUB_NAME,
          fanPointsPerCoin: DEFAULT_FAN_POINTS_PER_COIN,
          vipAlertEnabled: DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
          vipAlertTitle: DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
          vipAlertStyle: DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle,
          vipAlertDurationSec: DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
          vipAlertSound: DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
          updatedAtMs: Date.now(),
        });
        return;
      }
      const d = snap.data();
      onData({
        creatorUid: String(d.creatorUid || creatorUid),
        fanPerks: sanitizeFanPerksList(d.fanPerks),
        audienceFavorites: sanitizeAudienceFavoritesList(d.audienceFavorites),
        fanClubName: sanitizeFanClubName(d.fanClubName),
        fanPointsPerCoin: sanitizeFanPointsPerCoin(d.fanPointsPerCoin),
        vipAlertEnabled:
          typeof d.vipAlertEnabled === 'boolean'
            ? d.vipAlertEnabled
            : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
        vipAlertTitle: sanitizeVipAlertTitle(d.vipAlertTitle),
        vipAlertStyle: sanitizeVipAlertStyle(d.vipAlertStyle),
        vipAlertDurationSec: sanitizeVipAlertDuration(d.vipAlertDurationSec),
        vipAlertSound:
          typeof d.vipAlertSound === 'boolean'
            ? d.vipAlertSound
            : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
        updatedAtMs: toMillis(d.updatedAt),
      });
    },
    (err) => {
      console.warn('No se pudo leer liveConfigs:', creatorUid, err);
      onData({
        creatorUid,
        fanPerks: DEFAULT_FAN_PERKS,
        audienceFavorites: DEFAULT_AUDIENCE_FAVORITES,
        fanClubName: DEFAULT_FAN_CLUB_NAME,
        fanPointsPerCoin: DEFAULT_FAN_POINTS_PER_COIN,
        vipAlertEnabled: DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
        vipAlertTitle: DEFAULT_VIP_ALERT_CONFIG.vipAlertTitle,
        vipAlertStyle: DEFAULT_VIP_ALERT_CONFIG.vipAlertStyle,
        vipAlertDurationSec: DEFAULT_VIP_ALERT_CONFIG.vipAlertDurationSec,
        vipAlertSound: DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
        updatedAtMs: Date.now(),
      });
    },
  );
}

export async function saveCreatorLiveConfig(
  creatorUid: string,
  input: {
    fanPerks: FanClubPerk[];
    audienceFavorites: AudienceFavorite[];
    fanClubName?: string;
    fanPointsPerCoin?: number;
    vipAlertEnabled?: boolean;
    vipAlertTitle?: string;
    vipAlertStyle?: VipAlertStyle;
    vipAlertDurationSec?: number;
    vipAlertSound?: boolean;
  },
): Promise<void> {
  if (!creatorUid || !auth.currentUser || auth.currentUser.uid !== creatorUid) {
    throw new Error('Inicia sesión como anfitrión para guardar esta configuración.');
  }
  const path = `liveConfigs/${creatorUid}`;
  const fanPerks = sanitizeFanPerksList(input.fanPerks);
  const audienceFavorites = sanitizeAudienceFavoritesList(input.audienceFavorites);
  const fanClubName = sanitizeFanClubName(input.fanClubName);
  const fanPointsPerCoin = sanitizeFanPointsPerCoin(input.fanPointsPerCoin);
  const vipAlertEnabled =
    typeof input.vipAlertEnabled === 'boolean'
      ? input.vipAlertEnabled
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled;
  const vipAlertTitle = sanitizeVipAlertTitle(input.vipAlertTitle);
  const vipAlertStyle = sanitizeVipAlertStyle(input.vipAlertStyle);
  const vipAlertDurationSec = sanitizeVipAlertDuration(input.vipAlertDurationSec);
  const vipAlertSound =
    typeof input.vipAlertSound === 'boolean'
      ? input.vipAlertSound
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound;

  try {
    await setDoc(doc(db, 'liveConfigs', creatorUid), {
      creatorUid,
      fanPerks,
      audienceFavorites,
      fanClubName,
      fanPointsPerCoin,
      vipAlertEnabled,
      vipAlertTitle,
      vipAlertStyle,
      vipAlertDurationSec,
      vipAlertSound,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

function mapLiveStreamDoc(id: string, data: Record<string, unknown>): LiveStreamRecord {
  const rawAudience = String(data.audience || 'public');
  const rawQuality = String(data.quality || '720p');
  const rawEffect = String(data.visualEffect || 'none');
  const rawBg = String(data.backgroundPreset || 'camera');
  const rawCommentPerm = String(data.commentPermission || 'all');

  const backgroundPreset: LiveBackgroundPreset = (
    ['camera', 'blur', 'studio_magenta', 'studio_blue', 'studio_dark'].includes(rawBg)
      ? rawBg
      : 'camera'
  ) as LiveBackgroundPreset;

  const commentPermission: LiveCommentPermission = (
    ['all', 'followers', 'off'].includes(rawCommentPerm) ? rawCommentPerm : 'all'
  ) as LiveCommentPermission;

  return {
    id: String(data.id || id),
    hostUid: String(data.hostUid || ''),
    hostUsername: String(data.hostUsername || 'creador'),
    hostDisplayName: String(data.hostDisplayName || 'Creador'),
    hostAvatarUrl: String(data.hostAvatarUrl || ''),
    title: String(data.title || 'En vivo en Viroklipz'),
    about: typeof data.about === 'string' ? data.about : '',
    audience: rawAudience === 'friends' ? 'friends' : 'public',
    quality: rawQuality === '1080p' ? '1080p' : '720p',
    visualEffect: (
      ['none', 'neon_purple', 'electric_blue', 'magenta_glow', 'noir'].includes(rawEffect)
        ? rawEffect
        : 'none'
    ) as LiveVisualEffect,
    backgroundPreset,
    commentPermission,
    giftsEnabled: typeof data.giftsEnabled === 'boolean' ? data.giftsEnabled : true,
    noiseCancellation:
      typeof data.noiseCancellation === 'boolean' ? data.noiseCancellation : false,
    category: (data.category || 'general') as ClipCategory,
    previewImageUrl: String(data.previewImageUrl || ''),
    streamUrl: sanitizeMediaUrl(typeof data.streamUrl === 'string' ? data.streamUrl : ''),
    guestUid: typeof data.guestUid === 'string' ? data.guestUid : '',
    guestDisplayName: typeof data.guestDisplayName === 'string' ? data.guestDisplayName : '',
    guestStreamUrl: sanitizeMediaUrl(
      typeof data.guestStreamUrl === 'string' ? data.guestStreamUrl : '',
    ),
    guests: Array.isArray(data.guests)
      ? data.guests.filter((item): item is string => typeof item === 'string').slice(0, 10)
      : [],
    audioPreset: (data.audioPreset || 'urban_beat') as AudioPreset,
    status: data.status === 'ended' ? 'ended' : 'live',
    viewerCount: Math.max(1, Number(data.viewerCount || 1)),
    likesCount: Math.max(0, Number(data.likesCount || 0)),
    giftsCount: Math.max(0, Number(data.giftsCount || 0)),
    fanPerks: sanitizeFanPerksList(data.fanPerks),
    audienceFavorites: sanitizeAudienceFavoritesList(data.audienceFavorites),
    fanClubName: sanitizeFanClubName(data.fanClubName),
    fanPointsPerCoin: sanitizeFanPointsPerCoin(data.fanPointsPerCoin),
    vipAlertEnabled:
      typeof data.vipAlertEnabled === 'boolean'
        ? data.vipAlertEnabled
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled,
    vipAlertTitle: sanitizeVipAlertTitle(data.vipAlertTitle),
    vipAlertStyle: sanitizeVipAlertStyle(data.vipAlertStyle),
    vipAlertDurationSec: sanitizeVipAlertDuration(data.vipAlertDurationSec),
    vipAlertSound:
      typeof data.vipAlertSound === 'boolean'
        ? data.vipAlertSound
        : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound,
    startedAtMs: toMillis(data.startedAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

export function subscribeActiveLiveStreams(
  onData: (streams: LiveStreamRecord[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: LiveStreamRecord[] = snapshot.docs.map((d) =>
        mapLiveStreamDoc(d.id, d.data() as Record<string, unknown>),
      );
      items.sort((a, b) => b.startedAtMs - a.startedAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'liveStreams');
    },
  );
}

export function subscribeLiveStreamById(
  streamId: string,
  onData: (stream: LiveStreamRecord | null) => void,
): Unsubscribe {
  const path = `liveStreams/${streamId}`;
  return onSnapshot(
    doc(db, 'liveStreams', streamId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapLiveStreamDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => {
      console.warn('Error suscribiendo estado del LIVE:', path, err);
    },
  );
}

export async function startFirestoreLiveStream(
  profile: UserProfile,
  input: {
    title: string;
    about?: string;
    audience?: LiveAudience;
    quality?: LiveQuality;
    visualEffect?: LiveVisualEffect;
    backgroundPreset?: LiveBackgroundPreset;
    commentPermission?: LiveCommentPermission;
    giftsEnabled?: boolean;
    noiseCancellation?: boolean;
    category?: ClipCategory;
    previewImageUrl?: string;
    streamUrl?: string;
    guestUid?: string;
    guestDisplayName?: string;
    guestStreamUrl?: string;
    fanPerks?: FanClubPerk[];
    audienceFavorites?: AudienceFavorite[];
    fanClubName?: string;
    fanPointsPerCoin?: number;
    vipAlertEnabled?: boolean;
    vipAlertTitle?: string;
    vipAlertStyle?: VipAlertStyle;
    vipAlertDurationSec?: number;
    vipAlertSound?: boolean;
    audioPreset?: AudioPreset;
  },
): Promise<string> {
  const streamId = createSafeId('live');
  const cleanTitle = input.title.trim().slice(0, 80) || 'En vivo en Viroklipz';
  const cleanAbout = (input.about || '').trim().slice(0, 240);
  const cleanAudience: LiveAudience = input.audience === 'friends' ? 'friends' : 'public';
  const cleanQuality: LiveQuality = input.quality === '1080p' ? '1080p' : '720p';
  const cleanEffect: LiveVisualEffect = input.visualEffect || 'none';
  const cleanBackgroundPreset: LiveBackgroundPreset = input.backgroundPreset || 'camera';
  const cleanCommentPermission: LiveCommentPermission = input.commentPermission || 'all';
  const giftsEnabled = typeof input.giftsEnabled === 'boolean' ? input.giftsEnabled : true;
  const noiseCancellation =
    typeof input.noiseCancellation === 'boolean' ? input.noiseCancellation : false;
  const cleanCategory: ClipCategory =
    input.category && ALLOWED_CATEGORIES.includes(input.category) ? input.category : 'general';
  const cleanStreamUrl = sanitizeMediaUrl(input.streamUrl);
  const cleanGuestUid = (input.guestUid || '').trim().slice(0, 128);
  const cleanGuestDisplayName = (input.guestDisplayName || '').trim().slice(0, MAX_DISPLAY_NAME_LEN);
  const cleanGuestStreamUrl = sanitizeMediaUrl(input.guestStreamUrl);
  const fanPerks = sanitizeFanPerksList(input.fanPerks);
  const audienceFavorites = sanitizeAudienceFavoritesList(input.audienceFavorites);
  const fanClubName = sanitizeFanClubName(input.fanClubName);
  const fanPointsPerCoin = sanitizeFanPointsPerCoin(input.fanPointsPerCoin);
  const vipAlertEnabled =
    typeof input.vipAlertEnabled === 'boolean'
      ? input.vipAlertEnabled
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertEnabled;
  const vipAlertTitle = sanitizeVipAlertTitle(input.vipAlertTitle);
  const vipAlertStyle = sanitizeVipAlertStyle(input.vipAlertStyle);
  const vipAlertDurationSec = sanitizeVipAlertDuration(input.vipAlertDurationSec);
  const vipAlertSound =
    typeof input.vipAlertSound === 'boolean'
      ? input.vipAlertSound
      : DEFAULT_VIP_ALERT_CONFIG.vipAlertSound;
  const path = `liveStreams/${streamId}`;

  try {
    await setDoc(doc(db, 'liveStreams', streamId), {
      id: streamId,
      hostUid: profile.uid,
      hostUsername: sanitizeUsername(profile.username, profile.uid),
      hostDisplayName: profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador',
      hostAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      title: cleanTitle,
      about: cleanAbout,
      audience: cleanAudience,
      quality: cleanQuality,
      visualEffect: cleanEffect,
      backgroundPreset: cleanBackgroundPreset,
      commentPermission: cleanCommentPermission,
      giftsEnabled,
      noiseCancellation,
      category: cleanCategory,
      previewImageUrl: sanitizeLivePreviewUrl(input.previewImageUrl),
      streamUrl: cleanStreamUrl,
      ...(cleanGuestUid ? { guestUid: cleanGuestUid } : {}),
      ...(cleanGuestDisplayName ? { guestDisplayName: cleanGuestDisplayName } : {}),
      ...(cleanGuestStreamUrl ? { guestStreamUrl: cleanGuestStreamUrl } : {}),
      guests: cleanGuestUid ? [cleanGuestUid] : [],
      fanPerks,
      audienceFavorites,
      fanClubName,
      fanPointsPerCoin,
      vipAlertEnabled,
      vipAlertTitle,
      vipAlertStyle,
      vipAlertDurationSec,
      vipAlertSound,
      audioPreset: input.audioPreset || 'urban_beat',
      status: 'live',
      viewerCount: 1,
      likesCount: 0,
      giftsCount: 0,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
  return streamId;
}

export async function updateFirestoreLiveHostSettings(
  streamId: string,
  updates: {
    title?: string;
    about?: string;
    audience?: LiveAudience;
    quality?: LiveQuality;
    visualEffect?: LiveVisualEffect;
    backgroundPreset?: LiveBackgroundPreset;
    commentPermission?: LiveCommentPermission;
    giftsEnabled?: boolean;
    noiseCancellation?: boolean;
  },
): Promise<void> {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.title === 'string') {
    const clean = updates.title.trim().slice(0, 80);
    if (clean) payload.title = clean;
  }
  if (typeof updates.about === 'string') {
    payload.about = updates.about.trim().slice(0, 240);
  }
  if (updates.audience === 'public' || updates.audience === 'friends') {
    payload.audience = updates.audience;
  }
  if (updates.quality === '720p' || updates.quality === '1080p') {
    payload.quality = updates.quality;
  }
  if (typeof updates.visualEffect === 'string') {
    payload.visualEffect = updates.visualEffect.slice(0, 32);
  }
  if (updates.backgroundPreset) {
    payload.backgroundPreset = updates.backgroundPreset;
  }
  if (updates.commentPermission) {
    payload.commentPermission = updates.commentPermission;
  }
  if (typeof updates.giftsEnabled === 'boolean') {
    payload.giftsEnabled = updates.giftsEnabled;
  }
  if (typeof updates.noiseCancellation === 'boolean') {
    payload.noiseCancellation = updates.noiseCancellation;
  }

  if (Object.keys(payload).length <= 1) return;

  try {
    await updateDoc(doc(db, 'liveStreams', streamId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updateFirestoreLiveStreamPerksAndFavorites(
  streamId: string,
  input: {
    fanPerks?: FanClubPerk[];
    audienceFavorites?: AudienceFavorite[];
    fanClubName?: string;
    fanPointsPerCoin?: number;
    vipAlertEnabled?: boolean;
    vipAlertTitle?: string;
    vipAlertStyle?: VipAlertStyle;
    vipAlertDurationSec?: number;
    vipAlertSound?: boolean;
  },
): Promise<void> {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      ...(input.fanPerks ? { fanPerks: sanitizeFanPerksList(input.fanPerks) } : {}),
      ...(input.audienceFavorites
        ? { audienceFavorites: sanitizeAudienceFavoritesList(input.audienceFavorites) }
        : {}),
      ...(typeof input.fanClubName === 'string'
        ? { fanClubName: sanitizeFanClubName(input.fanClubName) }
        : {}),
      ...(typeof input.fanPointsPerCoin === 'number'
        ? { fanPointsPerCoin: sanitizeFanPointsPerCoin(input.fanPointsPerCoin) }
        : {}),
      ...(typeof input.vipAlertEnabled === 'boolean'
        ? { vipAlertEnabled: input.vipAlertEnabled }
        : {}),
      ...(typeof input.vipAlertTitle === 'string'
        ? { vipAlertTitle: sanitizeVipAlertTitle(input.vipAlertTitle) }
        : {}),
      ...(input.vipAlertStyle ? { vipAlertStyle: sanitizeVipAlertStyle(input.vipAlertStyle) } : {}),
      ...(typeof input.vipAlertDurationSec === 'number'
        ? { vipAlertDurationSec: sanitizeVipAlertDuration(input.vipAlertDurationSec) }
        : {}),
      ...(typeof input.vipAlertSound === 'boolean'
        ? { vipAlertSound: input.vipAlertSound }
        : {}),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudieron sincronizar ventajas/favoritos del LIVE:', path, err);
  }
}

export async function updateFirestoreLiveGuest(
  streamId: string,
  guest: { guestUid?: string; guestDisplayName?: string; guestStreamUrl?: string },
): Promise<void> {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      guestUid: (guest.guestUid || '').trim().slice(0, 128),
      guestDisplayName: (guest.guestDisplayName || '').trim().slice(0, MAX_DISPLAY_NAME_LEN),
      guestStreamUrl: sanitizeMediaUrl(guest.guestStreamUrl),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo actualizar el invitado multijugador del LIVE:', path, err);
  }
}

export async function endFirestoreLiveStream(streamId: string): Promise<void> {
  if (!streamId) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      status: 'ended',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo cerrar el stream en Firestore:', path, err);
  }
}

export async function incrementLiveStreamLike(streamId: string): Promise<void> {
  if (!streamId || !auth.currentUser) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      likesCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo registrar el me gusta del LIVE:', path, err);
  }
}

export async function incrementLiveStreamGift(streamId: string): Promise<void> {
  if (!streamId || !auth.currentUser) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      giftsCount: increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo registrar el regalo del LIVE:', path, err);
  }
}

export async function adjustLiveStreamViewer(
  streamId: string,
  delta: 1 | -1,
): Promise<void> {
  if (!streamId || !auth.currentUser) return;
  const path = `liveStreams/${streamId}`;
  try {
    await updateDoc(doc(db, 'liveStreams', streamId), {
      viewerCount: increment(delta),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo actualizar espectadores del LIVE:', path, err);
  }
}

interface CreatorFanLevelMilestone {
  level: number;
  minCoins: number;
  title: string;
}

const CREATOR_FAN_LEVEL_MILESTONES: readonly CreatorFanLevelMilestone[] = [
  { level: 1, minCoins: 0, title: 'Nuevo Fan' },
  { level: 2, minCoins: 1, title: 'Simpatizante' },
  { level: 3, minCoins: 40, title: 'Simpatizante' },
  { level: 4, minCoins: 75, title: 'Simpatizante' },
  { level: 5, minCoins: 100, title: 'Seguidor Fiel' },
  { level: 6, minCoins: 175, title: 'Seguidor Fiel' },
  { level: 7, minCoins: 250, title: 'Seguidor Fiel' },
  { level: 8, minCoins: 350, title: 'Seguidor Fiel' },
  { level: 9, minCoins: 450, title: 'Seguidor Fiel' },
  { level: 10, minCoins: 500, title: 'Súper Fan' },
  { level: 11, minCoins: 700, title: 'Súper Fan' },
  { level: 12, minCoins: 900, title: 'Súper Fan' },
  { level: 13, minCoins: 1150, title: 'Súper Fan' },
  { level: 14, minCoins: 1350, title: 'Súper Fan' },
  { level: 15, minCoins: 1500, title: 'Fan VIP' },
  { level: 16, minCoins: 2100, title: 'Fan VIP' },
  { level: 17, minCoins: 2800, title: 'Fan VIP' },
  { level: 18, minCoins: 3600, title: 'Fan VIP' },
  { level: 19, minCoins: 4400, title: 'Fan VIP' },
  { level: 20, minCoins: 5000, title: 'Mecenas Estelar' },
  { level: 21, minCoins: 6000, title: 'Mecenas Estelar' },
  { level: 22, minCoins: 7000, title: 'Mecenas Estelar' },
  { level: 23, minCoins: 8000, title: 'Mecenas Estelar' },
  { level: 24, minCoins: 9000, title: 'Mecenas Estelar' },
  { level: 25, minCoins: 10000, title: 'Mecenas Estelar' },
  { level: 26, minCoins: 11000, title: 'Mecenas Estelar' },
  { level: 27, minCoins: 12000, title: 'Mecenas Estelar' },
  { level: 28, minCoins: 13000, title: 'Mecenas Estelar' },
  { level: 29, minCoins: 14000, title: 'Mecenas Estelar' },
  { level: 30, minCoins: 15000, title: 'Guardián Élite' },
  { level: 31, minCoins: 18500, title: 'Guardián Élite' },
  { level: 32, minCoins: 22000, title: 'Guardián Élite' },
  { level: 33, minCoins: 25500, title: 'Guardián Élite' },
  { level: 34, minCoins: 29000, title: 'Guardián Élite' },
  { level: 35, minCoins: 32500, title: 'Guardián Élite' },
  { level: 36, minCoins: 36000, title: 'Guardián Élite' },
  { level: 37, minCoins: 39500, title: 'Guardián Élite' },
  { level: 38, minCoins: 43000, title: 'Guardián Élite' },
  { level: 39, minCoins: 46500, title: 'Guardián Élite' },
  { level: 40, minCoins: 50000, title: 'Leyenda del Creador' },
  { level: 41, minCoins: 60000, title: 'Leyenda del Creador' },
  { level: 42, minCoins: 70000, title: 'Leyenda del Creador' },
  { level: 43, minCoins: 80000, title: 'Leyenda del Creador' },
  { level: 44, minCoins: 90000, title: 'Leyenda del Creador' },
  { level: 45, minCoins: 100000, title: 'Leyenda del Creador' },
  { level: 46, minCoins: 110000, title: 'Leyenda del Creador' },
  { level: 47, minCoins: 120000, title: 'Leyenda del Creador' },
  { level: 48, minCoins: 130000, title: 'Leyenda del Creador' },
  { level: 49, minCoins: 140000, title: 'Leyenda del Creador' },
  { level: 50, minCoins: 150000, title: 'Leyenda del Creador' },
];

export function getFanLevelTitle(level: number): string {
  const safeLevel = Math.min(50, Math.max(1, Math.floor(level || 1)));
  if (safeLevel >= 40) return 'Leyenda del Creador';
  if (safeLevel >= 30) return 'Guardián Élite';
  if (safeLevel >= 20) return 'Mecenas Estelar';
  if (safeLevel >= 15) return 'Fan VIP';
  if (safeLevel >= 10) return 'Súper Fan';
  if (safeLevel >= 5) return 'Seguidor Fiel';
  if (safeLevel >= 2) return 'Simpatizante';
  return 'Nuevo Fan';
}

/**
 * Calcula automáticamente el nivel de fan (1-50) y el título correspondiente para mostrarlo en el chat
 * a partir de la cantidad total de monedas donadas a un creador específico.
 */
export function calculateFanLevelFromDonatedCoins(
  totalCoinsDonated: number,
): CreatorFanLevelResult {
  const safeCoins =
    typeof totalCoinsDonated === 'number' && Number.isFinite(totalCoinsDonated)
      ? Math.min(100_000_000, Math.max(0, Math.floor(totalCoinsDonated)))
      : 0;

  let currentIndex = 0;
  for (let i = 0; i < CREATOR_FAN_LEVEL_MILESTONES.length; i += 1) {
    if (safeCoins >= CREATOR_FAN_LEVEL_MILESTONES[i].minCoins) {
      currentIndex = i;
    } else {
      break;
    }
  }

  const current = CREATOR_FAN_LEVEL_MILESTONES[currentIndex];
  const next = CREATOR_FAN_LEVEL_MILESTONES[currentIndex + 1] ?? null;

  return {
    level: current.level,
    title: current.title,
    totalCoinsDonated: safeCoins,
    nextLevel: next ? next.level : null,
    nextLevelCoins: next ? next.minCoins : null,
    nextTierTitle: next ? next.title : null,
    coinsToNextLevel: next ? Math.max(0, next.minCoins - safeCoins) : 0,
  };
}

/**
 * Consulta en Firestore el total de monedas donadas por un usuario a un creador específico,
 * calcula su nivel de fan automático y devuelve el título del nivel para mostrarlo en el chat.
 */
export async function calculateCreatorFanLevel(
  userId: string,
  creatorId: string,
  options?: { additionalCoins?: number },
): Promise<CreatorFanLevelResult> {
  const additional =
    typeof options?.additionalCoins === 'number' && Number.isFinite(options.additionalCoins)
      ? Math.max(0, Math.floor(options.additionalCoins))
      : 0;

  if (!userId || !creatorId || !auth.currentUser) {
    return calculateFanLevelFromDonatedCoins(additional);
  }

  try {
    const supportSnap = await getDoc(doc(db, 'users', userId, 'creatorSupport', creatorId));
    const storedCoins = supportSnap.exists()
      ? Math.max(0, Math.floor(Number(supportSnap.data().totalCoinsDonated || 0)))
      : 0;
    return calculateFanLevelFromDonatedCoins(storedCoins + additional);
  } catch (err) {
    console.warn('No se pudo calcular el nivel de fan por creador:', err);
    return calculateFanLevelFromDonatedCoins(additional);
  }
}

export async function recordCreatorCoinDonation(
  userId: string,
  creatorId: string,
  coinsDonated: number,
): Promise<CreatorFanLevelResult> {
  const safeDonation =
    typeof coinsDonated === 'number' && Number.isFinite(coinsDonated)
      ? Math.min(100_000, Math.max(0, Math.floor(coinsDonated)))
      : 0;

  if (!userId || !creatorId || !auth.currentUser || auth.currentUser.uid !== userId) {
    return calculateFanLevelFromDonatedCoins(safeDonation);
  }

  const supportRef = doc(db, 'users', userId, 'creatorSupport', creatorId);
  try {
    const existingSnap = await getDoc(supportRef);
    const prevCoins = existingSnap.exists()
      ? Math.max(0, Math.floor(Number(existingSnap.data().totalCoinsDonated || 0)))
      : 0;
    const nextCoins = Math.min(100_000_000, prevCoins + safeDonation);
    const computed = calculateFanLevelFromDonatedCoins(nextCoins);

    if (safeDonation > 0 || !existingSnap.exists()) {
      if (existingSnap.exists()) {
        await updateDoc(supportRef, {
          totalCoinsDonated: computed.totalCoinsDonated,
          fanLevel: computed.level,
          fanTitle: computed.title,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(supportRef, {
          userId,
          creatorId,
          totalCoinsDonated: computed.totalCoinsDonated,
          fanLevel: computed.level,
          fanTitle: computed.title,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return computed;
  } catch (err) {
    console.warn('No se pudo guardar el progreso de fan por creador:', err);
    return calculateFanLevelFromDonatedCoins(safeDonation);
  }
}

export function subscribeCreatorFanStatus(
  userId: string,
  creatorId: string,
  onData: (status: CreatorFanLevelResult) => void,
): Unsubscribe {
  if (!userId || !creatorId || !auth.currentUser) {
    onData(calculateFanLevelFromDonatedCoins(0));
    return () => {};
  }

  return onSnapshot(
    doc(db, 'users', userId, 'creatorSupport', creatorId),
    (snap) => {
      if (!snap.exists()) {
        onData(calculateFanLevelFromDonatedCoins(0));
        return;
      }
      const data = snap.data();
      const totalCoins = Math.max(0, Math.floor(Number(data.totalCoinsDonated || 0)));
      onData(calculateFanLevelFromDonatedCoins(totalCoins));
    },
    (err) => {
      console.warn('No se pudo suscribir al nivel de fan por creador:', err);
      onData(calculateFanLevelFromDonatedCoins(0));
    },
  );
}

export function subscribeLiveStreamMessages(
  streamId: string,
  onData: (messages: LiveStreamMessage[]) => void,
): Unsubscribe {
  const path = `liveStreams/${streamId}/messages`;
  const q = query(
    collection(db, 'liveStreams', streamId, 'messages'),
    where('streamId', '==', streamId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: LiveStreamMessage[] = snap.docs.map((d) => {
        const data = d.data();
        const rawKind = String(data.kind || 'chat');
        const kind: 'chat' | 'like' | 'gift' | 'join' =
          rawKind === 'like'
            ? 'like'
            : rawKind === 'gift'
              ? 'gift'
              : rawKind === 'join'
                ? 'join'
                : 'chat';
        return {
          id: String(data.id || d.id),
          streamId: String(data.streamId || streamId),
          authorId: String(data.authorId || ''),
          authorUsername: String(data.authorUsername || 'creador'),
          authorDisplayName: String(data.authorDisplayName || 'Creador'),
          authorAvatarUrl: String(data.authorAvatarUrl || ''),
          text: String(data.text || ''),
          kind,
          giftId: typeof data.giftId === 'string' ? data.giftId : undefined,
          giftName: typeof data.giftName === 'string' ? data.giftName : undefined,
          giftValue: typeof data.giftValue === 'number' ? data.giftValue : undefined,
          senderFanLevel:
            typeof data.senderFanLevel === 'number' ? data.senderFanLevel : undefined,
          senderFanTitle:
            typeof data.senderFanTitle === 'string' && data.senderFanTitle.trim()
              ? data.senderFanTitle
              : typeof data.senderFanLevel === 'number'
                ? getFanLevelTitle(data.senderFanLevel)
                : undefined,
          isTop1: typeof data.isTop1 === 'boolean' ? data.isTop1 : undefined,
          triggeredAction:
            typeof data.triggeredAction === 'string' ? data.triggeredAction : undefined,
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items.slice(-50));
    },
    (err) => {
      console.warn('Error leyendo chat del LIVE:', path, err);
    },
  );
}

export async function sendLiveStreamMessage(
  streamId: string,
  profile: UserProfile,
  text: string,
  kind: 'chat' | 'like' | 'gift' | 'join' = 'chat',
  giftMeta?: {
    giftId?: string;
    giftName?: string;
    giftValue?: number;
    triggeredAction?: string;
    isTop1?: boolean;
    fanLevel?: number;
    fanTitle?: string;
  },
): Promise<void> {
  if (!streamId) return;
  if (kind === 'chat') {
    assertCooldown('liveChat', 1000, 'Espera un segundo antes de comentar en el LIVE.');
  }
  const messageId = createSafeId('lmsg');
  const path = `liveStreams/${streamId}/messages/${messageId}`;
  const cleanText =
    text.trim().slice(0, 180) ||
    (kind === 'like'
      ? 'le dio un me gusta al LIVE'
      : kind === 'join'
        ? `👋 ${profile.displayName || profile.username} se ha unido a la fiesta`
        : kind === 'gift'
          ? `envió un regalo: ${giftMeta?.giftName || 'Viroklipz'}`
          : '');
  if (!cleanText) return;
  const senderFanLevel =
    typeof giftMeta?.fanLevel === 'number' && Number.isFinite(giftMeta.fanLevel)
      ? Math.min(50, Math.max(1, Math.floor(giftMeta.fanLevel)))
      : resolveFanLevel(profile.fanLevel, profile.fanPoints);
  const senderFanTitle = (
    giftMeta?.fanTitle?.trim() || getFanLevelTitle(senderFanLevel)
  ).slice(0, 40);

  try {
    await setDoc(doc(db, 'liveStreams', streamId, 'messages', messageId), {
      id: messageId,
      streamId,
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorDisplayName: profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador',
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      text: cleanText,
      kind,
      senderFanLevel,
      senderFanTitle,
      ...(typeof giftMeta?.isTop1 === 'boolean' ? { isTop1: giftMeta.isTop1 } : {}),
      ...(giftMeta?.giftId ? { giftId: giftMeta.giftId.slice(0, 32) } : {}),
      ...(giftMeta?.giftName ? { giftName: giftMeta.giftName.slice(0, 40) } : {}),
      ...(typeof giftMeta?.giftValue === 'number'
        ? { giftValue: Math.max(0, Math.min(100000, Math.round(giftMeta.giftValue))) }
        : {}),
      ...(giftMeta?.triggeredAction
        ? { triggeredAction: giftMeta.triggeredAction.slice(0, 80) }
        : {}),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function requestToJoin(
  liveId: string,
  userId: string,
  options?: { profile?: UserProfile; seatIndex?: number },
): Promise<void> {
  if (!liveId || !userId || !auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Inicia sesión para solicitar entrar a ViroParty.');
  }
  const profile = options?.profile;
  const seatIndex = Math.min(9, Math.max(0, Math.floor(options?.seatIndex ?? 0)));
  const fanLevel = resolveFanLevel(profile?.fanLevel, profile?.fanPoints);
  const path = `liveStreams/${liveId}/joinRequests/${userId}`;

  try {
    await setDoc(doc(db, 'liveStreams', liveId, 'joinRequests', userId), {
      id: userId,
      liveId,
      userId,
      username: sanitizeUsername(profile?.username || userId, userId),
      displayName:
        (profile?.displayName || profile?.username || 'Invitado').trim().slice(0, MAX_DISPLAY_NAME_LEN) ||
        'Invitado',
      avatarUrl: sanitizeAvatarUrl(profile?.avatarUrl),
      fanLevel,
      seatIndex,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export function subscribeLiveGuests(
  streamId: string,
  onData: (guests: LiveGuestRecord[]) => void,
): Unsubscribe {
  if (!streamId) return () => {};
  const q = query(
    collection(db, 'liveStreams', streamId, 'guests'),
    where('streamId', '==', streamId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: LiveGuestRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: String(data.uid || d.id),
          streamId: String(data.streamId || streamId),
          username: String(data.username || 'invitado'),
          displayName: String(data.displayName || 'Invitado'),
          avatarUrl: String(data.avatarUrl || ''),
          fanLevel: Math.min(50, Math.max(1, Number(data.fanLevel || 1))),
          seatIndex: Math.min(9, Math.max(0, Number(data.seatIndex || 0))),
          muted: Boolean(data.muted),
          isTop1: Boolean(data.isTop1),
          joinedAtMs: toMillis(data.joinedAt),
        };
      });
      items.sort((a, b) => a.seatIndex - b.seatIndex || a.joinedAtMs - b.joinedAtMs);
      onData(items);
    },
    (err) => {
      console.warn('Error leyendo invitados de ViroParty:', err);
    },
  );
}

export function subscribeLiveJoinRequests(
  streamId: string,
  onData: (requests: LiveJoinRequest[]) => void,
): Unsubscribe {
  if (!streamId || !auth.currentUser) return () => {};
  const q = query(
    collection(db, 'liveStreams', streamId, 'joinRequests'),
    where('liveId', '==', streamId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: LiveJoinRequest[] = snap.docs
        .map((d) => {
          const data = d.data();
          const rawStatus = String(data.status || 'pending');
          const status: 'pending' | 'accepted' | 'rejected' =
            rawStatus === 'accepted'
              ? 'accepted'
              : rawStatus === 'rejected'
                ? 'rejected'
                : 'pending';
          return {
            id: String(data.id || d.id),
            liveId: String(data.liveId || streamId),
            userId: String(data.userId || d.id),
            username: String(data.username || 'usuario'),
            displayName: String(data.displayName || 'Invitado'),
            avatarUrl: String(data.avatarUrl || ''),
            fanLevel: Math.min(50, Math.max(1, Number(data.fanLevel || 1))),
            seatIndex: Math.min(9, Math.max(0, Number(data.seatIndex || 0))),
            status,
            createdAtMs: toMillis(data.createdAt),
          };
        })
        .filter((req) => req.status === 'pending');
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items);
    },
    (err) => {
      console.warn('Error leyendo cola de solicitudes ViroParty:', err);
    },
  );
}

export async function acceptLiveJoinRequest(
  liveId: string,
  req: LiveJoinRequest,
  hostProfile: UserProfile,
): Promise<void> {
  if (!liveId || !req.userId) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'liveStreams', liveId), {
    guests: arrayUnion(req.userId),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'liveStreams', liveId, 'guests', req.userId), {
    uid: req.userId,
    streamId: liveId,
    username: sanitizeUsername(req.username, req.userId),
    displayName: req.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Invitado',
    avatarUrl: sanitizeAvatarUrl(req.avatarUrl),
    fanLevel: Math.min(50, Math.max(1, Math.floor(req.fanLevel || 1))),
    seatIndex: Math.min(9, Math.max(0, Math.floor(req.seatIndex || 0))),
    muted: false,
    isTop1: false,
    joinedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'liveStreams', liveId, 'joinRequests', req.userId));

  try {
    await batch.commit();
    await sendLiveStreamMessage(
      liveId,
      hostProfile,
      `👋 ${req.displayName} se ha unido a la fiesta`,
      'join',
    ).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `liveStreams/${liveId}/guests/${req.userId}`);
  }
}

export async function rejectLiveJoinRequest(
  liveId: string,
  requesterUid: string,
): Promise<void> {
  if (!liveId || !requesterUid) return;
  try {
    await deleteDoc(doc(db, 'liveStreams', liveId, 'joinRequests', requesterUid));
  } catch (err) {
    console.warn('No se pudo rechazar la solicitud de ViroParty:', err);
  }
}

export async function toggleLiveGuestMute(
  liveId: string,
  guestUid: string,
  muted: boolean,
): Promise<void> {
  if (!liveId || !guestUid) return;
  try {
    await updateDoc(doc(db, 'liveStreams', liveId, 'guests', guestUid), {
      muted,
    });
  } catch (err) {
    console.warn('No se pudo actualizar el audio del invitado:', err);
  }
}

export async function removeLiveGuest(liveId: string, guestUid: string): Promise<void> {
  if (!liveId || !guestUid) return;
  const batch = writeBatch(db);
  batch.update(doc(db, 'liveStreams', liveId), {
    guests: arrayRemove(guestUid),
    updatedAt: serverTimestamp(),
  });
  batch.delete(doc(db, 'liveStreams', liveId, 'guests', guestUid));
  try {
    await batch.commit();
  } catch (err) {
    console.warn('No se pudo retirar al invitado de ViroParty:', err);
  }
}

export async function sendLivePartyJoinAnnouncement(
  streamId: string,
  profile: UserProfile,
): Promise<void> {
  if (!streamId || !auth.currentUser) return;
  const display = profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || profile.username;
  await sendLiveStreamMessage(
    streamId,
    profile,
    `👋 ${display} se ha unido a la fiesta`,
    'join',
  ).catch(() => {});
}

export class InsufficientCoinsError extends Error {
  requiredCoins: number;
  currentCoins: number;
  giftName: string;
  isFirstWelcomeEligible: boolean;

  constructor(
    requiredCoins: number,
    currentCoins: number,
    giftName: string,
    isFirstWelcomeEligible: boolean,
  ) {
    super(
      `Necesitas ${requiredCoins} monedas para enviar ${giftName} (saldo actual: ${currentCoins}).`,
    );
    this.name = 'InsufficientCoinsError';
    this.requiredCoins = requiredCoins;
    this.currentCoins = currentCoins;
    this.giftName = giftName;
    this.isFirstWelcomeEligible = isFirstWelcomeEligible;
  }
}

export interface WalletSnapshot {
  coins: number;
  freeRoses: number;
  welcomeRechargeClaimed: boolean;
  followersCount: number;
  realFollowersCount: number;
  seededFollowersCount: number;
  isAdmin: boolean;
  isVerified: boolean;
}

export function subscribeUserWallet(
  uid: string,
  onData: (wallet: WalletSnapshot) => void,
): Unsubscribe {
  if (!uid) return () => {};
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      const breakdown = calculateProgressiveFollowers(
        {
          username: typeof d.username === 'string' ? d.username : '',
          email: typeof d.email === 'string' ? d.email : '',
        },
        d.followersCount,
        d.realFollowersCount,
      );
      onData({
        coins:
          typeof d.coins === 'number' && Number.isFinite(d.coins)
            ? Math.max(0, Math.floor(d.coins))
            : 0,
        freeRoses:
          typeof d.freeRoses === 'number' && Number.isFinite(d.freeRoses)
            ? Math.max(0, Math.floor(d.freeRoses))
            : 0,
        welcomeRechargeClaimed: Boolean(d.welcomeRechargeClaimed ?? false),
        followersCount: breakdown.followersCount,
        realFollowersCount: breakdown.realFollowersCount,
        seededFollowersCount: breakdown.seededFollowersCount,
        isAdmin: Boolean(d.isAdmin ?? false) || breakdown.isOfficial,
        isVerified: Boolean(d.isVerified ?? false) || breakdown.isOfficial,
      });
    },
    (err) => {
      console.warn('No se pudo suscribir al saldo de monedas:', err);
    },
  );
}

export interface UserLiveAccessSnapshot {
  followersCount: number;
  isAdmin: boolean;
  loaded: boolean;
}

export function subscribeUserLiveAccess(
  uid: string,
  onData: (access: UserLiveAccessSnapshot) => void,
): Unsubscribe {
  if (!uid) {
    onData({ followersCount: 0, isAdmin: false, loaded: true });
    return () => {};
  }
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (!snap.exists()) {
        onData({ followersCount: 0, isAdmin: false, loaded: true });
        return;
      }
      const d = snap.data();
      const breakdown = calculateProgressiveFollowers(
        {
          username: typeof d.username === 'string' ? d.username : '',
          email: typeof d.email === 'string' ? d.email : '',
        },
        d.followersCount,
        d.realFollowersCount,
      );
      onData({
        followersCount: breakdown.followersCount,
        isAdmin: Boolean(d.isAdmin ?? false) || breakdown.isOfficial,
        loaded: true,
      });
    },
    (err) => {
      console.warn('No se pudo verificar permisos de Live desde Firestore:', err);
      onData({ followersCount: 0, isAdmin: false, loaded: true });
    },
  );
}

export async function rechargeCoinsViaVexPay(
  uid: string,
  pkg: RechargePackage,
  isFirstRecharge: boolean,
): Promise<{
  mode: 'sandbox' | 'external';
  checkoutUrl?: string;
  transactionId: string;
  coinsCredited: number;
  bonusRoses: number;
}> {
  if (!uid || !auth.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Inicia sesión para recargar monedas con VexPay.');
  }

  const validPkg = RECHARGE_PACKAGES.find((p) => p.id === pkg.id);
  if (!validPkg) {
    throw new Error('Paquete de recarga no válido.');
  }

  const idToken = await auth.currentUser.getIdToken();
  const createRes = await fetch('/api/vexpay/create-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      packageId: validPkg.id,
      isFirstRecharge,
    }),
  });

  const createData = (await createRes.json().catch(() => ({}))) as {
    error?: string;
    mode?: 'sandbox' | 'external';
    transactionId?: string;
    signature?: string;
    checkoutUrl?: string;
    bonusRoses?: number;
  };

  if (!createRes.ok || !createData.transactionId || !createData.signature) {
    throw new Error(createData.error || 'No se pudo iniciar el checkout de VexPay.');
  }

  if (createData.mode === 'external' && createData.checkoutUrl) {
    return {
      mode: 'external',
      checkoutUrl: createData.checkoutUrl,
      transactionId: createData.transactionId,
      coinsCredited: validPkg.totalCoins,
      bonusRoses: isFirstRecharge ? WELCOME_BONUS_ROSES : 0,
    };
  }

  const confirmRes = await fetch('/api/vexpay/confirm-checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({
      transactionId: createData.transactionId,
      packageId: validPkg.id,
      signature: createData.signature,
      isFirstRecharge,
    }),
  });

  const confirmData = (await confirmRes.json().catch(() => ({}))) as {
    error?: string;
    verified?: boolean;
    transactionId?: string;
    coinsCredited?: number;
    bonusRoses?: number;
    priceUsd?: number;
  };

  if (!confirmRes.ok || !confirmData.verified) {
    throw new Error(confirmData.error || 'VexPay no pudo confirmar el pago.');
  }

  const coinsToCredit = Math.min(1635, Math.max(1, Number(confirmData.coinsCredited || validPkg.totalCoins)));
  const rosesToCredit = isFirstRecharge
    ? Math.min(WELCOME_BONUS_ROSES, Math.max(0, Number(confirmData.bonusRoses ?? WELCOME_BONUS_ROSES)))
    : 0;
  const txId = String(confirmData.transactionId || createData.transactionId);

  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'recharges', txId), {
    id: txId,
    userId: uid,
    packageId: validPkg.id,
    coinsCredited: coinsToCredit,
    bonusRoses: rosesToCredit,
    priceUsd: validPkg.priceUsd,
    provider: 'VexPay',
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', uid), {
    coins: increment(coinsToCredit),
    ...(rosesToCredit > 0 ? { freeRoses: increment(rosesToCredit) } : {}),
    welcomeRechargeClaimed: true,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/recharges/${txId}`);
  }

  return {
    mode: 'sandbox',
    transactionId: txId,
    coinsCredited: coinsToCredit,
    bonusRoses: rosesToCredit,
  };
}

async function chargeGiftFromUserWallet(
  uid: string,
  gift: { id?: string; name: string; value: number },
): Promise<{ usedFreeRose: boolean; remainingCoins: number; remainingFreeRoses: number }> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const data = snap.exists() ? snap.data() : {};
  const currentCoins =
    typeof data.coins === 'number' && Number.isFinite(data.coins)
      ? Math.max(0, Math.floor(data.coins))
      : 0;
  const currentFreeRoses =
    typeof data.freeRoses === 'number' && Number.isFinite(data.freeRoses)
      ? Math.max(0, Math.floor(data.freeRoses))
      : 0;
  const welcomeClaimed = Boolean(data.welcomeRechargeClaimed ?? false);

  const isRose =
    (gift.id || '').toLowerCase() === 'rosa' || gift.name.trim().toLowerCase() === 'rosa';

  if (isRose && currentFreeRoses > 0) {
    await updateDoc(userRef, {
      freeRoses: currentFreeRoses - 1,
      updatedAt: serverTimestamp(),
    });
    return {
      usedFreeRose: true,
      remainingCoins: currentCoins,
      remainingFreeRoses: currentFreeRoses - 1,
    };
  }

  if (currentCoins < gift.value) {
    throw new InsufficientCoinsError(gift.value, currentCoins, gift.name, !welcomeClaimed);
  }

  const nextCoins = currentCoins - gift.value;
  await updateDoc(userRef, {
    coins: nextCoins,
    updatedAt: serverTimestamp(),
  });
  return {
    usedFreeRose: false,
    remainingCoins: nextCoins,
    remainingFreeRoses: currentFreeRoses,
  };
}

export async function sendLiveStreamGift(
  streamId: string,
  profile: UserProfile,
  gift: { id?: string; name: string; value: number },
  options?: { creatorUid?: string },
): Promise<{
  matchedFavorite: AudienceFavorite | null;
  newFanLevel: number;
  creatorFanLevel: number;
  creatorFanTitle: string;
  totalCoinsDonatedToCreator: number;
  vipAlertEnabled: boolean;
  usedFreeRose: boolean;
}> {
  assertCooldown('liveGift', 900, 'Espera un segundo antes de enviar otro regalo.');

  const charge = await chargeGiftFromUserWallet(profile.uid, gift);
  const donatedCoins = charge.usedFreeRose ? 0 : Math.max(0, Math.round(gift.value));

  if (!streamId) {
    const creatorStatus = options?.creatorUid
      ? await recordCreatorCoinDonation(profile.uid, options.creatorUid, donatedCoins)
      : calculateFanLevelFromDonatedCoins(donatedCoins);
    return {
      matchedFavorite: null,
      newFanLevel: resolveFanLevel(profile.fanLevel, profile.fanPoints),
      creatorFanLevel: creatorStatus.level,
      creatorFanTitle: creatorStatus.title,
      totalCoinsDonatedToCreator: creatorStatus.totalCoinsDonated,
      vipAlertEnabled: true,
      usedFreeRose: charge.usedFreeRose,
    };
  }

  // Verify in Firestore whether the gift is linked to an Audience Favorite on this Live
  let matchedFavorite: AudienceFavorite | null = null;
  let pointsPerCoin = DEFAULT_FAN_POINTS_PER_COIN;
  let vipAlertEnabled = true;
  let hostUid = options?.creatorUid || '';

  try {
    const liveSnap = await getDoc(doc(db, 'liveStreams', streamId));
    if (liveSnap.exists()) {
      const data = liveSnap.data();
      let favorites = sanitizeAudienceFavoritesList(data.audienceFavorites);
      pointsPerCoin = sanitizeFanPointsPerCoin(data.fanPointsPerCoin);
      vipAlertEnabled =
        typeof data.vipAlertEnabled === 'boolean' ? data.vipAlertEnabled : true;
      if (typeof data.hostUid === 'string' && data.hostUid) {
        hostUid = data.hostUid;
        const cfgSnap = await getDoc(doc(db, 'liveConfigs', data.hostUid)).catch(() => null);
        if (cfgSnap?.exists()) {
          const cfgData = cfgSnap.data();
          if (favorites.length === 0) {
            favorites = sanitizeAudienceFavoritesList(cfgData.audienceFavorites);
          }
          if (typeof data.fanPointsPerCoin !== 'number') {
            pointsPerCoin = sanitizeFanPointsPerCoin(cfgData.fanPointsPerCoin);
          }
          if (typeof data.vipAlertEnabled !== 'boolean' && typeof cfgData.vipAlertEnabled === 'boolean') {
            vipAlertEnabled = cfgData.vipAlertEnabled;
          }
        }
      }
      const cleanGiftId = (gift.id || '').toLowerCase();
      const cleanGiftName = gift.name.trim().toLowerCase();
      matchedFavorite =
        favorites.find(
          (f) =>
            (cleanGiftId && f.giftId.toLowerCase() === cleanGiftId) ||
            f.giftName.trim().toLowerCase() === cleanGiftName,
        ) || null;
    }
  } catch (err) {
    console.warn('No se pudo verificar Favoritos del Público en Firestore:', err);
  }

  const creatorFanStatus = hostUid
    ? await recordCreatorCoinDonation(profile.uid, hostUid, donatedCoins)
    : calculateFanLevelFromDonatedCoins(donatedCoins);

  const earnedPoints = Math.max(1, gift.value * pointsPerCoin);
  const nextFanPoints = Math.min(10_000_000, Math.max(0, (profile.fanPoints || 0) + earnedPoints));
  const nextFanLevel = Math.min(50, Math.max(1, 1 + Math.floor(nextFanPoints / 50)));
  const updatedProfile: UserProfile = {
    ...profile,
    fanPoints: nextFanPoints,
    fanLevel: nextFanLevel,
  };

  const senderDisplayName =
    profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || profile.username || 'Fan';
  const isGiantGift = gift.value > FULLSCREEN_GIFT_THRESHOLD_COINS;
  const chatText = isGiantGift
    ? `¡${senderDisplayName} acaba de enviar un ${gift.name} gigante!`
    : matchedFavorite
      ? `envió ${gift.name} · Acción: ${matchedFavorite.action}`
      : charge.usedFreeRose
        ? `envió ${gift.name} de bienvenida`
        : `envió ${gift.name} (+${gift.value} monedas)`;

  await Promise.all([
    incrementLiveStreamGift(streamId),
    sendLiveStreamMessage(
      streamId,
      updatedProfile,
      chatText,
      'gift',
      {
        giftId: gift.id,
        giftName: gift.name,
        giftValue: gift.value,
        fanLevel: creatorFanStatus.level,
        fanTitle: creatorFanStatus.title,
        triggeredAction: vipAlertEnabled ? matchedFavorite?.action : undefined,
      },
    ),
    updateDoc(doc(db, 'users', profile.uid), {
      fanPoints: nextFanPoints,
      fanLevel: nextFanLevel,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      console.warn('No se pudo actualizar nivel de fan:', err);
    }),
  ]);

  return {
    matchedFavorite: vipAlertEnabled ? matchedFavorite : null,
    newFanLevel: creatorFanStatus.level,
    creatorFanLevel: creatorFanStatus.level,
    creatorFanTitle: creatorFanStatus.title,
    totalCoinsDonatedToCreator: creatorFanStatus.totalCoinsDonated,
    vipAlertEnabled,
    usedFreeRose: charge.usedFreeRose,
  };
}

function mapLiveBattleDoc(id: string, data: Record<string, unknown>): LiveBattleRecord {
  return {
    id: String(data.id || id),
    hostStreamId: typeof data.hostStreamId === 'string' ? data.hostStreamId : undefined,
    status: data.status === 'ended' ? 'ended' : 'active',
    durationSec: Math.max(60, Number(data.durationSec || 300)),
    endsAtMs: Number(data.endsAtMs || Date.now() + 300_000),
    creator1Uid: String(data.creator1Uid || ''),
    creator1Username: String(data.creator1Username || 'creador1'),
    creator1DisplayName: String(data.creator1DisplayName || 'Creador 1'),
    creator1AvatarUrl: String(data.creator1AvatarUrl || ''),
    creator1PreviewUrl: String(data.creator1PreviewUrl || ''),
    creator1StreamUrl: typeof data.creator1StreamUrl === 'string' ? data.creator1StreamUrl : undefined,
    creator1Points: Math.max(0, Number(data.creator1Points || 0)),
    creator1WinStreak: Math.max(0, Number(data.creator1WinStreak || 1)),
    creator2Uid: String(data.creator2Uid || ''),
    creator2Username: String(data.creator2Username || 'creador2'),
    creator2DisplayName: String(data.creator2DisplayName || 'Creador 2'),
    creator2AvatarUrl: String(data.creator2AvatarUrl || ''),
    creator2PreviewUrl: String(data.creator2PreviewUrl || ''),
    creator2StreamUrl: typeof data.creator2StreamUrl === 'string' ? data.creator2StreamUrl : undefined,
    creator2Points: Math.max(0, Number(data.creator2Points || 0)),
    creator2WinStreak: Math.max(0, Number(data.creator2WinStreak || 1)),
    lastGiftSender: typeof data.lastGiftSender === 'string' ? data.lastGiftSender : undefined,
    lastGiftName: typeof data.lastGiftName === 'string' ? data.lastGiftName : undefined,
    lastGiftTarget:
      data.lastGiftTarget === 'creator1' || data.lastGiftTarget === 'creator2'
        ? data.lastGiftTarget
        : undefined,
    lastGiftPoints: typeof data.lastGiftPoints === 'number' ? data.lastGiftPoints : undefined,
    startedAtMs: toMillis(data.startedAt),
    updatedAtMs: toMillis(data.updatedAt),
  };
}

export function subscribeLiveBattle(
  battleId: string,
  onData: (battle: LiveBattleRecord | null) => void,
): Unsubscribe {
  if (!battleId) return () => {};
  return onSnapshot(
    doc(db, 'liveBattles', battleId),
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapLiveBattleDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (err) => {
      console.warn('Error leyendo batalla ViroArena:', err);
    },
  );
}

export function subscribeLiveBattleGifts(
  battleId: string,
  onData: (events: LiveBattleGiftEvent[]) => void,
): Unsubscribe {
  if (!battleId) return () => {};
  const q = query(
    collection(db, 'liveBattles', battleId, 'gifts'),
    where('battleId', '==', battleId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const items: LiveBattleGiftEvent[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: String(data.id || d.id),
          battleId: String(data.battleId || battleId),
          targetSlot: data.targetSlot === 'creator2' ? 'creator2' : 'creator1',
          senderUid: String(data.senderUid || ''),
          senderUsername: String(data.senderUsername || 'fan'),
          senderDisplayName: String(data.senderDisplayName || 'Fan'),
          senderAvatarUrl: String(data.senderAvatarUrl || ''),
          giftId: String(data.giftId || ''),
          giftName: String(data.giftName || 'Regalo'),
          coins: Number(data.coins || 0),
          points: Number(data.points || 0),
          createdAtMs: toMillis(data.createdAt),
        };
      });
      items.sort((a, b) => a.createdAtMs - b.createdAtMs);
      onData(items.slice(-40));
    },
    (err) => {
      console.warn('Error leyendo regalos de ViroArena:', err);
    },
  );
}

export async function startFirestoreLiveBattle(input: {
  hostStreamId?: string;
  durationSec?: number;
  creator1: {
    uid: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    previewUrl: string;
    streamUrl?: string;
  };
  creator2: {
    uid: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    previewUrl: string;
    streamUrl?: string;
  };
}): Promise<string> {
  const battleId = createSafeId('pk');
  const durationSec = Math.min(3600, Math.max(60, Math.round(input.durationSec || 300)));
  const endsAtMs = Date.now() + durationSec * 1000;
  const path = `liveBattles/${battleId}`;

  try {
    await setDoc(doc(db, 'liveBattles', battleId), {
      id: battleId,
      ...(input.hostStreamId ? { hostStreamId: input.hostStreamId.slice(0, 128) } : {}),
      status: 'active',
      durationSec,
      endsAtMs,
      creator1Uid: input.creator1.uid,
      creator1Username: sanitizeUsername(input.creator1.username, input.creator1.uid),
      creator1DisplayName: input.creator1.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador 1',
      creator1AvatarUrl: sanitizeAvatarUrl(input.creator1.avatarUrl),
      creator1PreviewUrl: sanitizeLivePreviewUrl(input.creator1.previewUrl),
      ...(input.creator1.streamUrl ? { creator1StreamUrl: sanitizeMediaUrl(input.creator1.streamUrl) } : {}),
      creator1Points: 0,
      creator1WinStreak: 1,
      creator2Uid: input.creator2.uid,
      creator2Username: sanitizeUsername(input.creator2.username, input.creator2.uid),
      creator2DisplayName: input.creator2.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador 2',
      creator2AvatarUrl: sanitizeAvatarUrl(input.creator2.avatarUrl),
      creator2PreviewUrl: sanitizeLivePreviewUrl(input.creator2.previewUrl),
      ...(input.creator2.streamUrl ? { creator2StreamUrl: sanitizeMediaUrl(input.creator2.streamUrl) } : {}),
      creator2Points: 0,
      creator2WinStreak: 1,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }

  return battleId;
}

export async function sendBattleGift(
  battleId: string,
  targetSlot: 'creator1' | 'creator2',
  sender: UserProfile,
  gift: { id: string; name: string; coins: number },
  targetCreatorUid?: string,
): Promise<{
  pointsAdded: number;
  usedFreeRose: boolean;
  creatorFanStatus: CreatorFanLevelResult;
}> {
  assertCooldown('battleGift', 600, 'Espera un instante antes de enviar otro apoyo.');

  const charge = await chargeGiftFromUserWallet(sender.uid, {
    id: gift.id,
    name: gift.name,
    value: gift.coins,
  });

  const pointsAdded = Math.min(100000, Math.max(1, gift.coins));
  const donatedCoins = charge.usedFreeRose ? 0 : Math.max(0, Math.round(gift.coins));
  const eventId = createSafeId('pk_gift');
  const senderDisplay = sender.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Fan';

  const creatorFanStatus = targetCreatorUid
    ? await recordCreatorCoinDonation(sender.uid, targetCreatorUid, donatedCoins)
    : calculateFanLevelFromDonatedCoins(donatedCoins);

  if (battleId && !battleId.startsWith('local-')) {
    const battleRef = doc(db, 'liveBattles', battleId);
    const giftRef = doc(db, 'liveBattles', battleId, 'gifts', eventId);
    const batch = writeBatch(db);
    batch.update(battleRef, {
      ...(targetSlot === 'creator1'
        ? { creator1Points: increment(pointsAdded) }
        : { creator2Points: increment(pointsAdded) }),
      lastGiftSender: senderDisplay,
      lastGiftName: gift.name.slice(0, 40),
      lastGiftTarget: targetSlot,
      lastGiftPoints: pointsAdded,
      updatedAt: serverTimestamp(),
    });
    batch.set(giftRef, {
      id: eventId,
      battleId,
      targetSlot,
      senderUid: sender.uid,
      senderUsername: sanitizeUsername(sender.username, sender.uid),
      senderDisplayName: senderDisplay,
      senderAvatarUrl: sanitizeAvatarUrl(sender.avatarUrl),
      giftId: gift.id.slice(0, 32),
      giftName: gift.name.slice(0, 40),
      coins: gift.coins,
      points: pointsAdded,
      createdAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (err) {
      console.warn('Error sincronizando batalla ViroArena:', err);
    }
  }

  return { pointsAdded, usedFreeRose: charge.usedFreeRose, creatorFanStatus };
}

export async function rematchFirestoreLiveBattle(
  battleId: string,
  winnerSlot: 'creator1' | 'creator2' | 'draw',
  currentStreaks: { creator1WinStreak: number; creator2WinStreak: number },
  durationSec = 300,
): Promise<void> {
  if (!battleId || battleId.startsWith('local-')) return;
  const nextStreak1 =
    winnerSlot === 'creator1' ? Math.min(1000, currentStreaks.creator1WinStreak + 1) : 1;
  const nextStreak2 =
    winnerSlot === 'creator2' ? Math.min(1000, currentStreaks.creator2WinStreak + 1) : 1;
  try {
    await updateDoc(doc(db, 'liveBattles', battleId), {
      status: 'active',
      endsAtMs: Date.now() + durationSec * 1000,
      creator1Points: 0,
      creator2Points: 0,
      creator1WinStreak: nextStreak1,
      creator2WinStreak: nextStreak2,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo reiniciar la revancha PK:', err);
  }
}

export async function endFirestoreLiveBattle(battleId: string): Promise<void> {
  if (!battleId || battleId.startsWith('local-')) return;
  try {
    await updateDoc(doc(db, 'liveBattles', battleId), {
      status: 'ended',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('No se pudo finalizar la batalla PK:', err);
  }
}

