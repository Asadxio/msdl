import { Platform } from 'react-native';

const GHUSL_NOTIFICATION_IDENTIFIER = 'msdl_ghusl_paaki_reminder';

async function ensureNotificationPermissions(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[TaharatNotifications] Failed to check permissions:', err);
    return false;
  }
}

export async function cancelGhuslReminder(): Promise<void> {
  try {
    const Notifications = require('expo-notifications');
    await Notifications.cancelScheduledNotificationAsync(GHUSL_NOTIFICATION_IDENTIFIER);
    console.log('[TaharatNotifications] Cancelled existing Ghusl reminder.');
  } catch (err) {
    console.warn('[TaharatNotifications] Error cancelling Ghusl reminder:', err);
  }
}

export async function scheduleExpectedGhuslReminder(
  startDateIso: string,
  habitDays: number = 7,
  isEnabled: boolean = true
): Promise<boolean> {
  if (!isEnabled) {
    await cancelGhuslReminder();
    return false;
  }

  const hasPermission = await ensureNotificationPermissions();
  if (!hasPermission) {
    console.warn('[TaharatNotifications] Permission denied for local notifications.');
    return false;
  }

  try {
    const Notifications = require('expo-notifications');

    await cancelGhuslReminder();

    const start = new Date(startDateIso);
    const targetDate = new Date(start.getTime() + habitDays * 24 * 60 * 60 * 1000);
    targetDate.setHours(6, 0, 0, 0);

    const now = new Date();
    if (targetDate.getTime() <= now.getTime()) {
      console.log('[TaharatNotifications] Target Ghusl reminder time is in the past.');
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: GHUSL_NOTIFICATION_IDENTIFIER,
      content: {
        title: '\u{1F338} \u063a\u0633\u0644 \u0648 \u067e\u0627\u06a9\u06cc \u06a9\u06cc \u06cc\u0627\u062f \u062f\u06c1\u0627\u0646\u06cc - Madrasatu-s-Salikat',
        body: '\u0622\u062c \u0622\u067e \u06a9\u06cc \u067e\u0627\u06a9\u06cc (\u0637\u06c1\u0631) \u06a9\u0627 \u0645\u062a\u0648\u0642\u0639 \u062f\u0646 \u06c1\u06d2\u06d4 \u0641\u062c\u0631 \u06cc\u0627 \u0646\u0645\u0627\u0632 \u0642\u0636\u0627 \u06c1\u0648\u0646\u06d2 \u0633\u0642\u0628\u0644 \u063a\u0633\u0644 \u0645\u06a9\u0645\u0644 \u06a9\u0631 \u06a9\u06d2 \u0646\u0645\u0627\u0632 \u06a9\u06cc \u062a\u06cc\u0627\u0631\u06cc \u0641\u0631\u0645\u0627\u0626\u06cc\u06ba\u06d4',
        data: {
          type: 'ghusl_reminder',
          screen: '/taharat-tracker',
        },
        sound: 'default',
        priority: 'high',
      },
      trigger: {
        date: targetDate,
      },
    });

    console.log('[TaharatNotifications] Scheduled Ghusl reminder for ' + targetDate.toISOString());
    return true;
  } catch (err) {
    console.warn('[TaharatNotifications] Failed to schedule Ghusl reminder:', err);
    return false;
  }
}
