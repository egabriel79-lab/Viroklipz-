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

export async function saveClipMediaBlob(clipId: string, blob: Blob): Promise<void> {
  const db = await openMediaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, clipId);
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
        resolve(req.result instanceof Blob ? req.result : null);
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
