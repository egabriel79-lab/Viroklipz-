import { getMessaging, getToken, isSupported, onMessage, type Unsubscribe } from 'firebase/messaging';
import { app } from './firebase';
import { saveUserFcmTokenWeb } from './viroklipzService';

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

    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    });

    const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
    if (!vapidKey) {
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

    await saveUserFcmTokenWeb(uid, token);
    return { status: 'registered', token };
  } catch (err) {
    console.warn('FCM web push setup skipped:', err);
    return { status: 'error' };
  }
}

export async function subscribeForegroundPushMessages(
  onAlert: (title: string, body: string) => void,
): Promise<Unsubscribe | null> {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (!supported) return null;
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'Viroklipz';
      const body = payload.notification?.body || 'Tienes una nueva notificación.';
      onAlert(title, body);
    });
  } catch {
    return null;
  }
}
