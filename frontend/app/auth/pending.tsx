import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const { signOut, refreshProfile, profile } = useAuth();
  const [checking, setChecking] = React.useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={48} color={COLORS.secondary} />
        </View>
        <Text style={styles.title}>Account Pending</Text>
        <Text style={styles.subtitle}>
          Your account is pending approval.{'\n'}An admin will review your request soon.
        </Text>

        {profile && (
          <View style={styles.infoCard} testID="pending-info">
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{profile.name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{profile.role}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>Pending</Text>
              </View>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.checkBtn} onPress={handleCheck} disabled={checking} testID="check-status-btn">
          {checking ? <ActivityIndicator size="small" color={COLORS.primary} /> : (
            <>
              <Ionicons name="refresh" size={18} color={COLORS.primary} />
              <Text style={styles.checkBtnText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={signOut} testID="pending-logout-btn">
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: SPACING.md },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 24 },
  infoCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', gap: SPACING.sm, marginTop: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.textMain, textTransform: 'capitalize' },
  pendingBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  checkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 2, borderColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 24, paddingVertical: 14, marginTop: 8 },
  checkBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  logoutBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.error },
});
