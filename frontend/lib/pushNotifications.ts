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
  if (Device.isDevice && Device.osName === 'Android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0FA958',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermissionResult> {
  if (!Device.isDevice) return { granted: false, canAskAgain: false };
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      return { granted: true, canAskAgain: true };
    }
    if (!existing.canAskAgain) {
      return { granted: false, canAskAgain: false };
    }
    const requested = await Notifications.requestPermissionsAsync();
    return {
      granted: requested.granted || requested.status === 'granted',
      canAskAgain: requested.canAskAgain,
    };
  } catch {
    return { granted: false, canAskAgain: false };
  }
}

export async function registerDevicePushToken(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  const permission = await requestNotificationPermission();
  if (!permission.granted) return null;

  const tokenResponse = await Notifications.getDevicePushTokenAsync();
  const token = String(tokenResponse?.data || '');
  if (!token) return null;

  await withTimeout(updateDoc(doc(db, 'users', userId), {
    fcm_tokens: arrayUnion(token),
    fcm_token_updated_at: serverTimestamp(),
  }));

  return token;
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
