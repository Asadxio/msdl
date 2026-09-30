import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { claimTeacherAccessCode, type ClaimTeacherResponse } from '@/lib/teacherAccessCode';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useRouter } from 'expo-router';

interface TeacherAccessCodeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (result: ClaimTeacherResponse) => void;
}

export function TeacherAccessCodeModal({
  visible,
  onClose,
  onSuccess,
}: TeacherAccessCodeModalProps) {
  const router = useRouter();
  const { user, profile, refreshProfile } = useAuth();
  const { refetch } = useData();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimTeacherResponse | null>(null);

  const handleReset = () => {
    setCode('');
    setLoading(false);
    setErrorMsg(null);
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleVerify = async () => {
    const clean = code.trim();
    if (!clean) {
      setErrorMsg('Please enter your Teacher Code.');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await claimTeacherAccessCode(clean);
      setResult(res);

      // Refresh auth profile and data context so role & courses reload immediately
      try {
        if (refreshProfile) {
          await refreshProfile();
        }
        refetch();
      } catch (refreshErr) {
        console.warn('[TeacherAccessCodeModal] Profile refresh warning:', refreshErr);
      }

      onSuccess?.(res);
    } catch (err: any) {
      console.error('[TeacherAccessCodeModal] Verification error:', err);
      const msg =
        err?.message ||
        'Teacher code verification failed. Please check the code and try again.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    handleClose();
    router.replace('/(tabs)');
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="key" size={20} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.modalTitle}>Faculty Access Code</Text>
                <Text style={styles.modalSubTitle}>استاد کوڈ درج کریں</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {!result ? (
              <>
                <Text style={styles.instructionText}>
                  Madrasa Admin se mila hua <Text style={styles.boldText}>Teacher Code</Text> yahan enter karein.
                  Code verify hote hi aapka account Teacher ban jayega aur aapke saare courses active ho jayenge.
                </Text>

                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.codeInput}
                    value={code}
                    onChangeText={(val) => {
                      setCode(val.toUpperCase());
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="e.g. TCH-0001 ya SUMRA"
                    placeholderTextColor={COLORS.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={32}
                    editable={!loading}
                  />
                  {code.length > 0 && !loading && (
                    <TouchableOpacity onPress={() => setCode('')} style={styles.clearBtn}>
                      <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>

                {errorMsg && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.verifyBtn, (!code.trim() || loading) && styles.disabledBtn]}
                  onPress={handleVerify}
                  disabled={!code.trim() || loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                      <Text style={styles.verifyBtnText}>Activate Teacher Profile</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.helpBox}>
                  <Ionicons name="information-circle-outline" size={16} color={COLORS.textMuted} />
                  <Text style={styles.helpText}>
                    Agar aapke paas Teacher Code nahi hai, toh apne Madrasa Administrator se rabta karein.
                  </Text>
                </View>
              </>
            ) : (
              /* Success View */
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-done-circle" size={54} color={COLORS.success} />
                </View>

                <Text style={styles.successTitle}>Mubarak Ho! 🎉</Text>
                <Text style={styles.successName}>Ustaadha {result.teacherName}</Text>
                <Text style={styles.successSub}>
                  Teacher ID: <Text style={styles.boldText}>{result.teacherId}</Text>
                </Text>

                <View style={styles.coursesCard}>
                  <Text style={styles.coursesCardTitle}>
                    Assigned Courses ({result.assignedCoursesCount}):
                  </Text>
                  {result.assignedCourseNames.length > 0 ? (
                    result.assignedCourseNames.map((cName, idx) => (
                      <View key={idx} style={styles.courseItem}>
                        <Ionicons name="book" size={16} color={COLORS.primary} />
                        <Text style={styles.courseItemText}>{cName}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noCoursesText}>
                      Aapka account verify ho chuka hai. Admin courses assign kar rahe hain.
                    </Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={handleFinish}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneBtnText}>Open Teacher Dashboard</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  modalSubTitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    paddingTop: SPACING.md,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  boldText: {
    fontWeight: '700',
    color: COLORS.textMain,
  },
  inputWrap: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
    color: COLORS.textMain,
    backgroundColor: '#F8FAFC',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  clearBtn: {
    position: 'absolute',
    right: 14,
    top: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    marginTop: 4,
    ...SHADOWS.card,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: SPACING.md,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.sm,
  },
  helpText: {
    fontSize: 12,
    color: COLORS.textMuted,
    flex: 1,
    lineHeight: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  successIconCircle: {
    marginBottom: 10,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.success,
    marginBottom: 4,
  },
  successName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 2,
  },
  successSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  coursesCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.lg,
  },
  coursesCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  courseItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  noCoursesText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  doneBtn: {
    width: '100%',
    backgroundColor: COLORS.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    ...SHADOWS.card,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
