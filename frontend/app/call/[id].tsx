import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, SafeAreaView, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { subscribeCallSession, setCallState, type CallSession } from '@/lib/calls';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const callId = String(id || '');
  const { user } = useAuth();
  const router = useRouter();
  
  const [call, setCall] = useState<CallSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!callId) {
      setLoading(false);
      return;
    }
    return subscribeCallSession(callId, (next) => {
      setCall(next);
      setLoading(false);
      if (next?.status === 'ended' || next?.status === 'missed' || next?.status === 'declined') {
        Alert.alert('Call Ended', 'The call has been terminated.');
        goBackOrReplace(router, '/(tabs)/chats');
      }
    });
  }, [callId, router]);

  const isCaller = call?.caller_id === user?.uid;

  const handleJoinCall = async () => {
    if (!call) return;
    try {
      await setCallState(callId, 'connected');
      const meetUrl = `https://meet.jit.si/${call.channel_name}`;
      await WebBrowser.openBrowserAsync(meetUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not join call.');
    }
  };

  const handleEndCall = async () => {
    if (!callId) return;
    try {
      await setCallState(callId, isCaller && call?.status === 'ringing' ? 'missed' : 'ended');
      goBackOrReplace(router, '/(tabs)/chats');
    } catch (e) {
      goBackOrReplace(router, '/(tabs)/chats');
    }
  };

  if (loading || !call) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <Text style={styles.title}>{isCaller ? 'Outgoing Call' : 'Incoming Call'}</Text>
        <Text style={styles.subtitle}>{call.status === 'ringing' ? 'Waiting to join...' : call.status}</Text>
        
        <View style={styles.card}>
          <Ionicons name={call.mode === 'video' ? 'videocam' : 'call'} size={64} color={COLORS.primary} style={styles.icon} />
          
          <TouchableOpacity style={styles.primaryBtn} onPress={handleJoinCall}>
            <Text style={styles.primaryBtnText}>Join Call</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleEndCall}>
            <Text style={styles.dangerBtnText}>{call.status === 'ringing' && !isCaller ? 'Decline' : 'End Call'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  title: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', marginBottom: SPACING.xs },
  subtitle: { color: COLORS.textMuted, fontSize: 16, marginBottom: SPACING.xl },
  card: { backgroundColor: COLORS.surface, width: '100%', maxWidth: 400, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center' },
  icon: { marginBottom: SPACING.xl },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dangerBtn: { backgroundColor: 'transparent', width: '100%', padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.error },
  dangerBtnText: { color: COLORS.error, fontSize: 16, fontWeight: 'bold' }
});
