/**
 * Incoming Call Modal - Shows when receiving a call
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCall } from '@/context/CallContext';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';

export function IncomingCallModal() {
  const router = useRouter();
  const { incomingCall, acceptCall, rejectCall } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for avatar
  useEffect(() => {
    if (incomingCall) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      // Vibrate pattern for incoming call
      if (Platform.OS !== 'web') {
        const vibrationPattern = [0, 500, 200, 500];
        Vibration.vibrate(vibrationPattern, true);
      }

      return () => {
        animation.stop();
        Vibration.cancel();
      };
    }
  }, [incomingCall, pulseAnim]);

  const handleAccept = async () => {
    Vibration.cancel();
    await acceptCall();
    // Navigate to call screen
    if (incomingCall?.channelName) {
      router.push(`/call/${incomingCall.channelName}`);
    }
  };

  const handleReject = async () => {
    Vibration.cancel();
    await rejectCall();
  };

  if (!incomingCall) return null;

  const isVideoCall = incomingCall.callType === 'video';

  return (
    <Modal
      visible={!!incomingCall}
      transparent
      animationType="slide"
      onRequestClose={handleReject}
    >
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Call type indicator */}
          <View style={styles.callTypeTag}>
            <Ionicons
              name={isVideoCall ? 'videocam' : 'call'}
              size={16}
              color="#fff"
            />
            <Text style={styles.callTypeText}>
              Incoming {isVideoCall ? 'Video' : 'Voice'} Call
            </Text>
          </View>

          {/* Caller avatar with pulse animation */}
          <Animated.View
            style={[
              styles.avatarContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
          </Animated.View>

          {/* Caller name */}
          <Text style={styles.callerName}>{incomingCall.callerName}</Text>
          <Text style={styles.callerSubtext}>is calling you...</Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Reject button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={handleReject}
            >
              <Ionicons name="close" size={32} color="#fff" />
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
            >
              <Ionicons
                name={isVideoCall ? 'videocam' : 'call'}
                size={32}
                color="#fff"
              />
              <Text style={styles.actionLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  callTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginBottom: 40,
    gap: 8,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  callerSubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 60,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E53935',
  },
  acceptBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '600',
  },
});
