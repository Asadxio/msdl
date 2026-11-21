/**
 * liveClassNotification.ts — Madrasatu-s-Salikat Lil Banat (MSLB)
 * Manages sticky ongoing notification for live class audio sessions.
 * Keeps audio playing and informs user when app is minimized or navigating in-app.
 */
let Platform: any = { OS: 'android' };
try {
  const RN = require('react-native');
  Platform = RN.Platform || Platform;
} catch {
  // In Node / unit-test environments
}

export const LIVE_CLASS_NOTIFICATION_ID = 'mslb_live_class_session_notification';
export const LIVE_CLASS_CHANNEL_ID = 'live_class_audio';

let channelCreated = false;

async function getNotifications() {
  if (Platform.OS === 'web') return null;
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Initializes dedicated notification channel on Android for live classroom voice
 */
export async function initLiveClassChannel(): Promise<void> {
  if (channelCreated || Platform.OS !== 'android') return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications?.setNotificationChannelAsync) return;

    await Notifications.setNotificationChannelAsync(LIVE_CLASS_CHANNEL_ID, {
      name: 'Live Class Audio Session',
      description: 'Ongoing notification indicating live classroom audio is active in background',
      importance: Notifications.AndroidImportance.LOW, // Silent: doesn't beep or interrupt audio
      sound: undefined,
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelCreated = true;
  } catch (err) {
    console.warn('[LiveClassNotification] Failed to create notification channel:', err);
  }
}

/**
 * Shows or updates sticky ongoing notification while live audio is connected
 */
export async function showLiveClassOngoingNotification(params: {
  title: string;
  teacherName?: string;
  classId: string;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications?.scheduleNotificationAsync) return;

    await initLiveClassChannel();

    await Notifications.scheduleNotificationAsync({
      identifier: LIVE_CLASS_NOTIFICATION_ID,
      content: {
        title: `🔴 Live Class: ${params.title || 'Live Session'}`,
        body: `Ustaadha: ${params.teacherName || 'Faculty'} • Audio Active (Tap to Return)`,
        data: {
          route: `/live-class/${params.classId}`,
          classId: params.classId,
        },
        sticky: true,
        autoDismiss: false,
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[LiveClassNotification] Failed to display ongoing notification:', err);
  }
}

/**
 * Dismisses ongoing notification when live class is explicitly exited or ended
 */
export async function dismissLiveClassNotification(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications?.dismissNotificationAsync) return;

    await Notifications.dismissNotificationAsync(LIVE_CLASS_NOTIFICATION_ID);
  } catch (err) {
    console.warn('[LiveClassNotification] Failed to dismiss notification:', err);
  }
}
