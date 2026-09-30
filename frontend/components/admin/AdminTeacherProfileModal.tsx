import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import {
  saveTeacherProfileAsAdmin,
  type TeacherProfile,
  isValidTeacherId,
} from '@/lib/teacherIdentity';
import { allocateNextTeacherId } from '@/lib/teacherIdCounter';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';

interface AdminTeacherProfileModalProps {
  visible: boolean;
  onClose: () => void;
  initialTeacher: Partial<TeacherProfile> | null;
  onTeacherSaved?: () => void;
}

export function AdminTeacherProfileModal({
  visible,
  onClose,
  initialTeacher,
  onTeacherSaved,
}: AdminTeacherProfileModalProps) {
  const { profile: adminProfile } = useAuth();
  const router = useRouter();

  const [name, setName] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [userUid, setUserUid] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'approved' | 'active' | 'pending' | 'deactivated'>('approved');
  const [verificationStatus, setVerificationStatus] = useState<'approved' | 'pending' | 'verified'>('approved');
  const [islamicQualification, setIslamicQualification] = useState('');
  const [qualificationsText, setQualificationsText] = useState('');
  const [specializationsText, setSpecializationsText] = useState('');
  const [experience, setExperience] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState(false);

  useEffect(() => {
    if (visible && initialTeacher) {
      setName(initialTeacher.name || '');
      setTeacherId(initialTeacher.teacher_id || '');
      setUserUid(initialTeacher.user_uid || initialTeacher.id || '');
      setEmail(initialTeacher.email || '');
      setPhone(initialTeacher.phone || '');
      setTitle(initialTeacher.title || 'Faculty Member');
      setStatus((initialTeacher.status as any) || 'approved');
      setVerificationStatus((initialTeacher.verification_status as any) || 'approved');
      setIslamicQualification(initialTeacher.islamic_qualification || '');
      setExperience(initialTeacher.experience_years ? String(initialTeacher.experience_years) : '');
      setBio(initialTeacher.bio || '');
      setPhotoUrl(initialTeacher.photo_url || '');

      const quals = Array.isArray(initialTeacher.qualifications)
        ? initialTeacher.qualifications.join(', ')
        : initialTeacher.qualifications || '';
      setQualificationsText(quals);

      const specs = Array.isArray(initialTeacher.specializations)
        ? initialTeacher.specializations.join(', ')
        : initialTeacher.specializations || '';
      setSpecializationsText(specs);

      const langs = Array.isArray(initialTeacher.languages)
        ? initialTeacher.languages.join(', ')
        : initialTeacher.languages || '';
      setLanguagesText(langs);

      // Auto-assign next Teacher ID if completely empty
      if (!initialTeacher.teacher_id) {
        handleAutoGenerateId();
      }
    }
  }, [visible, initialTeacher]);

  const handleAutoGenerateId = async () => {
    setGeneratingId(true);
    try {
      const nextId = await allocateNextTeacherId();
      setTeacherId(nextId);
    } catch {
      // Counter failed — show an error, do not silently set a potentially duplicate ID
      Alert.alert('ID Generation Failed', 'Could not allocate a Teacher ID. Please try again or enter one manually.');
    } finally {
      setGeneratingId(false);
    }
  };

  /**
   * Explicitly verifies the teacher's professional credentials.
   * Records verified_by and verified_at on the teachers/{uid} document.
   * This is the ONLY path that sets verification_status = 'verified'.
   */
  const handleVerifyCredentials = async () => {
    if (!userUid) {
      Alert.alert('Error', 'Cannot verify credentials — teacher UID is unknown.');
      return;
    }
    Alert.alert(
      'Verify Credentials',
      `You are about to mark the professional credentials of "${name || 'this teacher'}" as VERIFIED.\n\nThis confirms that you have personally reviewed their qualifications, Islamic certificates, and identity documents.\n\nThis action is recorded with your identity and timestamp.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm — Verify',
          style: 'default',
          onPress: async () => {
            setSaving(true);
            try {
              const { doc, updateDoc, serverTimestamp: sTs } = await import('firebase/firestore');
              const { db: firestoreDb } = await import('@/lib/firebase');
              await updateDoc(doc(firestoreDb, 'teachers', userUid), {
                verification_status: 'verified',
                verified_by: adminProfile?.email || adminProfile?.name || adminProfile?.uid || 'admin',
                verified_at: sTs(),
                updated_at: sTs(),
              });
              setVerificationStatus('verified');
              Alert.alert('Credentials Verified ✓', `${name || 'Teacher'}'s credentials have been marked as verified.`);
              onTeacherSaved?.();
            } catch (err: any) {
              Alert.alert('Verification Failed', err?.message || 'Could not update verification status.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  /**
   * Revokes a previously verified credential status back to pending.
   * Requires a deliberate Admin action.
   */
  const handleRevokeVerification = async () => {
    if (!userUid) return;
    Alert.alert(
      'Revoke Credential Verification',
      `This will set "${name || 'this teacher'}"'s credential verification back to PENDING.\n\nThey will no longer show as Verified Faculty.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { doc, updateDoc, serverTimestamp: sTs, deleteField } = await import('firebase/firestore');
              const { db: firestoreDb } = await import('@/lib/firebase');
              await updateDoc(doc(firestoreDb, 'teachers', userUid), {
                verification_status: 'pending',
                verified_by: deleteField(),
                verified_at: deleteField(),
                updated_at: sTs(),
              });
              setVerificationStatus('pending');
              Alert.alert('Verification Revoked', `${name || 'Teacher'}'s credentials are now marked as pending.`);
              onTeacherSaved?.();
            } catch (err: any) {
              Alert.alert('Revoke Failed', err?.message || 'Could not revoke verification.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter faculty name.');
      return;
    }
    if (!userUid.trim()) {
      Alert.alert('Required', 'Teacher User UID is required for canonical single-identity linking.');
      return;
    }
    if (!isValidTeacherId(teacherId)) {
      Alert.alert('Invalid ID', 'Teacher ID must follow the institutional format (e.g. TCH-0001).');
      return;
    }

    setSaving(true);
    try {
      const canonicalTeacher: TeacherProfile = {
        id: userUid.trim(),
        user_uid: userUid.trim(),
        teacher_id: teacherId.trim(),
        name: name.trim(),
        title: title.trim() || 'Faculty Member',
        email: email.trim(),
        phone: phone.trim(),
        status,
        verification_status: verificationStatus,
        islamic_qualification: islamicQualification.trim(),
        qualifications: qualificationsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        specializations: specializationsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        experience_years: experience.trim(),
        languages: languagesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        bio: bio.trim(),
        photo_url: photoUrl.trim(),
        organization_id: initialTeacher?.organization_id || 'mslb-main',
        assigned_courses: Array.isArray(initialTeacher?.assigned_courses)
          ? initialTeacher.assigned_courses
          : [],
        courses: Array.isArray(initialTeacher?.courses) ? initialTeacher.courses : [],
      };

      await saveTeacherProfileAsAdmin(canonicalTeacher, adminProfile);
      Alert.alert('Success ✓', `Faculty profile for "${name.trim()}" (${teacherId}) saved.`);
      onTeacherSaved?.();
      onClose();
    } catch (err: any) {
      console.error('[AdminTeacherProfileModal] Save error:', err);
      Alert.alert('Save Failed', err?.message || 'Failed to update teacher profile.');
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = initialTeacher?.assigned_courses?.length || 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Faculty Editor</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveTopBtn, saving && { opacity: 0.6 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveTopBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* SECTION 1: IDENTITY & SYSTEM LINKING */}
          <Text style={styles.sectionHeading}>1. IDENTITY & CREDENTIAL LINKING</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ustaadha Fatima"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1.5, marginRight: 8 }]}>
              <Text style={styles.label}>Official Teacher ID *</Text>
              <TextInput
                style={styles.input}
                value={teacherId}
                onChangeText={setTeacherId}
                placeholder="TCH-0001"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={styles.genIdBtn}
              onPress={handleAutoGenerateId}
              disabled={generatingId}
            >
              {generatingId ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={14} color={COLORS.primary} />
                  <Text style={styles.genIdBtnText}>Next ID</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Firebase Auth UID (Primary Identity Link) *</Text>
            <TextInput
              style={[styles.input, styles.monoInput]}
              value={userUid}
              onChangeText={setUserUid}
              placeholder="Firebase User UID"
              placeholderTextColor={COLORS.textMuted}
              editable={!initialTeacher?.user_uid}
            />
            <Text style={styles.fieldHint}>
              Immutable identity anchor: links users/{`{uid}`} directly to teachers/{`{uid}`}.
            </Text>
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="teacher@mslb.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91..."
                placeholderTextColor={COLORS.textMuted}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* ── SECTION: ACCOUNT STATUS vs CREDENTIAL VERIFICATION ─────────── */}
          {/* These are two distinct concepts and must never be conflated.       */}

          {/* Account Status — controls access to the platform */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>ACCOUNT STATUS</Text>
            <Text style={styles.fieldHint}>
              Controls whether this teacher can log in and access the platform.
            </Text>
            <View style={styles.pillSelectorRow}>
              {(['approved', 'active', 'pending', 'deactivated'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusPill, status === s && styles.statusPillActive]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusPillText, status === s && styles.statusPillTextActive]}>
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Credential Verification — controls the VERIFIED FACULTY badge */}
          <View style={[styles.formGroup, styles.credentialVerificationCard]}>
            <View style={styles.credVerifyHeader}>
              <Ionicons
                name={verificationStatus === 'verified' ? 'shield-checkmark' : 'time-outline'}
                size={16}
                color={verificationStatus === 'verified' ? '#059669' : '#92400E'}
              />
              <Text style={styles.label}>CREDENTIAL VERIFICATION</Text>
            </View>
            <Text style={styles.fieldHint}>
              Separate from account approval. Only set VERIFIED after personally reviewing
              qualifications, Sanad, and identity documents.
            </Text>

            {/* Current status badge */}
            <View style={[
              styles.credStatusBadge,
              verificationStatus === 'verified' ? styles.credStatusVerified
                : verificationStatus === 'pending' ? styles.credStatusPending
                : styles.credStatusLegacy,
            ]}>
              <Text style={styles.credStatusBadgeText}>
                {verificationStatus === 'verified'
                  ? '✓ CREDENTIALS VERIFIED'
                  : verificationStatus === 'pending'
                  ? '⏳ PENDING REVIEW'
                  : '⚠ LEGACY — SET STATUS'}
              </Text>
            </View>

            {/* Explicit action buttons — the ONLY way to set verified */}
            <View style={styles.credActionRow}>
              {verificationStatus !== 'verified' ? (
                <TouchableOpacity
                  style={[styles.credVerifyBtn, saving && { opacity: 0.6 }]}
                  onPress={handleVerifyCredentials}
                  disabled={saving}
                >
                  <Ionicons name="shield-checkmark" size={14} color="#FFFFFF" />
                  <Text style={styles.credVerifyBtnText}>Verify Credentials</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.credRevokeBtn, saving && { opacity: 0.6 }]}
                  onPress={handleRevokeVerification}
                  disabled={saving}
                >
                  <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                  <Text style={styles.credRevokeBtnText}>Revoke Verification</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* SECTION 2: PROFESSIONAL & ISLAMIC CREDENTIALS */}
          <Text style={[styles.sectionHeading, { marginTop: SPACING.md }]}>
            2. PROFESSIONAL & ISLAMIC CREDENTIALS
          </Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Academic Title / Designation</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Senior Tajweed Specialist & Alima"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <View style={styles.labelWithIcon}>
              <Ionicons name="ribbon" size={15} color="#D97706" />
              <Text style={[styles.label, { marginBottom: 0, marginLeft: 6 }]}>
                Islamic Qualification & Sanad
              </Text>
            </View>
            <TextInput
              style={styles.input}
              value={islamicQualification}
              onChangeText={setIslamicQualification}
              placeholder="e.g. Alimiyyah (Dars-e-Nizami), Sanad Hafs an Asim"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Degrees & Certifications (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={qualificationsText}
              onChangeText={setQualificationsText}
              placeholder="e.g. M.A. Islamic Studies, Alimiyyah"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Specializations (comma-separated)</Text>
            <TextInput
              style={styles.input}
              value={specializationsText}
              onChangeText={setSpecializationsText}
              placeholder="e.g. Tajweed, Fiqh, Hadith Sciences"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Experience</Text>
              <TextInput
                style={styles.input}
                value={experience}
                onChangeText={setExperience}
                placeholder="e.g. 7+ Years"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1.5, marginLeft: 8 }]}>
              <Text style={styles.label}>Languages (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={languagesText}
                onChangeText={setLanguagesText}
                placeholder="e.g. Urdu, English, Arabic"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Faculty Biography</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Institutional biography and teaching guidance..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Photo URL</Text>
            <TextInput
              style={styles.input}
              value={photoUrl}
              onChangeText={setPhotoUrl}
              placeholder="https://..."
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          {/* SECTION 3: ACADEMIC ASSIGNMENTS */}
          <Text style={[styles.sectionHeading, { marginTop: SPACING.md }]}>3. ACADEMIC SYLLABUS ALLOCATIONS</Text>

          <View style={styles.academicCard}>
            <View style={styles.academicRow}>
              <Ionicons name="library" size={20} color={COLORS.primary} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.academicTitle}>Assigned Courses ({assignedCount})</Text>
                <Text style={styles.academicSubtitle}>
                  {assignedCount > 0
                    ? `Allocated to ${assignedCount} course curriculum syllabus(es).`
                    : 'No course syllabus allocations configured yet.'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.manageAcademicsLinkBtn}
              onPress={() => {
                onClose();
                router.push('/admin/manage-academics' as any);
              }}
            >
              <Text style={styles.manageAcademicsLinkBtnText}>Configure Course Syllabus & Subjects →</Text>
            </TouchableOpacity>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={styles.bottomSaveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.bottomSaveBtnText}>Save Full Faculty Profile</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 18,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  saveTopBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
  },
  saveTopBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 48,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 6,
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
  },
  monoInput: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#475569',
  },
  genIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  genIdBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  textArea: {
    minHeight: 80,
  },
  pillSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  academicCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.lg,
  },
  academicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  academicTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  academicSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  manageAcademicsLinkBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  manageAcademicsLinkBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bottomSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  bottomSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // ── Credential Verification Card ────────────────────────────────────────────
  credentialVerificationCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: SPACING.md,
  },
  credVerifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  credStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    marginTop: 8,
    marginBottom: 12,
  },
  credStatusVerified: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  credStatusPending: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  credStatusLegacy: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  credStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
    letterSpacing: 0.3,
  },
  credActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  credVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  credVerifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  credRevokeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  credRevokeBtnText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
});
