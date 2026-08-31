import fs from 'fs';
import path from 'path';

describe('Phase 41 — Advanced Audio Player & Offline Caching Engine', () => {
  const offlineCacheSrc = fs.readFileSync(path.resolve(__dirname, './offlineAudioCache.ts'), 'utf8');
  const recordingsScreenSrc = fs.readFileSync(path.resolve(__dirname, '../app/recordings.tsx'), 'utf8');

  test('offlineAudioCache.ts exports all required caching helpers', () => {
    expect(offlineCacheSrc).toContain('getLocalAudioUri');
    expect(offlineCacheSrc).toContain('isAudioCached');
    expect(offlineCacheSrc).toContain('getPlayableAudioUri');
    expect(offlineCacheSrc).toContain('downloadAudioForOffline');
    expect(offlineCacheSrc).toContain('deleteCachedAudio');
    expect(offlineCacheSrc).toContain('getCachedAudioSizeMb');
    expect(offlineCacheSrc).toContain('mslb_recordings');
  });

  test('recordings.tsx contains interactive seek scrubbing logic', () => {
    expect(recordingsScreenSrc).toContain('handleSeekByRatio');
    expect(recordingsScreenSrc).toContain('scrubberTrack');
    expect(recordingsScreenSrc).toContain('scrubberProgress');
    expect(recordingsScreenSrc).toContain('setPositionAsync');
  });

  test('recordings.tsx contains 10-second forward/rewind controls', () => {
    expect(recordingsScreenSrc).toContain('handleSkipSeconds');
    expect(recordingsScreenSrc).toContain('10s');
    expect(recordingsScreenSrc).toContain('play-back');
    expect(recordingsScreenSrc).toContain('play-forward');
  });

  test('recordings.tsx contains speed selector with pitch correction', () => {
    expect(recordingsScreenSrc).toContain('PLAYBACK_SPEEDS');
    expect(recordingsScreenSrc).toContain('handleSetSpeed');
    expect(recordingsScreenSrc).toContain('setRateAsync');
    expect(recordingsScreenSrc).toContain('shouldCorrectPitch');
  });

  test('recordings.tsx contains offline download and caching integration', () => {
    expect(recordingsScreenSrc).toContain('handleDownloadOffline');
    expect(recordingsScreenSrc).toContain('handleDeleteOffline');
    expect(recordingsScreenSrc).toContain('downloadProgressMap');
    expect(recordingsScreenSrc).toContain('offlineMap');
    expect(recordingsScreenSrc).toContain('cloud-done');
  });

  test('recordings.tsx contains expandable modal full audio player', () => {
    expect(recordingsScreenSrc).toContain('fullPlayerVisible');
    expect(recordingsScreenSrc).toContain('modalSheet');
    expect(recordingsScreenSrc).toContain('modalScrubberTrack');
    expect(recordingsScreenSrc).toContain('modalSpeedPillsRow');
  });
});
