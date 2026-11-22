import {
  createUserWithEmailAndPassword,
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
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { deleteClipMediaBlob, saveClipMediaBlob } from './mediaStorage';
import {
  createSafeId,
  MAX_AUDIO_TITLE_LEN,
  MAX_BIO_LEN,
  MAX_CAPTION_LEN,
  MAX_COMMENT_LEN,
  MAX_DISPLAY_NAME_LEN,
  MAX_EMAIL_LEN,
  MAX_HASHTAGS,
  MAX_NAME_PART_LEN,
  MAX_NOTE_LEN,
  MAX_PHONE_LEN,
  MAX_REPORT_DETAILS_LEN,
  MAX_VIDEO_FILE_BYTES,
  MAX_VISUAL_PRESET_LEN,
  sanitizeAvatarUrl,
  sanitizeMediaUrl,
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
  CreatorSummary,
  DirectMessage,
  DirectThread,
  PresenceStatus,
  ReportReason,
  ReportTargetType,
  StatusNote,
  UserPrivateInfo,
  UserProfile,
  UserStreak,
} from '../types/viroklipz';

const actionTimestamps = new Map<string, number>();

function assertCooldown(actionKey: string, cooldownMs: number, waitMsg: string): void {
  const now = Date.now();
  const prev = actionTimestamps.get(actionKey) || 0;
  if (now - prev < cooldownMs) {
    throw new Error(waitMsg);
  }
  actionTimestamps.set(actionKey, now);
}

async function uploadClipToR2IfConfigured(clipId: string, blob: Blob): Promise<string | null> {
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
  if (blob.size > MAX_VIDEO_FILE_BYTES) {
    throw new Error('El archivo supera el límite permitido para subir.');
  }
  const form = new FormData();
  form.append('clipId', clipId);
  form.append('file', blob, `${clipId}.webm`);

  const response = await fetch(parsed.toString(), {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    throw new Error('No se pudo subir el video a Cloudflare R2.');
  }
  const json = (await response.json()) as { url?: unknown };
  const cleanUrl = sanitizeMediaUrl(typeof json.url === 'string' ? json.url : '');
  if (!cleanUrl) {
    throw new Error('El endpoint de almacenamiento devolvió una URL inválida.');
  }
  return cleanUrl;
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
    category: (data.category || 'arte') as ClipCategory,
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
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    const d = snap.data();
    return {
      uid: String(d.uid || user.uid),
      username: String(d.username || sanitizeUsername(user.email?.split('@')[0] || 'creador', user.uid)),
      displayName: String(d.displayName || overrides?.displayName || user.displayName || 'Creador'),
      bio: String(d.bio || ''),
      avatarUrl: String(d.avatarUrl || ''),
      isPublic: Boolean(d.isPublic ?? true),
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
    createdAtMs: now,
    updatedAtMs: now,
  };
}

export async function updateUserProfile(
  uid: string,
  updates: { username: string; displayName: string; bio: string },
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      username: sanitizeUsername(updates.username, uid),
      displayName: updates.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN),
      bio: updates.bio.trim().slice(0, MAX_BIO_LEN),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
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
  },
): Promise<string> {
  assertCooldown('publishClip', 5000, 'Espera unos segundos antes de publicar otro klip.');
  const clipId = createSafeId('klip');
  let hasLocalMedia = false;
  let videoUrl = '';

  if (input.mediaBlob) {
    if (input.mediaBlob.size > MAX_VIDEO_FILE_BYTES) {
      throw new Error('El video supera el límite máximo permitido.');
    }
    const cloudUrl = await uploadClipToR2IfConfigured(clipId, input.mediaBlob);
    if (cloudUrl) {
      videoUrl = cloudUrl;
    } else {
      await Promise.race([
        saveClipMediaBlob(clipId, input.mediaBlob),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error('Timeout saving local video')), 12000);
        }),
      ]);
      hasLocalMedia = true;
    }
  }

  const resolvedAudioTitle = (input.audioTitle.trim() || 'Audio original').slice(0, MAX_AUDIO_TITLE_LEN);
  const path = `clips/${clipId}`;
  try {
    await setDoc(doc(db, 'clips', clipId), {
      id: clipId,
      authorId: profile.uid,
      authorUsername: sanitizeUsername(profile.username, profile.uid),
      authorDisplayName: profile.displayName.trim().slice(0, MAX_DISPLAY_NAME_LEN) || 'Creador',
      authorAvatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
      caption: input.caption.trim().slice(0, MAX_CAPTION_LEN),
      category: input.category,
      hashtags: input.hashtags.slice(0, MAX_HASHTAGS),
      audioTitle: resolvedAudioTitle,
      audioPreset: input.audioPreset,
      visualPreset: input.visualPreset.slice(0, MAX_VISUAL_PRESET_LEN),
      videoUrl,
      durationSec: Math.min(60, Math.max(3, Math.round(input.durationSec))),
      hasLocalMedia,
      visibility: input.visibility,
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
      targetType: input.targetType,
      targetId: input.targetId,
      targetAuthorId: input.targetAuthorId,
      reason: input.reason,
      details: input.details.trim().slice(0, MAX_REPORT_DETAILS_LEN),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
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
  knownThreadExists: boolean,
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
    if (knownThreadExists) {
      await updateDoc(threadRef, {
        lastMessageText: cleanText,
        lastSenderId: profile.uid,
        updatedAt: serverTimestamp(),
      });
    } else {
      try {
        await setDoc(threadRef, {
          id: threadId,
          participantIds: [profile.uid, cleanTarget].sort(),
          lastMessageText: cleanText,
          lastSenderId: profile.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch {
        await updateDoc(threadRef, {
          lastMessageText: cleanText,
          lastSenderId: profile.uid,
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
