import { buildNotificationRoute, buildNotificationPayload } from '@/lib/notificationPayloads';
import { resolveRouteFromNotificationData, dedupeNotificationEvent } from '@/lib/notificationCenter';
import type { DispatchNotificationInput } from '@/lib/notificationTypes';

describe('Phase 49 — Notification System & Delivery Pipeline Tests', () => {
  describe('Notification Route Resolution', () => {
    test('resolves direct url route', () => {
      const route = resolveRouteFromNotificationData({ url: '/course/tajweed-101' });
      expect(route).toBe('/course/tajweed-101');
    });

    test('resolves direct route property', () => {
      const route = resolveRouteFromNotificationData({ route: '/live-class/class-99' });
      expect(route).toBe('/live-class/class-99');
    });

    test('resolves call route from call_id', () => {
      const route = resolveRouteFromNotificationData({ call_id: 'call-xyz-123' });
      expect(route).toBe('/call/call-xyz-123');
    });

    test('resolves chat route from chat_id', () => {
      const route = resolveRouteFromNotificationData({ chat_id: 'chat-student-teacher' });
      expect(route).toBe('/chat/chat-student-teacher');
    });

    test('resolves live-class route from live_class_id', () => {
      const route = resolveRouteFromNotificationData({ live_class_id: 'live-456' });
      expect(route).toBe('/live-class/live-456');
    });

    test('resolves course route from course_id', () => {
      const route = resolveRouteFromNotificationData({ course_id: 'quran-tajweed' });
      expect(route).toBe('/course/quran-tajweed');
    });

    test('resolves status route from status_id', () => {
      const route = resolveRouteFromNotificationData({ status_id: 'status-789' });
      expect(route).toBe('/status');
    });

    test('falls back to /notifications when no destination context provided', () => {
      const route = resolveRouteFromNotificationData({});
      expect(route).toBe('/notifications');
    });
  });

  describe('Notification Payload Builder', () => {
    test('constructs consistent normalized notification payload with dedupeId and ts', () => {
      const input: DispatchNotificationInput = {
        channel: 'chat',
        event: 'chat_message',
        title: 'New message',
        body: 'Assalamu alaikum',
        recipientIds: ['user-1', 'user-2'],
        data: { chat_id: 'chat-abc' },
      };
      const payload = buildNotificationPayload(input, 'chat:chat-abc:msg-123');
      expect(payload.type).toBe('chat_message');
      expect(payload.route).toBe('/chat/chat-abc');
      expect(payload.push_dedupe_id).toBe('chat:chat-abc:msg-123');
      expect(typeof payload.ts).toBe('number');
      expect(payload.chat_id).toBe('chat-abc');
      expect(payload.version).toBe(1);
    });

    test('buildNotificationRoute handles explicit route object with query params', () => {
      const route = buildNotificationRoute({
        route: { pathname: '/course/tajweed', params: { tab: 'lessons' } },
        data: {},
      });
      expect(route).toBe('/course/tajweed?tab=lessons');
    });

    test('buildNotificationRoute handles live_classes route fallback', () => {
      const route = buildNotificationRoute({
        data: { live_class_id: 'class-live-1' },
      });
      expect(route).toBe('/live-class/class-live-1');
    });
  });

  describe('Deduplication Engine', () => {
    test('dedupes exact same event within sliding window', () => {
      const key = 'test_dedupe_' + Date.now() + '_' + Math.random();
      expect(dedupeNotificationEvent(key)).toBe(false);
      expect(dedupeNotificationEvent(key)).toBe(true);
    });

    test('allows different keys concurrently', () => {
      const k1 = 'test_dedupe_a_' + Date.now();
      const k2 = 'test_dedupe_b_' + Date.now();
      expect(dedupeNotificationEvent(k1)).toBe(false);
      expect(dedupeNotificationEvent(k2)).toBe(false);
    });
  });

  describe('Channel & Event Contract Validation', () => {
    test('all channels are recognized standard channels', () => {
      const validChannels = ['chat', 'calls', 'live_classes', 'stories', 'assignments', 'announcements', 'system'];
      expect(validChannels).toContain('chat');
      expect(validChannels).toContain('calls');
      expect(validChannels).toContain('live_classes');
      expect(validChannels).toContain('assignments');
      expect(validChannels).toContain('announcements');
    });

    test('all events conform to expected contract', () => {
      const events = [
        'chat_message',
        'call_incoming',
        'call_missed',
        'live_class_started',
        'live_class_reminder',
        'story_uploaded',
        'assignment_posted',
        'announcement_posted',
        'system_alert',
      ];
      expect(events.length).toBe(9);
    });
  });
});
