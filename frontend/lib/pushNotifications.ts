import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  arrayRemove, arrayUnion, doc, serverTimestamp, updateDoc, setDoc,
  getDoc, getDocs, collection, query, limit,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { isExpoGo } from '@/lib/runtime';
import { withTimeout } from '@/lib/errors';

const PUSH_API_URL = (
  process.env.EXPO_PUBLIC_PUSH_API_URL
  || process.env.EXPO_PUBLIC_LIVE_API_URL
  || String(process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '')
);

export type NotificationPermissionResult = {
  granted: boolean;
  canAskAgain: boolean;
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function initPushNotifications(): Promise<void> {
  try {
    if (isExpoGo()) {
      console.log('[Notifications] Expo Go detected: remote notifications are not fully supported in Expo Go.');
      return;
    }
    console.log('[Notifications] initPushNotifications called', { isDevice: Device.isDevice, osName: Device.osName });
    if (Device.isDevice && Device.osName === 'Android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0FA958',
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'calls',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 300, 200, 300],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      await Notifications.setNotificationChannelAsync('announcements', {
        name: 'announcements',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
      console.log('[Notifications] Android notification channel configured');
    }
  } catch (error) {
    console.log('[Notifications] initPushNotifications ERROR', error);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (isExpoGo()) {
    console.log('[Notifications] permission request skipped in Expo Go');
    return { granted: false, canAskAgain: false };
  }
  if (!Device.isDevice) {
    console.log('[Notifications] requestPermission skipped: physical device required');
    return { granted: false, canAskAgain: false };
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Existing permission status', {
      granted: existing.granted,
      canAskAgain: existing.canAskAgain,
      status: existing.status,
    });
    if (existing.granted) {
      return { granted: true, canAskAgain: true };
    }
    if (!existing.canAskAgain) {
      return { granted: false, canAskAgain: false };
    }
    const requested = await Notifications.requestPermissionsAsync();
    console.log('[Notifications] Requested permission status', {
      granted: requested.granted,
      canAskAgain: requested.canAskAgain,
      status: requested.status,
    });
    return {
      granted: requested.granted || requested.status === 'granted',
      canAskAgain: requested.canAskAgain,
    };
  } catch (error) {
    console.log('[Notifications] requestNotificationPermission ERROR', error);
    return { granted: false, canAskAgain: false };
  }
}

export async function registerDevicePushToken(userId: string): Promise<string | null> {
  if (isExpoGo()) {
    console.log('[Notifications] token registration skipped in Expo Go');
    return null;
  }
  if (!Device.isDevice) {
    console.log('[Notifications] registerDevicePushToken skipped: physical device required');
    return null;
  }
  try {
    const permission = await requestNotificationPermission();
    if (!permission.granted) {
      console.log('[Notifications] registerDevicePushToken skipped: permission not granted');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    let token = '';
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      token = String(tokenResponse?.data || '');
    } catch (expoErr) {
      console.log('[Notifications] getExpoPushTokenAsync ERROR', expoErr);
    }

    let nativeFcmToken = '';
    try {
      const deviceTokenResp = await Notifications.getDevicePushTokenAsync();
      nativeFcmToken = String(deviceTokenResp?.data || '');
    } catch (devErr) {
      console.log('[Notifications] getDevicePushTokenAsync ERROR', devErr);
    }

    const primaryToken = token || nativeFcmToken;
    console.log('[Notifications] Device push token result', { hasToken: Boolean(primaryToken), hasExpo: Boolean(token), hasNative: Boolean(nativeFcmToken) });
    if (!primaryToken) return null;

    const userPatch: Record<string, unknown> = {
      fcm_token_updated_at: serverTimestamp(),
    };
    if (token) {
      userPatch.expo_push_tokens = arrayUnion(token);
    }
    if (nativeFcmToken) {
      userPatch.fcm_tokens = arrayUnion(nativeFcmToken);
    }

    await withTimeout(setDoc(doc(db, 'users', userId), userPatch, { merge: true }), 5000).catch(() => {});

    await withTimeout(setDoc(doc(db, 'user_tokens', userId), {
      token: primaryToken,
      expoPushToken: token || primaryToken,
      fcmToken: nativeFcmToken || primaryToken,
      userId,
      platform: Device.osName || 'android',
      updatedAt: serverTimestamp(),
    }, { merge: true }), 5000).catch(() => {});

    console.log('[Notifications] Device push token saved');

    return primaryToken;
  } catch (error) {
    console.log('[Notifications] registerDevicePushToken ERROR', error);
    return null;
  }
}

export async function unregisterDevicePushToken(userId: string, token?: string | null): Promise<void> {
  const safeToken = String(token || '').trim();
  if (!userId || !safeToken) return;
  try {
    await withTimeout(updateDoc(doc(db, 'users', userId), {
      expo_push_tokens: arrayRemove(safeToken),
      fcm_token_updated_at: serverTimestamp(),
    }));
  } catch (error) {
    console.log('[Notifications] unregisterDevicePushToken ERROR', error);
  }
}

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

async function sendDirectExpoPushFallback(payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
  user_ids?: string[];
  send_to_all?: boolean;
}): Promise<void> {
  try {
    const tokensSet = new Set<string>();
    if (payload.user_ids && payload.user_ids.length > 0) {
      for (const uid of payload.user_ids.slice(0, 50)) {
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            const tokens = Array.isArray(data.expo_push_tokens) ? data.expo_push_tokens : [];
            tokens.forEach((t: string) => {
              if (t && t.startsWith('ExponentPushToken[')) tokensSet.add(t);
            });
          }
        } catch {}
      }
    } else if (payload.send_to_all) {
      try {
        const q = query(collection(db, 'users'), limit(100));
        const snaps = await getDocs(q);
        snaps.forEach((docSnap) => {
          const data = docSnap.data();
          const tokens = Array.isArray(data.expo_push_tokens) ? data.expo_push_tokens : [];
          tokens.forEach((t: string) => {
            if (t && t.startsWith('ExponentPushToken[')) tokensSet.add(t);
          });
        });
      } catch {}
    }

    const tokens = Array.from(tokensSet);
    if (tokens.length === 0) return;

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
    }));

    for (let i = 0; i < messages.length; i += 20) {
      const batch = messages.slice(i, i + 20);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      }).catch(() => {});
    }
  } catch (err) {
    console.log('[Notifications] sendDirectExpoPushFallback ERROR', err);
  }
}

async function requestBackendPush(payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
  user_ids?: string[];
  send_to_all?: boolean;
}): Promise<void> {
  try {
    if (!PUSH_API_URL || !auth.currentUser) {
      await sendDirectExpoPushFallback(payload);
      return;
    }
    const idToken = await auth.currentUser.getIdToken();
    const response = await withTimeout(fetch(`${PUSH_API_URL.replace(/\/$/, '')}/api/push/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }), 15000);
    if (!response.ok) {
      throw new Error(`Push request failed with status ${response.status}`);
    }
  } catch (error) {
    console.log('[Notifications] requestBackendPush failed, executing Direct Cloud Fallback...', error);
    await sendDirectExpoPushFallback(payload);
  }
}

export async function sendPushToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  if (__DEV__) console.warn('Deprecated notification path. Use dispatchNotification.');
  if (userIds.length === 0) return;
  await requestBackendPush({
    user_ids: Array.from(new Set(userIds)),
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });
}

export async function sendPushToAllUsers(payload: PushPayload): Promise<void> {
  if (__DEV__) console.warn('Deprecated notification path. Use dispatchNotification.');
  await requestBackendPush({
    send_to_all: true,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });
}
