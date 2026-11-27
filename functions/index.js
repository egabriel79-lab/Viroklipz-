const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

const app = initializeApp();

// Base de datos Firestore de Viroklipz (definida en firebase-applet-config.json).
// Si despliegas en la base de datos por defecto, cambia DATABASE_ID a "(default)".
const DATABASE_ID = 'ai-studio-7fa9d191-669e-450e-a908-de7aaf9be995';
const db = getFirestore(app, DATABASE_ID);
const messaging = getMessaging(app);

function extractToken(userData) {
  if (!userData || typeof userData !== 'object') return '';
  const primary = typeof userData.fcmToken === 'string' ? userData.fcmToken.trim() : '';
  if (primary) return primary;
  const legacy = typeof userData.fcmTokenWeb === 'string' ? userData.fcmTokenWeb.trim() : '';
  return legacy;
}

function getDisplayName(userData, fallback = 'Alguien') {
  if (!userData || typeof userData !== 'object') return fallback;
  if (typeof userData.displayName === 'string' && userData.displayName.trim()) {
    return userData.displayName.trim();
  }
  if (typeof userData.username === 'string' && userData.username.trim()) {
    return `@${userData.username.trim()}`;
  }
  return fallback;
}

async function cleanupInvalidTokens(entries) {
  const stale = entries.filter(
    (entry) =>
      entry.errorCode === 'messaging/registration-token-not-registered' ||
      entry.errorCode === 'messaging/invalid-registration-token',
  );
  if (stale.length === 0) return;
  await Promise.allSettled(
    stale.map((entry) =>
      db.collection('users').doc(entry.uid).update({
        fcmToken: '',
        fcmTokenWeb: '',
      }),
    ),
  );
}

/**
 * 1. Notificación de Nuevo Seguidor
 * Trigger: al crearse users/{followerId}/following/{targetId}
 */
exports.onNewFollower = onDocumentCreated(
  {
    document: 'users/{followerId}/following/{targetId}',
    database: DATABASE_ID,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const { followerId, targetId } = event.params;
    if (!followerId || !targetId || followerId === targetId) return;

    const [followerSnap, targetSnap] = await Promise.all([
      db.collection('users').doc(followerId).get(),
      db.collection('users').doc(targetId).get(),
    ]);

    if (!targetSnap.exists) return;
    const token = extractToken(targetSnap.data());
    if (!token) return;

    const followerData = followerSnap.exists ? followerSnap.data() : {};
    const followerName = getDisplayName(followerData, 'Un creador');
    const followerUsername =
      typeof followerData?.username === 'string' && followerData.username.trim()
        ? followerData.username.trim()
        : '';

    const title = 'Nuevo seguidor en Viroklipz';
    const body = `¡${followerName} te ha empezado a seguir!`;
    const url = followerUsername ? `/@${encodeURIComponent(followerUsername)}` : '/?section=perfil';

    try {
      await messaging.send({
        token,
        notification: { title, body },
        data: {
          type: 'follow',
          followerId,
          url,
          title,
          body,
        },
        webpush: {
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          },
          fcmOptions: { link: url },
        },
      });
    } catch (err) {
      await cleanupInvalidTokens([{ uid: targetId, errorCode: err?.code }]);
    }
  },
);

/**
 * 2. Notificación de Nuevo Video de Seguidos
 * Trigger: al crearse clips/{clipId}
 */
exports.onNewVideo = onDocumentCreated(
  {
    document: 'clips/{clipId}',
    database: DATABASE_ID,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const clip = snap.data();
    if (!clip || clip.visibility !== 'public' || !clip.authorId) return;

    const authorId = String(clip.authorId);
    const authorName =
      typeof clip.authorDisplayName === 'string' && clip.authorDisplayName.trim()
        ? clip.authorDisplayName.trim()
        : 'Un creador';

    const followersSnap = await db
      .collectionGroup('following')
      .where('targetId', '==', authorId)
      .get();

    if (followersSnap.empty) return;

    const followerUids = Array.from(
      new Set(
        followersSnap.docs
          .map((d) => String(d.data()?.followerId || d.ref.parent?.parent?.id || ''))
          .filter((uid) => uid && uid !== authorId),
      ),
    );

    if (followerUids.length === 0) return;

    const targets = [];
    for (let i = 0; i < followerUids.length; i += 100) {
      const batchUids = followerUids.slice(i, i + 100);
      const userRefs = batchUids.map((uid) => db.collection('users').doc(uid));
      const userSnaps = await db.getAll(...userRefs);
      for (const userSnap of userSnaps) {
        if (!userSnap.exists) continue;
        const token = extractToken(userSnap.data());
        if (token) {
          targets.push({ uid: userSnap.id, token });
        }
      }
    }

    if (targets.length === 0) return;

    const { clipId } = event.params;
    const title = 'Nuevo klip disponible';
    const body = `¡${authorName} ha subido un nuevo video! Míralo ahora`;
    const url = `/klip/${encodeURIComponent(clipId)}`;

    const staleTokens = [];
    for (let i = 0; i < targets.length; i += 500) {
      const chunk = targets.slice(i, i + 500);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk.map((item) => item.token),
        notification: { title, body },
        data: {
          type: 'new_video',
          clipId,
          authorId,
          url,
          title,
          body,
        },
        webpush: {
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          },
          fcmOptions: { link: url },
        },
      });

      response.responses.forEach((res, idx) => {
        if (!res.success && res.error?.code) {
          staleTokens.push({ uid: chunk[idx].uid, errorCode: res.error.code });
        }
      });
    }

    await cleanupInvalidTokens(staleTokens);
  },
);

/**
 * 3. Notificación de Mensaje Directo
 * Trigger: al crearse directThreads/{threadId}/messages/{messageId}
 */
exports.onNewDirectMessage = onDocumentCreated(
  {
    document: 'directThreads/{threadId}/messages/{messageId}',
    database: DATABASE_ID,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const message = snap.data();
    const { threadId } = event.params;
    if (!message || !message.authorId || !threadId) return;

    const senderId = String(message.authorId);
    const messageText = String(message.text || '').trim().slice(0, 140);
    if (!messageText) return;

    const threadSnap = await db.collection('directThreads').doc(threadId).get();
    if (!threadSnap.exists) return;

    const participantIds = Array.isArray(threadSnap.data()?.participantIds)
      ? threadSnap.data().participantIds
      : [];
    const recipientIds = participantIds.filter(
      (uid) => typeof uid === 'string' && uid && uid !== senderId,
    );

    if (recipientIds.length === 0) return;

    const [senderSnap, ...recipientSnaps] = await Promise.all([
      db.collection('users').doc(senderId).get(),
      ...recipientIds.map((uid) => db.collection('users').doc(uid).get()),
    ]);

    const senderName = senderSnap.exists
      ? getDisplayName(senderSnap.data(), `@${message.authorUsername || 'usuario'}`)
      : `@${message.authorUsername || 'usuario'}`;

    const title = `Mensaje de ${senderName}`;
    const body = `Nuevo mensaje de ${senderName}: ${messageText}`;
    const url = '/?section=chats';

    const staleTokens = [];
    await Promise.allSettled(
      recipientSnaps.map(async (recipientSnap) => {
        if (!recipientSnap.exists) return;
        const token = extractToken(recipientSnap.data());
        if (!token) return;

        try {
          await messaging.send({
            token,
            notification: { title, body },
            data: {
              type: 'direct_message',
              threadId,
              senderId,
              url,
              title,
              body,
            },
            webpush: {
              notification: {
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
              },
              fcmOptions: { link: url },
            },
          });
        } catch (err) {
          staleTokens.push({ uid: recipientSnap.id, errorCode: err?.code });
        }
      }),
    );

    await cleanupInvalidTokens(staleTokens);
  },
);
