import fs from 'fs';
import path from 'path';

describe('Phase 43 — Notifications & Communication Engine', () => {
  const sendPushSrc = fs.readFileSync(path.resolve(__dirname, '../app/admin/send-push.tsx'), 'utf8');
  const notificationsSrc = fs.readFileSync(path.resolve(__dirname, '../app/(tabs)/notifications.tsx'), 'utf8');
  const liveClassSrc = fs.readFileSync(path.resolve(__dirname, '../app/live-class/[id].tsx'), 'utf8');

  test('send-push.tsx contains targeted audience presets and 1-tap quick templates', () => {
    expect(sendPushSrc).toContain('QUICK_TEMPLATES');
    expect(sendPushSrc).toContain('Live Class Alert');
    expect(sendPushSrc).toContain('Dars Recording');
    expect(sendPushSrc).toContain('Quiz & Sabaq Due');
    expect(sendPushSrc).toContain('templateChip');
    expect(sendPushSrc).toContain('targetMode');
  });

  test('notifications.tsx supports mark all as read and deep-link routing', () => {
    expect(notificationsSrc).toContain('markAllAsRead');
    expect(notificationsSrc).toContain('handlePressNotificationItem');
    expect(notificationsSrc).toContain('live-class');
    expect(notificationsSrc).toContain('recordings');
    expect(notificationsSrc).toContain('quiz');
  });

  test('live-class/[id].tsx provides 1-tap student push alert dispatcher', () => {
    expect(liveClassSrc).toContain('dispatchNotification');
    expect(liveClassSrc).toContain('handleSendPushAlertToStudents');
    expect(liveClassSrc).toContain('live_class_started');
    expect(liveClassSrc).toContain('notifyStudentsBtn');
  });
});
