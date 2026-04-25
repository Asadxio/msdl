import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import {
  arrayUnion, doc, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { withTimeout } from '@/lib/errors';

const PUSH_API_URL = process.env.EXPO_PUBLIC_PUSH_API_URL || '';

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
      console.log('[Notifications] Android notification channel configured');
    }
  } catch (error) {
    console.log('[Notifications] initPushNotifications ERROR', error);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
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

    const tokenResponse = await Notifications.getDevicePushTokenAsync().catch((error) => {
      console.log('[Notifications] getDevicePushTokenAsync ERROR', error);
      return null;
    });
    const token = String(tokenResponse?.data || '');
    console.log('[Notifications] Device push token result', { hasToken: Boolean(token) });
    if (!token) return null;

    await withTimeout(updateDoc(doc(db, 'users', userId), {
      fcm_tokens: arrayUnion(token),
      fcm_token_updated_at: serverTimestamp(),
    }));
    console.log('[Notifications] Device push token saved');

    return token;
  } catch (error) {
    console.log('[Notifications] registerDevicePushToken ERROR', error);
    return null;
  }
}

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
};

async function requestBackendPush(payload: {
  title: string;
  body: string;
  data?: Record<string, any>;
  user_ids?: string[];
  send_to_all?: boolean;
}): Promise<void> {
  try {
    if (!PUSH_API_URL || !auth.currentUser) return;
    const idToken = await auth.currentUser.getIdToken();
    const response = await withTimeout(fetch(`${PUSH_API_URL.replace(/\/$/, '')}/api/push/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }), 15000).catch(() => null);
    if (response && !response.ok) {
      throw new Error(`Push request failed with status ${response.status}`);
    }
  } catch (error) {
    console.log('[Notifications] requestBackendPush ERROR', error);
    throw error;
  }
}

export async function sendPushToUserIds(userIds: string[], payload: PushPayload): Promise<void> {
  if (userIds.length === 0) return;
  await requestBackendPush({
    user_ids: Array.from(new Set(userIds)),
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });
}

export async function sendPushToAllUsers(payload: PushPayload): Promise<void> {
  await requestBackendPush({
    send_to_all: true,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
  });
}
