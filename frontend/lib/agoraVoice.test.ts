import {
  agoraVoice,
  formatAgoraChannelName,
  getAgoraAppId,
  getAgoraAppCertificate,
  getAgoraPool,
  getActiveAgoraAccount,
  markAgoraAccountExhausted,
  getNextPoolAccount,
  resetAgoraPoolExhaustion,
  AGORA_CREDENTIAL_POOL,
} from './agoraVoice';

describe('Agora Voice Service & Configuration', () => {
  beforeEach(() => {
    resetAgoraPoolExhaustion();
  });

  it('loads valid Agora App ID and Certificate from env or pool', () => {
    const appId = getAgoraAppId();
    expect(appId).toBe('e60c4718af28454c94664323a7f52d30');
    expect(appId.length).toBe(32);

    const cert = getAgoraAppCertificate();
    expect(typeof cert).toBe('string');
    expect(cert.length).toBe(32);
  });

  it('contains at least 7 active production accounts in credential pool', () => {
    const pool = getAgoraPool();
    expect(pool.length).toBeGreaterThanOrEqual(7);
    const activeProduction = pool.filter((acc) => acc.isActive && acc.appCertificate.length === 32);
    expect(activeProduction.length).toBe(7);

    // Each account must have unique 32-char hex App ID and App Certificate
    const appIds = new Set(activeProduction.map((a) => a.appId));
    expect(appIds.size).toBe(7);
    activeProduction.forEach((acc) => {
      expect(acc.appId).toMatch(/^[0-9a-f]{32}$/i);
      expect(acc.appCertificate).toMatch(/^[0-9a-f]{32}$/i);
    });
  });

  it('supports preferredAppId resolution and account lookup', () => {
    const secondAcc = AGORA_CREDENTIAL_POOL[1];
    const resolved = getActiveAgoraAccount(secondAcc.appId);
    expect(resolved.appId).toBe(secondAcc.appId);
    expect(resolved.appCertificate).toBe(secondAcc.appCertificate);
    expect(resolved.label).toBe(secondAcc.label);
  });

  it('rotates through pool accounts when an account is marked exhausted', () => {
    const primary = AGORA_CREDENTIAL_POOL[0];
    const secondary = AGORA_CREDENTIAL_POOL[1];

    markAgoraAccountExhausted(primary.appId, 60);
    const nextAcc = getNextPoolAccount(primary.appId);
    expect(nextAcc).not.toBeNull();
    expect(nextAcc?.appId).toBe(secondary.appId);

    // Next getActiveAgoraAccount should automatically skip the exhausted account
    const active = getActiveAgoraAccount();
    expect(active.appId).toBe(secondary.appId);
  });

  it('triggers failover to next account on AgoraVoiceService', async () => {
    await agoraVoice.initEngine();
    const initialAppId = agoraVoice.getCurrentAppId();
    expect(initialAppId).toBe(AGORA_CREDENTIAL_POOL[0].appId);

    let rotatedAppId = '';
    let rotatedLabel = '';
    const unsub = agoraVoice.subscribe({
      onAccountRotated: (newId, label) => {
        rotatedAppId = newId;
        rotatedLabel = label;
      },
    });

    const failedOver = await agoraVoice.handleFailoverToNextAccount();
    expect(failedOver).toBe(true);
    expect(agoraVoice.getCurrentAppId()).toBe(AGORA_CREDENTIAL_POOL[1].appId);
    expect(rotatedAppId).toBe(AGORA_CREDENTIAL_POOL[1].appId);
    expect(rotatedLabel).toBe(AGORA_CREDENTIAL_POOL[1].label);

    unsub();
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
