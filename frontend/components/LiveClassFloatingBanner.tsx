import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { usePathname, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { agoraVoice, type ActiveLiveSessionInfo, type AgoraSpeakerInfo } from '@/lib/agoraVoice';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

export function LiveClassFloatingBanner() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [activeSession, setActiveSession] = useState<ActiveLiveSessionInfo | null>(
    agoraVoice.getActiveSession()
  );
  const [isJoined, setIsJoined] = useState(agoraVoice.isRoomActive());
  const [isMuted, setIsMuted] = useState(agoraVoice.getIsMuted());
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    // Sync initial state
    setActiveSession(agoraVoice.getActiveSession());
    setIsJoined(agoraVoice.isRoomActive());
    setIsMuted(agoraVoice.getIsMuted());

    const unsub = agoraVoice.subscribe({
      onJoinSuccess: () => {
        setActiveSession(agoraVoice.getActiveSession());
        setIsJoined(true);
      },
      onConnectionChange: (status) => {
        setIsJoined(status === 'connected');
        if (status === 'disconnected' || status === 'failed') {
          setActiveSession(agoraVoice.getActiveSession());
        }
      },
      onMuteChanged: (muted) => {
        setIsMuted(muted);
      },
      onVolumeIndicator: (_speakers: AgoraSpeakerInfo[], _totalVolume: number, speaking: boolean) => {
        setIsSpeaking(speaking);
      },
    });

    return () => unsub();
  }, []);

  // Hide when inside the classroom screen itself or if there is no active live session
  const isInsideLiveClassroom = pathname?.startsWith('/live-class');
  if (isInsideLiveClassroom || !isJoined || !activeSession) {
    return null;
  }

  const isInsideTabs = segments[0] === '(tabs)';
  // Position above tab bar when in tabs, or above home indicator on stack screens
  const bottomPosition = isInsideTabs
    ? Platform.OS === 'ios'
      ? 88
      : 68 + (insets.bottom > 0 ? insets.bottom : 8)
    : Math.max(insets.bottom, 12);

  const handleReturnToClass = () => {
    router.push(`/live-class/${activeSession.classId}` as any);
  };

  const handleToggleMute = async () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    await agoraVoice.setMute(nextMuted).catch(() => {});
  };

  const handleLeaveClass = () => {
    Alert.alert(
      'Leave Live Class • کلاس چھوڑیں',
      'Are you sure you want to disconnect from this live audio class?\n(کیا آپ لائیو کلاس آڈیو سے الگ ہونا چاہتے ہیں؟)',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave Class',
          style: 'destructive',
          onPress: async () => {
            await agoraVoice.leaveVoiceRoom();
            setIsJoined(false);
            setActiveSession(null);
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.floatingContainer,
        { bottom: bottomPosition },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.bannerCard}>
        {/* Left: Live Indicator & Class Info (Tappable to return) */}
        <TouchableOpacity
          style={styles.infoArea}
          onPress={handleReturnToClass}
          activeOpacity={0.8}
        >
          <View style={styles.liveIndicatorBadge}>
            <View style={[styles.pulseDot, isSpeaking && styles.pulseDotSpeaking]} />
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.classTitle} numberOfLines={1}>
              {activeSession.classTitle || 'Live Class Session'}
            </Text>
            <Text style={styles.teacherSubtitle} numberOfLines={1}>
              {activeSession.teacherName
                ? `Ustaadha: ${activeSession.teacherName} • Audio Active`
                : 'Audio Connected • Tap to Return'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Right: Quick In-App Actions */}
        <View style={styles.actionsRow}>
          {/* Mic Toggle Button */}
          <TouchableOpacity
            style={[styles.actionBtn, !isMuted && styles.actionBtnMicActive]}
            onPress={handleToggleMute}
            accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isMuted ? 'mic-off' : 'mic'}
              size={18}
              color={!isMuted ? '#FFFFFF' : COLORS.textSecondary}
            />
          </TouchableOpacity>

          {/* Return to Fullscreen Classroom Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnReturn]}
            onPress={handleReturnToClass}
            accessibilityLabel="Return to live classroom"
            activeOpacity={0.7}
          >
            <Ionicons name="expand" size={17} color={COLORS.primary} />
          </TouchableOpacity>

          {/* Disconnect / Leave Class Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnLeave]}
            onPress={handleLeaveClass}
            accessibilityLabel="Disconnect live class audio"
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={16} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9998,
    alignItems: 'center',
  },
  bannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E9D5FF', // Soft royal violet border
    ...SHADOWS.card,
    elevation: 8,
    shadowColor: '#3B0764',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    width: '100%',
  },
  infoArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  liveIndicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    marginRight: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DC2626',
    marginRight: 4,
  },
  pulseDotSpeaking: {
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  textColumn: {
    flex: 1,
  },
  classTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  teacherSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnMicActive: {
    backgroundColor: '#10B981',
  },
  actionBtnReturn: {
    backgroundColor: '#F3E8FF',
  },
  actionBtnLeave: {
    backgroundColor: '#EF4444',
  },
});
