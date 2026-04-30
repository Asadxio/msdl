/**
 * Incoming Call Modal - Shows when receiving a call via Socket.io
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
import { useCall } from '@/context/CallContext';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';

export function IncomingCallModal() {
  const { incomingCall, acceptCall, rejectCall, callStatus } = useCall();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  // Pulse animation for avatar
  useEffect(() => {
    if (incomingCall) {
      // Slide in animation
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
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
      pulseAnimation.start();

      // Vibrate pattern for incoming call
      if (Platform.OS !== 'web') {
        const vibrationPattern = [0, 500, 200, 500];
        Vibration.vibrate(vibrationPattern, true);
      }

      return () => {
        pulseAnimation.stop();
        Vibration.cancel();
        slideAnim.setValue(300);
      };
    }
  }, [incomingCall, pulseAnim, slideAnim]);

  const handleAccept = async () => {
    Vibration.cancel();
    await acceptCall();
  };

  const handleReject = () => {
    Vibration.cancel();
    rejectCall('declined');
  };

  if (!incomingCall || callStatus !== 'ringing') return null;

  const isVideoCall = incomingCall.call_type === 'video';

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      onRequestClose={handleReject}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
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
              styles.avatarOuter,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={50} color="#fff" />
            </View>
          </Animated.View>

          {/* Caller name */}
          <Text style={styles.callerName}>{incomingCall.caller_name}</Text>
          <Text style={styles.callerSubtext}>is calling you...</Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            {/* Reject button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Decline</Text>

            {/* Accept button */}
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isVideoCall ? 'videocam' : 'call'}
                size={32}
                color="#fff"
              />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xl * 2,
    backgroundColor: '#1a1a2e',
    borderRadius: RADIUS.xl,
    marginHorizontal: SPACING.lg,
    width: '90%',
    maxWidth: 360,
  },
  callTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginBottom: 32,
    gap: 8,
  },
  callTypeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  avatarOuter: {
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  callerName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  callerSubtext: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 40,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 50,
  },
  actionBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectBtn: {
    backgroundColor: '#E53935',
  },
  acceptBtn: {
    backgroundColor: '#4CAF50',
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
