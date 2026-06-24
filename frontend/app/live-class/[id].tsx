import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, SafeAreaView, Linking, Platform } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { subscribeLiveClass, endLiveClass, canCurrentUserJoinLiveClass, type LiveClass } from '@/lib/liveClasses';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';

export default function LiveClassroomScreen() {
  const { id } = useLocalSearchParams();
  const classId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [liveClass, setLiveClass] = useState<LiveClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!classId) {
      setLoading(false);
      return;
    }
    const unsub = subscribeLiveClass(classId, (data) => {
      setLiveClass(data);
      setLoading(false);
      if (data?.status === 'ended') {
        Alert.alert('Class Ended', 'This live class has ended.');
        goBackOrReplace(router, '/(tabs)/courses');
      }
    });
    return () => unsub();
  }, [classId, router]);

  const isTeacher = profile?.role === 'teacher' || profile?.role === 'admin';

  const handleJoinClass = async () => {
    if (!liveClass || !user || !profile) return;
    setJoining(true);
    try {
      const allowed = await canCurrentUserJoinLiveClass(liveClass, profile);
      if (!allowed) {
        Alert.alert('Access denied', 'You are not enrolled in this course.');
        return;
      }
      
      const meetUrl = liveClass.meet_url;
      if (!meetUrl) {
        Alert.alert('Error', 'No Google Meet URL was provided for this class.');
        return;
      }

      // Try to open the URL directly using Linking (this will open the Google Meet app if installed)
      const canOpen = await Linking.canOpenURL(meetUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(meetUrl);
      } else {
        // Fallback to in-app browser
        await WebBrowser.openBrowserAsync(meetUrl, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
      }
    } catch (e: any) {
      Alert.alert('Error joining class', e?.message || 'Could not launch Google Meet.');
    } finally {
      setJoining(false);
    }
  };

  const handleEndClass = () => {
    if (!classId || !isTeacher) return;
    Alert.alert('End Class', 'Are you sure you want to end this live class for everyone?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'End Class', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await endLiveClass(classId, profile);
            goBackOrReplace(router, '/(tabs)/courses');
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not end class.');
          }
        }
      }
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  if (!liveClass) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Class not found</Text>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => goBackOrReplace(router, '/(tabs)/courses')}>
          <Text style={styles.secondaryBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, '/(tabs)/courses')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title} numberOfLines={1}>{liveClass.title}</Text>
          <Text style={styles.subtitle}>{liveClass.teacher_name}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Ionicons name="videocam" size={64} color={COLORS.primary} style={styles.icon} />
          <Text style={styles.cardTitle}>Live Class is Active</Text>
          <Text style={styles.cardDesc}>
            Join the Google Meet classroom to participate in the session.
          </Text>

          <TouchableOpacity style={[styles.primaryBtn, joining && { opacity: 0.7 }]} onPress={handleJoinClass} disabled={joining}>
            {joining ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Join Google Meet</Text>}
          </TouchableOpacity>

          {isTeacher && (
            <TouchableOpacity style={styles.dangerBtn} onPress={handleEndClass}>
              <Text style={styles.dangerBtnText}>End Class for Everyone</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  errorTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: SPACING.md },
  secondaryBtn: { paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: COLORS.surface },
  secondaryBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: SPACING.xs },
  headerTitleContainer: { flex: 1, marginLeft: SPACING.sm },
  title: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  subtitle: { color: COLORS.textMuted, fontSize: 14 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: { backgroundColor: COLORS.surface, width: '100%', maxWidth: 400, borderRadius: RADIUS.lg, padding: SPACING.xl, alignItems: 'center' },
  icon: { marginBottom: SPACING.md },
  cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: SPACING.sm, textAlign: 'center' },
  cardDesc: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginBottom: SPACING.xl },
  primaryBtn: { backgroundColor: COLORS.primary, width: '100%', padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', marginBottom: SPACING.md },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  dangerBtn: { backgroundColor: 'transparent', width: '100%', padding: SPACING.md, borderRadius: RADIUS.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.error },
  dangerBtnText: { color: COLORS.error, fontSize: 16, fontWeight: 'bold' }
});
