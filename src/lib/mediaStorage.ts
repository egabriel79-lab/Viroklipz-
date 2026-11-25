const DB_NAME = 'viroklipz_local_media';
const DB_VERSION = 1;
const STORE_NAME = 'clips';

function openMediaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open error'));
    request.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

interface StoredMediaRecord {
  bytes: ArrayBuffer;
  mimeType: string;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isStoredMediaRecord(val: unknown): val is StoredMediaRecord {
  return (
    typeof val === 'object' &&
    val !== null &&
    'bytes' in val &&
    (val as { bytes: unknown }).bytes instanceof ArrayBuffer
  );
}

export async function saveClipMediaBlob(
  clipId: string,
  media: Blob | Uint8Array,
  mimeType?: string,
): Promise<void> {
  // Always materialize bytes in memory before IndexedDB transaction so transient picker File handles never trigger InvalidBlob.
  const resolvedMime =
    mimeType || (media instanceof Blob && media.type ? media.type : 'video/mp4');
  const bytesBuffer =
    media instanceof Uint8Array ? toArrayBuffer(media) : await media.arrayBuffer();

  const record: StoredMediaRecord = {
    bytes: bytesBuffer,
    mimeType: resolvedMime,
  };

  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record, clipId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB write error'));
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB write aborted'));
    };
  });
}

export async function getClipMediaBlob(clipId: string): Promise<Blob | null> {
  try {
    const db = await openMediaDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(clipId);
      req.onsuccess = () => {
        db.close();
        const res = req.result;
        if (res instanceof Blob) {
          resolve(res);
          return;
        }
        if (isStoredMediaRecord(res)) {
          resolve(new Blob([res.bytes], { type: res.mimeType || 'video/mp4' }));
          return;
        }
        resolve(null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('IndexedDB read error'));
      };
    });
  } catch {
    return null;
  }
}

export async function deleteClipMediaBlob(clipId: string): Promise<void> {
  try {
    const db = await openMediaDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(clipId);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

async function compressAvatarImage(file: Blob): Promise<Blob> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    const minSide = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - minSide) / 2;
    const sy = (bitmap.height - minSide) / 2;
    ctx.drawImage(bitmap, sx, sy, minSide, minSide, 0, 0, size, size);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86),
    );
    return compressed || file;
  } catch {
    return file;
  }
}

export async function saveUserAvatarBlob(uid: string, file: Blob): Promise<Blob> {
  const optimized = await compressAvatarImage(file);
  await saveClipMediaBlob(`avatar_${uid}`, optimized);
  return optimized;
}

export async function getUserAvatarBlob(uid: string): Promise<Blob | null> {
  return getClipMediaBlob(`avatar_${uid}`);
}

const MAX_BANNER_SLIDES = 5;

async function compressBannerImage(file: Blob): Promise<Blob> {
  if (
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml' ||
    file.type.startsWith('video/')
  ) {
    return file;
  }
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const maxW = 1200;
    const scale = bitmap.width > maxW ? maxW / bitmap.width : 1;
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const compressed = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86),
    );
    return compressed || file;
  } catch {
    return file;
  }
}

export async function saveUserBannerBlob(uid: string, file: Blob): Promise<Blob> {
  const optimized = await compressBannerImage(file);
  await saveClipMediaBlob(
    `banner_${uid}`,
    optimized,
    optimized.type || file.type || 'image/jpeg',
  );
  return optimized;
}

export async function getUserBannerBlob(uid: string): Promise<Blob | null> {
  return getClipMediaBlob(`banner_${uid}`);
}

export async function deleteUserBannerBlob(uid: string): Promise<void> {
  await deleteClipMediaBlob(`banner_${uid}`);
}

export async function saveUserBannerGallery(uid: string, files: Blob[]): Promise<Blob[]> {
  const limited = files.slice(0, MAX_BANNER_SLIDES);
  await deleteUserBannerGallery(uid);
  const saved: Blob[] = [];
  for (let i = 0; i < limited.length; i++) {
    const optimized = await compressBannerImage(limited[i]);
    const key = i === 0 ? `banner_${uid}` : `banner_${uid}_s${i}`;
    await saveClipMediaBlob(
      key,
      optimized,
      optimized.type || limited[i].type || 'image/jpeg',
    );
    saved.push(optimized);
  }
  return saved;
}

export async function getUserBannerGallery(uid: string): Promise<Blob[]> {
  const items: Blob[] = [];
  const first = await getClipMediaBlob(`banner_${uid}`);
  if (!first) return items;
  items.push(first);
  for (let i = 1; i < MAX_BANNER_SLIDES; i++) {
    const extra = await getClipMediaBlob(`banner_${uid}_s${i}`);
    if (!extra) break;
    items.push(extra);
  }
  return items;
}

export async function deleteUserBannerGallery(uid: string): Promise<void> {
  await deleteClipMediaBlob(`banner_${uid}`);
  for (let i = 1; i < MAX_BANNER_SLIDES; i++) {
    await deleteClipMediaBlob(`banner_${uid}_s${i}`);
  }
}

export async function listOfflineClipIds(): Promise<string[]> {
  try {
    const db = await openMediaDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        db.close();
        const keys = Array.isArray(req.result) ? req.result : [];
        const clipIds = keys
          .map((k) => String(k))
          .filter(
            (k) =>
              k.length > 0 &&
              !k.startsWith('avatar_') &&
              !k.startsWith('banner_') &&
              !k.startsWith('story_'),
          );
        resolve(clipIds);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}
