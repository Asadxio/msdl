/**
 * Call Screen - Voice and Video Calling with Agora
 * Supports 1-to-1 voice and video calls
 * Note: Agora SDK only works on native platforms (iOS/Android), not web
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '@/constants/theme';
import { useCall } from '@/context/CallContext';
import { formatCallDuration, AGORA_APP_ID, isPlatformSupported } from '@/lib/agora';

// Platform-specific Agora loader
import { loadAgoraEngine, isAgoraAvailable } from '@/lib/agoraLoader';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentCall, agoraToken, agoraUid, endCall, callDuration: contextCallDuration, callStatus, cancelOutgoingCall } = useCall();

  // Agora module refs
  const engineRef = useRef<any>(null);
  const [agoraModules, setAgoraModules] = useState<any>(null);

  // UI State
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [connectionState, setConnectionState] = useState<string>('Connecting...');

  const isVideoCall = currentCall?.callType === 'video';
  const channelName = id || currentCall?.channelName || '';

  // Load Agora modules on mount
  useEffect(() => {
    if (Platform.OS !== 'web' && isAgoraAvailable()) {
      loadAgoraEngine().then(setAgoraModules).catch(console.error);
    }
  }, []);

  // Initialize Agora engine
  const initEngine = useCallback(async () => {
    if (!agoraModules?.available || !AGORA_APP_ID) {
      console.error('[Call] Agora not available or App ID missing');
      setConnectionState('Configuration error');
      return;
    }

    const { createEngine, ChannelProfileType, ClientRoleType } = agoraModules;

    try {
      console.log('[Call] Initializing Agora engine...');
      const engine = createEngine();
      engineRef.current = engine;

      // Initialize with App ID
      engine.initialize({
        appId: AGORA_APP_ID,
        channelProfile: ChannelProfileType?.ChannelProfileCommunication,
      });

      // Set up event handlers
      engine.addListener('onJoinChannelSuccess', (_connection: any, _elapsed: number) => {
        console.log('[Call] Joined channel successfully');
        setIsJoined(true);
        setConnectionState('Connected');
      });

      engine.addListener('onUserJoined', (_connection: any, uid: number, _elapsed: number) => {
        console.log('[Call] Remote user joined:', uid);
        setRemoteUid(uid);
        setConnectionState('In call');
      });

      engine.addListener('onUserOffline', (_connection: any, uid: number, reason: number) => {
        console.log('[Call] Remote user left:', uid, 'reason:', reason);
        setRemoteUid(null);
        handleEndCall();
      });

      engine.addListener('onError', (err: number, msg: string) => {
        console.error('[Call] Agora error:', err, msg);
        if (err === 17) {
          setIsJoined(true);
        }
      });

      engine.addListener('onConnectionStateChanged', (_connection: any, state: number, _reason: number) => {
        const states: Record<number, string> = {
          1: 'Disconnected',
          2: 'Connecting...',
          3: 'Connected',
          4: 'Reconnecting...',
          5: 'Failed',
        };
        setConnectionState(states[state] || 'Unknown');
      });

      // Enable video if video call
      if (isVideoCall) {
        engine.enableVideo();
        engine.startPreview();
      }

      // Enable audio
      engine.enableAudio();
      engine.setEnableSpeakerphone(true);

      console.log('[Call] Engine initialized, joining channel:', channelName);

      // Join channel with token
      if (agoraToken && channelName) {
        engine.joinChannel(agoraToken, channelName, agoraUid, {
          clientRoleType: ClientRoleType?.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: isVideoCall,
          autoSubscribeAudio: true,
          autoSubscribeVideo: isVideoCall,
        });
      } else {
        console.error('[Call] Missing token or channel name');
        setConnectionState('Missing credentials');
      }

    } catch (error: any) {
      console.error('[Call] Init error:', error);
      setConnectionState('Initialization failed');
      Alert.alert('Error', 'Failed to initialize call: ' + error.message);
    }
  }, [agoraModules, agoraToken, channelName, agoraUid, isVideoCall]);

  // Cleanup on unmount
  useEffect(() => {
    if (!isPlatformSupported()) {
      Alert.alert('Not Supported', 'Calls are only available on mobile devices', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    if (agoraModules?.available) {
      initEngine();
    }

    return () => {
      console.log('[Call] Cleaning up Agora engine...');
      if (engineRef.current) {
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      }
    };
  }, [agoraModules, initEngine, router]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted(!isMuted);
    }
  }, [isMuted]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (engineRef.current && isVideoCall) {
      if (isVideoEnabled) {
        engineRef.current.muteLocalVideoStream(true);
        engineRef.current.stopPreview();
      } else {
        engineRef.current.muteLocalVideoStream(false);
        engineRef.current.startPreview();
      }
      setIsVideoEnabled(!isVideoEnabled);
    }
  }, [isVideoEnabled, isVideoCall]);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.setEnableSpeakerphone(!isSpeakerOn);
      setIsSpeakerOn(!isSpeakerOn);
    }
  }, [isSpeakerOn]);

  // Switch camera
  const switchCamera = useCallback(() => {
    if (engineRef.current && isVideoCall) {
      engineRef.current.switchCamera();
      setIsFrontCamera(!isFrontCamera);
    }
  }, [isFrontCamera, isVideoCall]);

  // End call
  const handleEndCall = useCallback(async () => {
    console.log('[Call] Ending call...');
    
    if (engineRef.current) {
      engineRef.current.leaveChannel();
    }
    
    await endCall();
    router.back();
  }, [endCall, router]);

  // Render remote video
  const renderRemoteVideo = () => {
    if (!isVideoCall || !remoteUid || !agoraModules?.SurfaceView) {
      return null;
    }

    const RtcSurfaceView = agoraModules.SurfaceView;
    const VideoSourceType = agoraModules.VideoSourceType;

    return (
      <RtcSurfaceView
        style={styles.remoteVideo}
        canvas={{
          uid: remoteUid,
          sourceType: VideoSourceType?.VideoSourceRemote,
        }}
      />
    );
  };

  // Render local video
  const renderLocalVideo = () => {
    if (!isVideoCall || !isVideoEnabled || !agoraModules?.SurfaceView) {
      return null;
    }

    const RtcSurfaceView = agoraModules.SurfaceView;
    const VideoSourceType = agoraModules.VideoSourceType;

    return (
      <View style={styles.localVideoContainer}>
        <RtcSurfaceView
          style={styles.localVideo}
          canvas={{
            uid: 0,
            sourceType: VideoSourceType?.VideoSourceCamera,
          }}
          zOrderMediaOverlay={true}
        />
      </View>
    );
  };

  // Get other participant name
  const otherParticipantName = currentCall
    ? currentCall.callerId === currentCall.receiverId
      ? currentCall.callerName
      : currentCall.callerId === agoraUid.toString()
      ? currentCall.receiverName
      : currentCall.callerName
    : 'Unknown';

  // Web fallback UI
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.voiceCallBackground}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="desktop-outline" size={60} color="#fff" />
            </View>
            <Text style={styles.participantName}>Not Supported</Text>
            <Text style={styles.callStatus}>
              Voice and video calls are only available on mobile devices
            </Text>
            <TouchableOpacity style={styles.endCallBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background for video or voice call */}
      {isVideoCall && remoteUid ? (
        <View style={styles.videoContainer}>
          {renderRemoteVideo()}
        </View>
      ) : (
        <View style={styles.voiceCallBackground}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={60} color="#fff" />
            </View>
            <Text style={styles.participantName}>{otherParticipantName}</Text>
            <Text style={styles.callStatus}>
              {remoteUid ? formatCallDuration(contextCallDuration) : connectionState}
            </Text>
          </View>
        </View>
      )}

      {/* Local video preview */}
      {renderLocalVideo()}

      {/* Top bar */}
      <SafeAreaView style={[styles.topBar, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleEndCall}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topName}>{otherParticipantName}</Text>
          <Text style={styles.topStatus}>
            {isVideoCall ? 'Video Call' : 'Voice Call'} • {connectionState}
          </Text>
        </View>
        {isVideoCall && (
          <TouchableOpacity style={styles.switchCameraBtn} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.controls}>
          {/* Mute button */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={toggleMute}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={28}
              color={isMuted ? COLORS.error : '#fff'}
            />
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Video toggle (only for video calls) */}
          {isVideoCall && (
            <TouchableOpacity
              style={[styles.controlBtn, !isVideoEnabled && styles.controlBtnActive]}
              onPress={toggleVideo}
            >
              <Ionicons
                name={isVideoEnabled ? 'videocam' : 'videocam-off'}
                size={28}
                color={!isVideoEnabled ? COLORS.error : '#fff'}
              />
              <Text style={styles.controlLabel}>{isVideoEnabled ? 'Camera' : 'Camera Off'}</Text>
            </TouchableOpacity>
          )}

          {/* Speaker toggle */}
          <TouchableOpacity
            style={[styles.controlBtn, !isSpeakerOn && styles.controlBtnActive]}
            onPress={toggleSpeaker}
          >
            <Ionicons
              name={isSpeakerOn ? 'volume-high' : 'volume-mute'}
              size={28}
              color={!isSpeakerOn ? COLORS.textMuted : '#fff'}
            />
            <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
          </TouchableOpacity>

          {/* End call button */}
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall}>
            <Ionicons name="call" size={32} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Connecting overlay */}
      {!isJoined && (
        <View style={styles.connectingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.connectingText}>{connectionState}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  voiceCallBackground: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  participantName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  remoteVideo: {
    flex: 1,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  localVideo: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  topName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  topStatus: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  switchCameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingTop: SPACING.lg,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E53935',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
});
