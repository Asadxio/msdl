/**
 * agoraVoice.ts — Madrasatu-s-Salikat Lil Banat (MSLB)
 * Real-time In-App Audio Engine via Agora.io RTC
 *
 * CRITICAL AUDIO & PURDAH POLICIES:
 * 1. Strictly Audio-Only: Video tracks and camera capture are completely disabled.
 * 2. Proper RTC Pipeline: publishMicrophoneTrack & enableAudioRecordingOrPlayout enabled.
 * 3. Loudspeaker Default: Audio routes to phone speakerphone (not tiny earpiece).
 * 4. Transparent Connection States: Real onConnectionStateChanged & Error 110 diagnostics.
 * 5. Loopback Echo Test: Allows single-device microphone & speaker verification.
 */

import { generateAgoraRtcToken } from './agoraTokenGenerator';
import {
  showLiveClassOngoingNotification,
  dismissLiveClassNotification,
} from './liveClassNotification';

export interface ActiveLiveSessionInfo {
  classId: string;
  channelName: string;
  classTitle?: string;
  teacherName?: string;
  isTeacher: boolean;
  uid: number;
}

// Safe runtime resolution for React Native & native Agora modules
let Platform: any = { OS: 'android' };
let PermissionsAndroid: any = null;

try {
  const RN = require('react-native');
  Platform = RN.Platform || Platform;
  PermissionsAndroid = RN.PermissionsAndroid || null;
} catch {
  // In Node / unit-test environments
}

export type AgoraConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface AgoraSpeakerInfo {
  uid: number;
  volume: number; // 0 to 255
  isLocal: boolean;
}

export interface AgoraVoiceCallbacks {
  onJoinSuccess?: (channel: string, uid: number) => void;
  onConnectionChange?: (status: AgoraConnectionStatus, reasonMsg?: string) => void;
  onUserJoined?: (uid: number) => void;
  onUserOffline?: (uid: number) => void;
  onVolumeIndicator?: (speakers: AgoraSpeakerInfo[], totalVolume: number, isSpeaking: boolean) => void;
  onError?: (errCode: number, errorDescription: string) => void;
  onMuteChanged?: (muted: boolean) => void;
  onEchoTestResult?: (message: string) => void;
}

// Lazy dynamic load of native Agora RTC SDK
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = null;
let ClientRoleType: any = null;
let ConnectionStateType: any = null;
let ConnectionChangedReasonType: any = null;
let AudioScenarioType: any = null;

try {
  const agora = require('react-native-agora');
  createAgoraRtcEngine = agora.createAgoraRtcEngine;
  ChannelProfileType = agora.ChannelProfileType;
  ClientRoleType = agora.ClientRoleType;
  ConnectionStateType = agora.ConnectionStateType;
  ConnectionChangedReasonType = agora.ConnectionChangedReasonType;
  AudioScenarioType = agora.AudioScenarioType;
} catch (err) {
  // Graceful fallback for mock / non-native environments
}

export const AGORA_DEFAULT_APP_ID = 'eabe6cf2f8404a7e8a17a58b1665c52b';
// Project MSLB is configured in Agora Console as App ID Only (Testing) mode (no certificate/token required).
export const AGORA_DEFAULT_APP_CERTIFICATE = '';

export function getAgoraAppId(): string {
  const envId = process.env.EXPO_PUBLIC_AGORA_APP_ID;
  if (envId && envId.trim().length > 0) {
    return envId.trim();
  }
  return AGORA_DEFAULT_APP_ID;
}

export function getAgoraAppCertificate(): string {
  const envCert = process.env.EXPO_PUBLIC_AGORA_APP_CERTIFICATE;
  if (envCert !== undefined && envCert !== null) {
    return envCert.trim();
  }
  return AGORA_DEFAULT_APP_CERTIFICATE;
}

export function formatAgoraChannelName(classId: string): string {
  if (!classId) return 'mslb_live_general';
  const clean = classId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `mslb_${clean}`.slice(0, 64);
}

class AgoraVoiceService {
  private engine: any = null;
  private isInitialized = false;
  private isJoined = false;
  private connectionStatus: AgoraConnectionStatus = 'disconnected';
  private lastErrorMessage: string | null = null;
  private currentChannel: string | null = null;
  private localMuted = true;
  private isTeacherMode = false;
  private callbacks: Set<AgoraVoiceCallbacks> = new Set();
  private remoteUsers: Set<number> = new Set();
  private isEchoTesting = false;
  private currentUid = 0;
  private lastTokenUsed = '';
  private cachedRtcToken = '';
  private currentMediaOptions: any = null;
  private hasRetriedWithoutToken = false;
  private hasRetriedWithToken = false;
  private activeSession: ActiveLiveSessionInfo | null = null;

  public isSupported(): boolean {
    return !!createAgoraRtcEngine && Platform.OS !== 'web';
  }

  public getConnectionStatus(): AgoraConnectionStatus {
    return this.connectionStatus;
  }

  public getInRoomState() {
    return {
      isJoined: this.isJoined,
      connectionStatus: this.connectionStatus,
      lastError: this.lastErrorMessage,
      channel: this.currentChannel,
      isMuted: this.localMuted,
      remoteCount: this.remoteUsers.size,
      isEchoTesting: this.isEchoTesting,
    };
  }

  public async requestMicrophonePermission(): Promise<boolean> {
    if (Platform.OS !== 'android' || !PermissionsAndroid) return true;
    try {
      const checkResult = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (checkResult) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone Permission Required • مائیکروفون کی اجازت',
          message:
            'Madrasa Portal requires microphone access so teachers and students can hear and recite during live class.\n(لائیو کلاس میں تلاوت اور تدریس کے لیے مائیکروفون کی اجازت لازمی ہے)',
          buttonPositive: 'Allow (اجازت دیں)',
          buttonNegative: 'Deny (انکار)',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[AgoraVoice] Permission request error:', err);
      return false;
    }
  }

  public async initEngine(): Promise<boolean> {
    if (!this.isSupported()) {
      this.isInitialized = true;
      this.connectionStatus = 'connected';
      return true;
    }

    if (this.isInitialized && this.engine) {
      return true;
    }

    const appId = getAgoraAppId();
    if (!appId) {
      this.lastErrorMessage = 'Agora App ID is missing from configuration.';
      this.connectionStatus = 'failed';
      return false;
    }

    try {
      // Background Audio Configuration: ensure audio continues when app is minimized or navigating in-app
      try {
        const { Audio } = require('expo-av');
        if (Audio?.setAudioModeAsync) {
          await Audio.setAudioModeAsync({
            staysActiveInBackground: true,
            shouldDuckAndroid: false,
            playsInSilentModeIOS: true,
          });
        }
      } catch (audioModeErr) {
        // Fallback for mock or headless test environments
      }

      this.engine = createAgoraRtcEngine();
      this.engine.initialize({
        appId,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication ?? 0,
        audioScenario: AudioScenarioType?.AudioScenarioMeeting ?? 8,
      });

      // Purdah Privacy Rule: Video is permanently turned off
      this.engine.disableVideo();

      // Enable Audio subsystem and local audio capture device (Microphone)
      this.engine.enableAudio();
      this.engine.enableLocalAudio(true);

      // Audio profile optimized for speech clarity in meetings/recitation (Profile 1: SpeechStandard)
      try {
        this.engine.setAudioProfile?.(1, AudioScenarioType?.AudioScenarioMeeting ?? 8);
      } catch {}

      // AI Noise Suppression (Deep background fan, rustle, and room echo cancellation)
      try {
        if (typeof this.engine.setAINSMode === 'function') {
          this.engine.setAINSMode(true, 1);
        }
        if (typeof this.engine.setParameters === 'function') {
          // Speech enhancement and deep noise elimination
          this.engine.setParameters('{"che.audio.ains_mode": 1}');
          this.engine.setParameters('{"che.audio.ans.mode": 2}');
          // 2G/3G Packet Loss Concealment (PLC) & Adaptive Low-Bandwidth Resilience
          this.engine.setParameters('{"che.audio.neteq.plc_enabled": true}');
          this.engine.setParameters('{"che.audio.low_bitrate_mode": true}');
        }
      } catch (noiseErr) {
        console.warn('[AgoraVoice] Noise suppression setup fallback:', noiseErr);
      }

      // Volume settings (boosted gain for clear classroom audio)
      this.engine.adjustRecordingSignalVolume(150);
      this.engine.adjustPlaybackSignalVolume(200);

      // Set audio route to loudspeaker so students hear loud, clear audio (not phone earpiece)
      this.engine.setDefaultAudioRouteToSpeakerphone(true);
      this.engine.setEnableSpeakerphone(true);

      // Audio volume indication every 200ms (smoothness = 3, vad = true)
      this.engine.enableAudioVolumeIndication(200, 3, true);

      this.setupEventHandlers();
      this.isInitialized = true;
      return true;
    } catch (err: any) {
      this.lastErrorMessage = `Agora Engine init error: ${err?.message || err}`;
      this.connectionStatus = 'failed';
      console.warn('[AgoraVoice] Engine initialization failed:', err);
      return false;
    }
  }

  private setupEventHandlers() {
    if (!this.engine) return;

    this.engine.registerEventHandler({
      onJoinChannelSuccess: (connection: any, elapsed: number) => {
        this.isJoined = true;
        this.connectionStatus = 'connected';
        this.lastErrorMessage = null;
        this.currentChannel = connection?.channelId || this.currentChannel;
        const uid = connection?.localUid || 0;

        // Force loudspeaker & maximum clarity when connection is established
        try {
          this.engine?.adjustPlaybackSignalVolume(200);
          this.engine?.setEnableSpeakerphone(true);
        } catch {}

        if (this.activeSession) {
          showLiveClassOngoingNotification({
            title: this.activeSession.classTitle || 'Live Class',
            teacherName: this.activeSession.teacherName || 'Faculty',
            classId: this.activeSession.classId || '',
          }).catch(() => {});
        }

        this.callbacks.forEach((cb) => {
          cb.onJoinSuccess?.(this.currentChannel || '', uid);
          cb.onConnectionChange?.('connected');
        });
      },

      onConnectionStateChanged: (connection: any, state: number, reason: number) => {
        // Agora ConnectionStateType: 1=Disconnected, 2=Connecting, 3=Connected, 4=Reconnecting, 5=Failed
        // Agora ConnectionChangedReasonType: 8=InvalidToken, 9=TokenExpired, 6=InvalidAppId, 7=InvalidChannelName
        if (state === 3) {
          this.connectionStatus = 'connected';
          this.isJoined = true;
          this.callbacks.forEach((cb) => cb.onConnectionChange?.('connected'));
        } else if (state === 2) {
          this.connectionStatus = 'connecting';
          this.callbacks.forEach((cb) => cb.onConnectionChange?.('connecting'));
        } else if (state === 4) {
          this.connectionStatus = 'reconnecting';
          this.callbacks.forEach((cb) => cb.onConnectionChange?.('reconnecting'));
        } else if (state === 5 || state === 1) {
          if (reason === 8 || reason === 9) {
            // Error 110/Token Rejection: Automatic Dual-Mode Fallback
            if (!this.hasRetriedWithoutToken && this.lastTokenUsed !== '') {
              this.hasRetriedWithoutToken = true;
              console.log('[AgoraVoice] Token rejected (reason 8). Automatically retrying Direct App-ID Mode...');
              try {
                this.engine?.leaveChannel();
                this.lastTokenUsed = '';
                this.engine?.joinChannel('', this.currentChannel || '', this.currentUid, this.currentMediaOptions);
                return;
              } catch (e) {
                console.warn('[AgoraVoice] Direct fallback attempt failed:', e);
              }
            } else if (!this.hasRetriedWithToken && this.lastTokenUsed === '' && this.cachedRtcToken) {
              this.hasRetriedWithToken = true;
              console.log('[AgoraVoice] Direct mode rejected (reason 8). Automatically retrying Token Mode...');
              try {
                this.engine?.leaveChannel();
                this.lastTokenUsed = this.cachedRtcToken;
                this.engine?.joinChannel(this.cachedRtcToken, this.currentChannel || '', this.currentUid, this.currentMediaOptions);
                return;
              } catch (e) {
                console.warn('[AgoraVoice] Token fallback attempt failed:', e);
              }
            }

            // Both modes attempted and rejected by Agora server
            this.lastErrorMessage =
              'Agora Error 110: Audio authentication failed. Tap "Audio Error" for diagnosis.';
            this.connectionStatus = 'failed';
            this.callbacks.forEach((cb) => {
              cb.onError?.(110, this.lastErrorMessage!);
              cb.onConnectionChange?.('failed', this.lastErrorMessage!);
            });
          } else if (reason === 6) {
            this.lastErrorMessage = 'Agora Error: Invalid App ID. Please verify your Agora project App ID.';
            this.connectionStatus = 'failed';
            this.callbacks.forEach((cb) => {
              cb.onError?.(101, this.lastErrorMessage!);
              cb.onConnectionChange?.('failed', this.lastErrorMessage!);
            });
          }
        }
      },

      onUserJoined: (connection: any, remoteUid: number) => {
        this.remoteUsers.add(remoteUid);
        try {
          this.engine?.adjustUserPlaybackSignalVolume(remoteUid, 200);
          this.engine?.setEnableSpeakerphone(true);
        } catch {}
        this.callbacks.forEach((cb) => cb.onUserJoined?.(remoteUid));
      },

      onUserOffline: (connection: any, remoteUid: number) => {
        this.remoteUsers.delete(remoteUid);
        this.callbacks.forEach((cb) => cb.onUserOffline?.(remoteUid));
      },

      onAudioVolumeIndication: (
        connection: any,
        speakers: any[],
        speakerNumber: number,
        totalVolume: number
      ) => {
        const parsedSpeakers: AgoraSpeakerInfo[] = (speakers || []).map((s) => ({
          uid: s.uid,
          volume: s.volume || 0,
          isLocal: s.uid === 0,
        }));

        const isSpeaking = (totalVolume || 0) > 8 || parsedSpeakers.some((s) => (s.volume || 0) > 8);
        this.callbacks.forEach((cb) =>
          cb.onVolumeIndicator?.(parsedSpeakers, totalVolume || 0, isSpeaking)
        );
      },

      onError: (errCode: number, msg: string) => {
        console.warn('[AgoraVoice] RTC Error code:', errCode, msg);
        let errorDesc = `RTC Error (${errCode}): ${msg}`;

        if (errCode === 110) {
          errorDesc =
            'Agora Error 110 (ERR_INVALID_TOKEN): Token expired or rejected by server.';
        } else if (errCode === 101) {
          errorDesc = 'Agora Error 101: Invalid App ID.';
        } else if (errCode === 102) {
          errorDesc = 'Agora Error 102: Invalid channel name.';
        }

        this.lastErrorMessage = errorDesc;
        this.connectionStatus = 'failed';
        this.callbacks.forEach((cb) => {
          cb.onError?.(errCode, errorDesc);
          cb.onConnectionChange?.('failed', errorDesc);
        });
      },
    });
  }

  public async joinVoiceRoom(params: {
    classId: string;
    uid?: number;
    isTeacher?: boolean;
    initialMuted?: boolean;
    classTitle?: string;
    teacherName?: string;
  }): Promise<boolean> {
    const channelName = formatAgoraChannelName(params.classId);

    // Fast-path re-entrancy: if already in this room, preserve active connection & update metadata
    if (this.isJoined && this.currentChannel === channelName) {
      if (this.activeSession) {
        if (params.classTitle) this.activeSession.classTitle = params.classTitle;
        if (params.teacherName) this.activeSession.teacherName = params.teacherName;
      }
      return true;
    }

    const permGranted = await this.requestMicrophonePermission();
    if (!permGranted) {
      this.lastErrorMessage = 'Microphone permission was not granted on this device.';
      this.callbacks.forEach((cb) => cb.onError?.(-1, this.lastErrorMessage!));
    }

    const initialized = await this.initEngine();
    if (!initialized) return false;

    this.currentChannel = channelName;
    this.isTeacherMode = !!params.isTeacher;
    const defaultMute = params.initialMuted !== undefined ? params.initialMuted : !params.isTeacher;
    this.localMuted = defaultMute;
    this.connectionStatus = 'connecting';
    this.callbacks.forEach((cb) => cb.onConnectionChange?.('connecting'));

    const userUid =
      params.uid && params.uid > 0
        ? params.uid
        : Math.floor(Math.random() * 899999) + 100000;

    this.activeSession = {
      classId: params.classId,
      channelName,
      classTitle: params.classTitle,
      teacherName: params.teacherName,
      isTeacher: !!params.isTeacher,
      uid: userUid,
    };

    if (!this.isSupported() || !this.engine) {
      // Mock / fallback mode
      this.isJoined = true;
      this.connectionStatus = 'connected';
      showLiveClassOngoingNotification({
        title: params.classTitle || 'Live Class',
        teacherName: params.teacherName || 'Faculty',
        classId: params.classId,
      }).catch(() => {});
      this.callbacks.forEach((cb) => {
        cb.onJoinSuccess?.(channelName, params.uid || 1);
        cb.onConnectionChange?.('connected');
        cb.onMuteChanged?.(this.localMuted);
      });
      return true;
    }

    try {
      // Generate RTC AccessToken2 if App Certificate is configured
      const appId = getAgoraAppId();
      const appCert = getAgoraAppCertificate();
      let rtcToken = '';
      if (appId && appCert) {
        try {
          rtcToken = generateAgoraRtcToken({
            appId,
            appCertificate: appCert,
            channelName,
            uid: userUid,
          });
          console.log(`[AgoraVoice] Token generated for uid=${userUid}: length=${rtcToken.length}, starts=${rtcToken.slice(0, 10)}`);
        } catch (tokenErr) {
          console.warn('[AgoraVoice] Token generation failed:', tokenErr);
        }
      }

      if (!rtcToken) {
        console.log('[AgoraVoice] Connecting in Direct App-ID Mode (no token required for testing-mode project)');
      }

      this.currentUid = userUid;
      this.cachedRtcToken = rtcToken;
      this.lastTokenUsed = rtcToken;
      this.hasRetriedWithoutToken = false;
      this.hasRetriedWithToken = false;

      // Configure Channel Media Options:
      // publishMicrophoneTrack: true is mandatory so Agora creates the audio track pipeline!
      // Audio transmission is then controlled instantly via muteLocalAudioStream(isMuted).
      const mediaOptions = {
        clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication ?? 0,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
        enableAudioRecordingOrPlayout: true,
        publishCameraTrack: false,
        autoSubscribeVideo: false,
      };
      this.currentMediaOptions = mediaOptions;

      const joinCode = this.engine.joinChannel(rtcToken, channelName, userUid, mediaOptions);

      if (joinCode < 0) {
        this.lastErrorMessage = `joinChannel returned failure code: ${joinCode}`;
        console.warn('[AgoraVoice] joinChannel error code:', joinCode);
        this.connectionStatus = 'failed';
        this.callbacks.forEach((cb) => {
          cb.onError?.(joinCode, this.lastErrorMessage!);
          cb.onConnectionChange?.('failed', this.lastErrorMessage!);
        });
        return false;
      }

      // Set initial mute state
      this.engine.muteLocalAudioStream(this.localMuted);
      this.callbacks.forEach((cb) => cb.onMuteChanged?.(this.localMuted));
      return true;
    } catch (err: any) {
      this.lastErrorMessage = `joinChannel exception: ${err?.message || err}`;
      console.warn('[AgoraVoice] Failed to join channel:', err);
      this.connectionStatus = 'failed';
      this.callbacks.forEach((cb) => {
        cb.onError?.(-1, this.lastErrorMessage!);
        cb.onConnectionChange?.('failed', this.lastErrorMessage!);
      });
      return false;
    }
  }

  public async setMute(muted: boolean): Promise<boolean> {
    this.localMuted = muted;

    if (this.engine && this.isSupported()) {
      try {
        // Zero-latency instant mute/unmute without track renegotiation disruption
        this.engine.muteLocalAudioStream(muted);
      } catch (err) {
        console.warn('[AgoraVoice] Failed to mute/unmute:', err);
      }
    }

    this.callbacks.forEach((cb) => cb.onMuteChanged?.(muted));
    return this.localMuted;
  }

  public async toggleMute(): Promise<boolean> {
    return this.setMute(!this.localMuted);
  }

  public getIsMuted(): boolean {
    return this.localMuted;
  }

  /**
   * Starts a 5-second audio loopback echo test.
   * Enables users to speak into their microphone and hear their own voice played back,
   * completely verifying microphone and speakerphone on a single device!
   */
  public async startAudioLoopbackTest(onEchoResult?: (msg: string) => void): Promise<boolean> {
    const permGranted = await this.requestMicrophonePermission();
    if (!permGranted) return false;

    await this.initEngine();
    if (!this.engine || !this.isSupported()) {
      onEchoResult?.('Loopback test not available in mock environment.');
      return false;
    }

    try {
      this.isEchoTesting = true;
      // If currently in a channel, leave temporarily for test
      if (this.isJoined) {
        this.engine.leaveChannel();
      }

      this.engine.startEchoTest({
        intervalInSeconds: 3,
        enableAudio: true,
        enableVideo: false,
      });

      onEchoResult?.('Echo Test Active: Speak now. Your voice will repeat back in 3 seconds.');
      return true;
    } catch (err: any) {
      console.warn('[AgoraVoice] Error starting echo test:', err);
      this.isEchoTesting = false;
      return false;
    }
  }

  public stopAudioLoopbackTest(): void {
    if (this.engine && this.isSupported() && this.isEchoTesting) {
      try {
        this.engine.stopEchoTest();
      } catch {}
      this.isEchoTesting = false;
    }
  }

  public async leaveVoiceRoom(): Promise<void> {
    this.isJoined = false;
    this.connectionStatus = 'disconnected';
    this.currentChannel = null;
    this.remoteUsers.clear();
    this.activeSession = null;
    dismissLiveClassNotification().catch(() => {});

    if (this.engine && this.isSupported()) {
      try {
        this.engine.leaveChannel();
      } catch (err) {
        console.warn('[AgoraVoice] Failed to leave channel:', err);
      }
    }
    this.callbacks.forEach((cb) => cb.onConnectionChange?.('disconnected'));
  }

  public getActiveSession(): ActiveLiveSessionInfo | null {
    return this.activeSession;
  }

  public isRoomActive(): boolean {
    return this.isJoined && !!this.currentChannel;
  }

  public updateSessionMetadata(meta: { classTitle?: string; teacherName?: string }): void {
    if (!this.activeSession) return;
    if (meta.classTitle) this.activeSession.classTitle = meta.classTitle;
    if (meta.teacherName) this.activeSession.teacherName = meta.teacherName;
    if (this.isJoined) {
      showLiveClassOngoingNotification({
        title: this.activeSession.classTitle || 'Live Class',
        teacherName: this.activeSession.teacherName || 'Faculty',
        classId: this.activeSession.classId || '',
      }).catch(() => {});
    }
  }

  public subscribe(callbacks: AgoraVoiceCallbacks): () => void {
    this.callbacks.add(callbacks);
    return () => {
      this.callbacks.delete(callbacks);
    };
  }

  public async retryJoin(forceMode?: 'token' | 'direct'): Promise<boolean> {
    if (!this.currentChannel || !this.engine) return false;
    this.connectionStatus = 'connecting';
    this.callbacks.forEach((cb) => cb.onConnectionChange?.('connecting'));

    const token =
      forceMode === 'direct'
        ? ''
        : forceMode === 'token'
        ? this.cachedRtcToken
        : this.lastTokenUsed
        ? ''
        : this.cachedRtcToken;

    this.lastTokenUsed = token;
    console.log(`[AgoraVoice] Manual retryJoin with mode=${forceMode || (token ? 'token' : 'direct')}, tokenLength=${token.length}`);

    try {
      this.engine.leaveChannel();
      const code = this.engine.joinChannel(
        token,
        this.currentChannel,
        this.currentUid,
        this.currentMediaOptions || {
          clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
          channelProfile: ChannelProfileType?.ChannelProfileCommunication ?? 0,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: true,
          enableAudioRecordingOrPlayout: true,
          publishCameraTrack: false,
          autoSubscribeVideo: false,
        }
      );
      return code >= 0;
    } catch (err) {
      console.warn('[AgoraVoice] retryJoin failed:', err);
      return false;
    }
  }

  public getDebugInfo() {
    return {
      appId: getAgoraAppId(),
      channel: this.currentChannel,
      uid: this.currentUid,
      tokenLength: this.lastTokenUsed ? this.lastTokenUsed.length : 0,
      tokenPrefix: this.lastTokenUsed ? this.lastTokenUsed.slice(0, 10) : 'NONE (Direct)',
      hasCertificate: !!getAgoraAppCertificate(),
      lastError: this.lastErrorMessage,
      status: this.connectionStatus,
    };
  }

  public async release(): Promise<void> {
    await this.leaveVoiceRoom();
    this.stopAudioLoopbackTest();
    if (this.engine && this.isSupported()) {
      try {
        this.engine.release();
      } catch (err) {
        console.warn('[AgoraVoice] Error releasing engine:', err);
      }
      this.engine = null;
    }
    this.isInitialized = false;
    this.callbacks.clear();
  }
}

export const agoraVoice = new AgoraVoiceService();
