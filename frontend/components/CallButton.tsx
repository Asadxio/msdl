/**
 * Call Button Component - For initiating calls from chat
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCall } from '@/context/CallContext';
import { CallParticipant, CallType, isPlatformSupported } from '@/lib/agora';
import { COLORS, RADIUS } from '@/constants/theme';

interface CallButtonProps {
  participant: CallParticipant;
  callType: CallType;
  size?: number;
  style?: any;
}

export function CallButton({ participant, callType, size = 22, style }: CallButtonProps) {
  const router = useRouter();
  const { initiateCall, isInCall, currentCall } = useCall();

  const handlePress = async () => {
    if (!isPlatformSupported()) {
      Alert.alert(
        'Not Supported',
        'Voice and video calls are only available on mobile devices (iOS/Android).',
        [{ text: 'OK' }]
      );
      return;
    }

    if (isInCall) {
      Alert.alert('Busy', 'You are already in a call');
      return;
    }

    try {
      await initiateCall(participant, callType);
      
      // Navigate to call screen after initiating
      if (currentCall?.channelName) {
        router.push(`/call/${currentCall.channelName}`);
      }
    } catch (error: any) {
      console.error('[CallButton] Error:', error);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={callType === 'video' ? 'videocam' : 'call'}
        size={size}
        color={COLORS.primary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
