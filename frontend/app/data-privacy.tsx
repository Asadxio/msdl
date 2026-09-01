import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { deleteUser } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { UIButton, InlineError } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { createPrivacyRequest } from '@/lib/legal';
import { auth, db } from '@/lib/firebase';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { goBackOrReplace } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DataPrivacyScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState<'deletion' | 'export' | 'direct_delete' | null>(null);
  const [error, setError] = useState('');
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const insets = useSafeAreaInsets();

  const submit = async (type: 'deletion' | 'export') => {
    if (!user?.uid || loading) return;
    const trimmed = reason.trim();
    if (trimmed.length < 8) {
      setError('Please provide at least 8 characters so support can process your request safely.');
      return;
    }
    setError('');
    setLoading(type);
    try {
      await createPrivacyRequest(user.uid, type, trimmed);
      Alert.alert('Request submitted', `Your ${type} request was recorded and queued for review.`);
      setReason('');
    } finally {
      setLoading(null);
    }
  };

  const handlePermanentAccountDeletion = async () => {
    if (!auth.currentUser || !user?.uid) return;
    if (deleteConfirmationInput.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation Mismatch', 'Please type DELETE in capital letters to confirm account deletion.');
      return;
    }

    setLoading('direct_delete');
    try {
      const uid = user.uid;

      // 1. Anonymize user profile document in Firestore
      try {
        await updateDoc(doc(db, 'users', uid), {
          status: 'deactivated',
          name: '[Deleted Account]',
          email: `deleted_${uid.slice(0, 8)}@madrasa.local`,
          is_blocked: true,
          deleted_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not update user doc before Auth delete:', e);
      }

      // 2. Delete user from Firebase Auth
      await deleteUser(auth.currentUser);

      // 3. Clear auth and redirect
      setDeleteModalVisible(false);
      await signOut();
      Alert.alert('Account Deleted', 'Your account has been permanently deleted from Madrasatu-s-Salikat Lil Banat.');
      router.replace('/auth/login');
    } catch (err: any) {
      if (err?.code === 'auth/requires-recent-login') {
        Alert.alert(
          'Re-authentication Required',
          'For security, please log out and log back in before deleting your account.'
        );
      } else {
        Alert.alert('Deletion Failed', err?.message || 'Could not delete account at this time.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.md }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <TouchableOpacity style={styles.backButton} onPress={() => goBackOrReplace(router, '/settings')} accessibilityRole="button" accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
            <Text allowFontScaling accessibilityRole="header" style={styles.title}>Data & Privacy Controls</Text>
            <Text allowFontScaling style={styles.body}>
              Manage your personal data in compliance with Google Play Data Safety and Madrasa Institutional Privacy Policy.
            </Text>
            <InlineError message={error} />
            <TextInput
              style={styles.input}
              multiline
              value={reason}
              onChangeText={setReason}
              placeholder="Reason or legal request details (for data export or admin review)"
              placeholderTextColor={COLORS.textMuted}
              accessibilityLabel="Privacy request reason"
              maxLength={600}
            />
            <UIButton label="Request Data Export" onPress={() => submit('export')} loading={loading === 'export'} />
            <UIButton label="Request Admin Data Review" onPress={() => submit('deletion')} loading={loading === 'deletion'} variant="secondary" />

            {/* In-App Permanent Deletion (Google Play Store Required) */}
            <View style={styles.dangerBox}>
              <View style={styles.dangerHeader}>
                <Ionicons name="warning" size={18} color="#DC2626" />
                <Text style={styles.dangerTitle}>Permanent Account Deletion</Text>
              </View>
              <Text style={styles.dangerText}>
                Permanently deletes your login account, personal profile, and authentication records. Academic records are preserved for institutional certification audit.
              </Text>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => setDeleteModalVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Delete Account Permanently"
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteBtnText}>Delete My Account Permanently</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="trash" size={28} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Delete Account?</Text>
            <Text style={styles.modalBody}>
              This action is permanent and cannot be undone. To confirm, type <Text style={{ fontWeight: '800', color: '#DC2626' }}>DELETE</Text> below:
            </Text>
            <TextInput
              style={styles.confirmInput}
              value={deleteConfirmationInput}
              onChangeText={setDeleteConfirmationInput}
              placeholder="Type DELETE"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setDeleteConfirmationInput('');
                }}
                disabled={loading === 'direct_delete'}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmDeleteBtn,
                  deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' && styles.disabledBtn,
                ]}
                onPress={handlePermanentAccountDeletion}
                disabled={deleteConfirmationInput.trim().toUpperCase() !== 'DELETE' || loading === 'direct_delete'}
              >
                {loading === 'direct_delete' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>Confirm Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md, paddingBottom: 40 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12, ...SHADOWS.card },
  backButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4 },
  backText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textMain, fontWeight: '800' },
  body: { ...TYPOGRAPHY.body, color: COLORS.textMuted, lineHeight: 20 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dangerBox: {
    marginTop: SPACING.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dangerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  dangerText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
  },
  modalBody: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 18,
  },
  confirmInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
    marginVertical: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    width: '100%',
    marginTop: SPACING.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  confirmDeleteBtn: {
    flex: 1.2,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  disabledBtn: {
    opacity: 0.5,
  },
});
