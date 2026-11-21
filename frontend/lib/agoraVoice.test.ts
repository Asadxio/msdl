import {
  agoraVoice,
  formatAgoraChannelName,
  getAgoraAppId,
  getAgoraAppCertificate,
} from './agoraVoice';

describe('Agora Voice Service & Configuration', () => {
  it('loads valid Agora App ID and Certificate from env or fallback', () => {
    const appId = getAgoraAppId();
    expect(appId).toBe('eabe6cf2f8404a7e8a17a58b1665c52b');
    expect(appId.length).toBe(32);

    const cert = getAgoraAppCertificate();
    expect(typeof cert).toBe('string');
  });

  it('formats channel names according to Agora specs (alphanumeric, underscores, <= 64 chars)', () => {
    expect(formatAgoraChannelName('course-101:sec-A')).toBe('mslb_course_101_sec_A');
    expect(formatAgoraChannelName('')).toBe('mslb_live_general');
    const longId = 'a'.repeat(100);
    const formatted = formatAgoraChannelName(longId);
    expect(formatted.length).toBeLessThanOrEqual(64);
    expect(formatted.startsWith('mslb_')).toBe(true);
  });

  it('initializes and handles room lifecycle gracefully in test/mock environment', async () => {
    const initRes = await agoraVoice.initEngine();
    expect(initRes).toBe(true);

    let joinedChannel = '';
    let isMutedState = false;
    let connState = '';

    const unsubscribe = agoraVoice.subscribe({
      onJoinSuccess: (ch) => {
        joinedChannel = ch;
      },
      onMuteChanged: (muted) => {
        isMutedState = muted;
      },
      onConnectionChange: (status) => {
        connState = status;
      },
    });

    const joinRes = await agoraVoice.joinVoiceRoom({
      classId: 'tajweed_class_01',
      isTeacher: true,
      initialMuted: false,
    });

    expect(joinRes).toBe(true);
    expect(joinedChannel).toBe('mslb_tajweed_class_01');
    expect(agoraVoice.getIsMuted()).toBe(false);
    expect(connState).toBe('connected');

    // Toggle mute
    await agoraVoice.setMute(true);
    expect(agoraVoice.getIsMuted()).toBe(true);
    expect(isMutedState).toBe(true);

    // Echo test in mock
    let echoMessage = '';
    await agoraVoice.startAudioLoopbackTest((msg) => {
      echoMessage = msg;
    });
    expect(echoMessage).toContain('mock');
    agoraVoice.stopAudioLoopbackTest();

    // Leave room
    await agoraVoice.leaveVoiceRoom();
    const state = agoraVoice.getInRoomState();
    expect(state.isJoined).toBe(false);

    unsubscribe();
    await agoraVoice.release();
  });

  it('tracks active session metadata and supports background persistence without duplicate re-joins', async () => {
    await agoraVoice.initEngine();

    const joined = await agoraVoice.joinVoiceRoom({
      classId: 'surah_baqarah_lesson_3',
      classTitle: 'Surah Al-Baqarah Tajweed',
      teacherName: 'Ustaadha Fatima',
      isTeacher: true,
      initialMuted: false,
    });

    expect(joined).toBe(true);
    expect(agoraVoice.isRoomActive()).toBe(true);

    const session = agoraVoice.getActiveSession();
    expect(session).not.toBeNull();
    expect(session?.classId).toBe('surah_baqarah_lesson_3');
    expect(session?.classTitle).toBe('Surah Al-Baqarah Tajweed');
    expect(session?.teacherName).toBe('Ustaadha Fatima');
    expect(session?.isTeacher).toBe(true);

    // Fast-path re-entry test: navigating back to screen should not tear down room
    const reJoined = await agoraVoice.joinVoiceRoom({
      classId: 'surah_baqarah_lesson_3',
      classTitle: 'Surah Al-Baqarah Tajweed (Updated)',
    });
    expect(reJoined).toBe(true);
    expect(agoraVoice.getActiveSession()?.classTitle).toBe('Surah Al-Baqarah Tajweed (Updated)');

    // Update metadata directly
    agoraVoice.updateSessionMetadata({
      classTitle: 'Surah Al-Baqarah Verses 1-10',
    });
    expect(agoraVoice.getActiveSession()?.classTitle).toBe('Surah Al-Baqarah Verses 1-10');

    // Leaving class cleans up session and state
    await agoraVoice.leaveVoiceRoom();
    expect(agoraVoice.isRoomActive()).toBe(false);
    expect(agoraVoice.getActiveSession()).toBeNull();

    await agoraVoice.release();
  });
});
