import { trackEvent } from '@/lib/analytics';

export function trackLiveJoin(classId: string, ok: boolean, reconnectCount = 0) {
  trackEvent('live_join', { class_id: classId, ok, reconnect_count: reconnectCount }, `live:${classId}:${ok}:${reconnectCount}`);
}

export function trackRtcQuality(classId: string, latencyMs: number, audioFailures: number, videoFailures: number) {
  trackEvent('custom', {
    metric: 'rtc_quality',
    class_id: classId,
    latency_ms: latencyMs,
    audio_failures: audioFailures,
    video_failures: videoFailures,
  });
}
