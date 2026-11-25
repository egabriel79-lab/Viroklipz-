import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
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
  MAX_AUDIO_TITLE_LEN,
  MAX_BIO_COLOR_LEN,
  MAX_BIO_LEN,
  MAX_CAPTION_LEN,
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
  CreatorSummary,
  DirectMessage,
  DirectThread,
  AudienceFavorite,
  CreatorLiveConfig,
  FanClubPerk,
  LiveAudience,
  LiveQuality,
  LiveStreamMessage,
  LiveStreamRecord,
  LiveVisualEffect,
  PresenceStatus,
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
  normalizeFanLevelThreshold,
  resolveFanLevel,
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
  return {
    id: String(data.id || id),
    authorId: String(data.authorId || ''),
    authorUsername: String(data.authorUsername || 'creador'),
    authorDisplayName: String(data.authorDisplayName || 'Creador'),
    authorAvatarUrl: String(data.authorAvatarUrl || ''),
    caption: String(data.caption || ''),
    category: (data.category || 'general') as ClipCategory,
    hashtags: Array.isArray(data.hashtags) ? data.hashtags.map(String) : [],
    audioTitle: String(data.audioTitle || 'Audio original'),
    audioPreset: (data.audioPreset || 'urban_beat') as AudioPreset,
    visualPreset: String(data.visualPreset || ''),
    videoUrl: sanitizeMediaUrl(typeof data.videoUrl === 'string' ? data.videoUrl : ''),
    durationSec: Number(data.durationSec || 15),
    hasLocalMedia: Boolean(data.hasLocalMedia),
    visibility: (data.visibility || 'public') as ClipVisibility,
    likesCount: Number(data.likesCount || 0),
    bookmarksCount: Number(data.bookmarksCount || 0),
    viewsCount: Number(data.viewsCount || 0),
    sharesCount: Number(data.sharesCount || 0),
    createdAtMs: toMillis(data.createdAt),
    isStarter: false,
  };
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signUpWithEmail(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<User> {
  const cleanName = input.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador Viroklipz';
  const cleanEmail = input.email.trim().slice(0, MAX_EMAIL_LEN);
  const credential = await createUserWithEmailAndPassword(auth, cleanEmail, input.password);
  try {
    await updateProfile(credential.user, { displayName: cleanName });
  } catch {
    // Non-fatal if displayName update lags
  }
  await ensureUserProfile(credential.user, {
    displayName: cleanName,
    email: cleanEmail,
  });
  return credential.user;
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<User> {
  const cleanEmail = input.email.trim().slice(0, MAX_EMAIL_LEN);
  const credential = await signInWithEmailAndPassword(auth, cleanEmail, input.password);
  return credential.user;
}

export function mapAuthErrorMessage(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con ese correo electrónico.';
    case 'auth/invalid-email':
      return 'El formato del correo electrónico no es válido.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo electrónico o contraseña incorrectos.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un momento e inténtalo de nuevo.';
    case 'auth/operation-not-allowed':
      return 'El acceso con correo y contraseña aún no está activado en Firebase Console. Actívalo en Authentication > Sign-in method o usa Google.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de inicio de sesión.';
    default:
      return 'No se pudo completar la autenticación. Inténtalo nuevamente.';
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

export async function ensureUserProfile(
  user: User,
  overrides?: { displayName?: string; email?: string },
): Promise<UserProfile> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (err) {
    if (isTransientUnavailableError(err)) {
      await new Promise((r) => window.setTimeout(r, 600));
      try {
        snap = await getDoc(userRef);
      } catch (retryErr) {
        if (isTransientUnavailableError(retryErr)) {
          const effectiveEmail = (overrides?.email || user.email || '').trim().slice(0, MAX_EMAIL_LEN);
          const rawDisplayName = (
            overrides?.displayName ||
            user.displayName ||
            effectiveEmail.split('@')[0] ||
            'Creador Viroklipz'
          ).trim();
          const displayName = rawDisplayName.slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador';
          const username = sanitizeUsername(effectiveEmail.split('@')[0] || displayName || 'creador', user.uid);
          const now = Date.now();
          return {
            uid: user.uid,
            username,
            displayName,
            bio: '',
            avatarUrl: sanitizeAvatarUrl(user.photoURL),
            isPublic: true,
            followersCount: 0,
            createdAtMs: now,
            updatedAtMs: now,
          };
        }
        handleFirestoreError(retryErr, OperationType.GET, userPath);
      }
    } else {
      handleFirestoreError(err, OperationType.GET, userPath);
    }
  }

  if (snap.exists()) {
    const d = snap.data();
    const rawPresence = String(d.presenceStatus || 'online');
    const presenceStatus: PresenceStatus =
      rawPresence === 'busy' || rawPresence === 'hidden' ? rawPresence : 'online';
    return {
      uid: String(d.uid || user.uid),
      username: String(d.username || sanitizeUsername(user.email?.split('@')[0] || 'creador', user.uid)),
      displayName: String(d.displayName || overrides?.displayName || user.displayName || 'Creador'),
      bio: String(d.bio || ''),
      bioColor: typeof d.bioColor === 'string' && d.bioColor ? d.bioColor : '#FFFFFF',
      personalLink: typeof d.personalLink === 'string' ? d.personalLink : '',
      pronouns: typeof d.pronouns === 'string' ? d.pronouns : '',
      avatarUrl: String(d.avatarUrl || ''),
      isPublic: Boolean(d.isPublic ?? true),
      followersCount: typeof d.followersCount === 'number' ? d.followersCount : 0,
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
      createdAtMs: toMillis(d.createdAt),
      updatedAtMs: toMillis(d.updatedAt),
    };
  }

  const effectiveEmail = (overrides?.email || user.email || '').trim().slice(0, MAX_EMAIL_LEN);
  const rawDisplayName = (overrides?.displayName || user.displayName || effectiveEmail.split('@')[0] || 'Creador Viroklipz').trim();
  const displayName = rawDisplayName.slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador';
  const username = sanitizeUsername(effectiveEmail.split('@')[0] || displayName || 'creador', user.uid);
  const avatarUrl = sanitizeAvatarUrl(user.photoURL);

  try {
    await setDoc(userRef, {
      uid: user.uid,
      username,
      displayName,
      bio: '',
      avatarUrl,
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  const privatePath = `users/${user.uid}/private/info`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
      uid: user.uid,
      firstName: '',
      lastName: '',
      phone: '',
      email: '',
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, privatePath);
  }

  const now = Date.now();
  return {
    uid: user.uid,
    username,
    displayName,
    bio: '',
    avatarUrl,
    isPublic: true,
    followersCount: 0,
    createdAtMs: now,
    updatedAtMs: now,
  };
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
  const cleanUsername = sanitizeUsername(updates.username, uid);
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

export function subscribePublicClips(
  onData: (clips: ClipItem[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'clips'),
    where('visibility', '==', 'public'),
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
  const path = `users/${uid}/following/${targetId}`;
  try {
    if (currentlyFollowing) {
      await deleteDoc(followRef);
    } else {
      await setDoc(followRef, {
        followerId: uid,
        targetId,
        targetUsername: sanitizeUsername(targetUsername, targetId),
        createdAt: serverTimestamp(),
      });
    }
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
  },
): Promise<string> {
  assertCooldown('publishClip', 5000, 'Espera unos segundos antes de publicar otro klip.');
  const clipId = createSafeId('klip');
  let hasLocalMedia = false;
  let videoUrl = '';

  const resolvedMime =
    input.mediaMimeType || (input.mediaBlob?.type ? input.mediaBlob.type : 'video/mp4');
  const resolvedBytes =
    input.mediaBytes && input.mediaBytes.byteLength > 0
      ? input.mediaBytes
      : input.mediaBlob
        ? new Uint8Array(await input.mediaBlob.arrayBuffer())
        : null;

  if (resolvedBytes && resolvedBytes.byteLength > 0) {
    if (resolvedBytes.byteLength > MAX_VIDEO_FILE_BYTES) {
      throw new Error('El archivo supera el límite máximo permitido.');
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
  }

  const resolvedAudioTitle = (input.audioTitle.trim() || 'Audio original').slice(0, MAX_AUDIO_TITLE_LEN);
  const resolvedCategory: ClipCategory =
    input.category && ALLOWED_CATEGORIES.includes(input.category) ? input.category : 'general';
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
      audioPreset: input.audioPreset,
      visualPreset: input.visualPreset.slice(0, MAX_VISUAL_PRESET_LEN),
      videoUrl,
      durationSec: Math.min(60, Math.max(3, Math.round(input.durationSec))),
      hasLocalMedia,
      visibility: resolvedVisibility,
      likesCount: 0,
      bookmarksCount: 0,
      viewsCount: 0,
      sharesCount: 0,
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
      fcmTokenWeb: cleanToken,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

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
        return {
          uid: String(data.uid || d.id),
          username: String(data.username || 'creador'),
          displayName: String(data.displayName || 'Creador'),
          bio: String(data.bio || 'Creador en Viroklipz'),
          avatarUrl: String(data.avatarUrl || ''),
          followersLabel:
            typeof data.followersCount === 'number' && data.followersCount > 0
              ? String(data.followersCount)
              : '',
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
        return {
          uid: String(data.uid || d.id),
          username: String(data.username || 'creador'),
          displayName: String(data.displayName || 'Creador'),
          bio: String(data.bio || 'Creador en Viroklipz'),
          avatarUrl: String(data.avatarUrl || ''),
          followersLabel: '',
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

export function subscribeActiveLiveStreams(
  onData: (streams: LiveStreamRecord[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'liveStreams'), where('status', '==', 'live'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: LiveStreamRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        const rawAudience = String(data.audience || 'public');
        const rawQuality = String(data.quality || '720p');
        const rawEffect = String(data.visualEffect || 'none');
        return {
          id: String(data.id || d.id),
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
          category: (data.category || 'general') as ClipCategory,
          previewImageUrl: String(data.previewImageUrl || ''),
          streamUrl: sanitizeMediaUrl(typeof data.streamUrl === 'string' ? data.streamUrl : ''),
          guestUid: typeof data.guestUid === 'string' ? data.guestUid : '',
          guestDisplayName: typeof data.guestDisplayName === 'string' ? data.guestDisplayName : '',
          guestStreamUrl: sanitizeMediaUrl(
            typeof data.guestStreamUrl === 'string' ? data.guestStreamUrl : '',
          ),
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
      });
      items.sort((a, b) => b.startedAtMs - a.startedAtMs);
      onData(items);
    },
    (err) => {
      handleFirestoreError(err, OperationType.LIST, 'liveStreams');
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
      category: cleanCategory,
      previewImageUrl: sanitizeLivePreviewUrl(input.previewImageUrl),
      streamUrl: cleanStreamUrl,
      ...(cleanGuestUid ? { guestUid: cleanGuestUid } : {}),
      ...(cleanGuestDisplayName ? { guestDisplayName: cleanGuestDisplayName } : {}),
      ...(cleanGuestStreamUrl ? { guestStreamUrl: cleanGuestStreamUrl } : {}),
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
        const kind: 'chat' | 'like' | 'gift' =
          rawKind === 'like' ? 'like' : rawKind === 'gift' ? 'gift' : 'chat';
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
  kind: 'chat' | 'like' | 'gift' = 'chat',
  giftMeta?: {
    giftId?: string;
    giftName: string;
    giftValue: number;
    triggeredAction?: string;
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
      : kind === 'gift'
        ? `envió un regalo: ${giftMeta?.giftName || 'Viroklipz'}`
        : '');
  if (!cleanText) return;
  const senderFanLevel = resolveFanLevel(profile.fanLevel, profile.fanPoints);

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

export async function sendLiveStreamGift(
  streamId: string,
  profile: UserProfile,
  gift: { id?: string; name: string; value: number },
): Promise<{ matchedFavorite: AudienceFavorite | null; newFanLevel: number; vipAlertEnabled: boolean }> {
  if (!streamId) {
    return {
      matchedFavorite: null,
      newFanLevel: resolveFanLevel(profile.fanLevel, profile.fanPoints),
      vipAlertEnabled: true,
    };
  }
  assertCooldown('liveGift', 900, 'Espera un segundo antes de enviar otro regalo.');

  // PARTE 3.1: Verify in Firestore whether the gift is linked to an Audience Favorite on this Live
  let matchedFavorite: AudienceFavorite | null = null;
  let pointsPerCoin = DEFAULT_FAN_POINTS_PER_COIN;
  let vipAlertEnabled = true;

  try {
    const liveSnap = await getDoc(doc(db, 'liveStreams', streamId));
    if (liveSnap.exists()) {
      const data = liveSnap.data();
      let favorites = sanitizeAudienceFavoritesList(data.audienceFavorites);
      pointsPerCoin = sanitizeFanPointsPerCoin(data.fanPointsPerCoin);
      vipAlertEnabled =
        typeof data.vipAlertEnabled === 'boolean' ? data.vipAlertEnabled : true;

      if (typeof data.hostUid === 'string' && data.hostUid) {
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

  const earnedPoints = Math.max(1, gift.value * pointsPerCoin);
  const nextFanPoints = Math.min(10_000_000, Math.max(0, (profile.fanPoints || 0) + earnedPoints));
  const nextFanLevel = Math.min(50, Math.max(1, 1 + Math.floor(nextFanPoints / 50)));
  const updatedProfile: UserProfile = {
    ...profile,
    fanPoints: nextFanPoints,
    fanLevel: nextFanLevel,
  };

  await Promise.all([
    incrementLiveStreamGift(streamId),
    sendLiveStreamMessage(
      streamId,
      updatedProfile,
      matchedFavorite
        ? `envió ${gift.name} · Acción: ${matchedFavorite.action}`
        : `envió ${gift.name} (+${gift.value} monedas)`,
      'gift',
      {
        giftId: gift.id,
        giftName: gift.name,
        giftValue: gift.value,
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

  return { matchedFavorite: vipAlertEnabled ? matchedFavorite : null, newFanLevel: nextFanLevel, vipAlertEnabled };
}


