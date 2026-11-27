import { getMessaging, getToken, isSupported, onMessage, type Unsubscribe } from 'firebase/messaging';
import { app } from './firebase';
import { saveUserFcmToken } from './viroklipzService';

// Espacio para tu VAPID KEY de Firebase Console (Configuración del proyecto -> Cloud Messaging -> Certificados Push Web).
// Recomendado: configúrala en .env como VITE_FIREBASE_VAPID_KEY="TU_VAPID_KEY" o pégala aquí debajo.
const FALLBACK_VAPID_KEY = '';

const FCM_SW_URL = '/firebase-messaging-sw.js';
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
}

export type WebPushRegistrationResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'missing_vapid' }
  | { status: 'error' };

export async function registerAndSyncWebPush(uid: string): Promise<WebPushRegistrationResult> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return { status: 'unsupported' };
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      return { status: 'unsupported' };
    }

    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

    if (permission !== 'granted') {
      return { status: 'denied' };
    }

    const swRegistration = await navigator.serviceWorker.register(FCM_SW_URL, {
      scope: FCM_SW_SCOPE,
    });

    const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || FALLBACK_VAPID_KEY).trim();
    if (!vapidKey || vapidKey === 'PEGA_AQUI_TU_VAPID_KEY') {
      return { status: 'missing_vapid' };
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (!token) {
      return { status: 'error' };
    }

    await saveUserFcmToken(uid, token);
    return { status: 'registered', token };
  } catch (err) {
    console.warn('FCM web push setup skipped:', err);
    return { status: 'error' };
  }
}

export async function subscribeForegroundPushMessages(
  onAlert: (payload: PushMessagePayload) => void,
): Promise<Unsubscribe | null> {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Viroklipz';
      const body =
        payload.notification?.body ||
        payload.data?.body ||
        'Tienes una nueva notificación.';
      const url = typeof payload.data?.url === 'string' ? payload.data.url : undefined;
      const type = typeof payload.data?.type === 'string' ? payload.data.type : undefined;
      onAlert({ title, body, url, type });
    });
  } catch {
    return null;
  }
}

export function subscribeNotificationOpened(
  onOpen: (target: { url: string; data?: Record<string, unknown> }) => void,
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const handler = (event: MessageEvent) => {
    const payload = event.data as {
      type?: string;
      url?: string;
      data?: Record<string, unknown>;
    } | null;
    if (payload?.type === 'VIROKLIPZ_NOTIFICATION_CLICK' && typeof payload.url === 'string') {
      onOpen({ url: payload.url, data: payload.data });
    }
  };

  navigator.serviceWorker.addEventListener('message', handler);
  return () => {
    navigator.serviceWorker.removeEventListener('message', handler);
  };
}

export async function showLocalBreakNotification(title: string, body: string): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg =
        (await navigator.serviceWorker.getRegistration(FCM_SW_SCOPE)) ||
        (await navigator.serviceWorker.getRegistration());
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, {
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'viroklipz-break-reminder',
          data: { url: '/?section=feed', type: 'break_reminder' },
        });
        return true;
      }
    }

    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      tag: 'viroklipz-break-reminder',
    });
    return true;
  } catch {
    return false;
  }
}
