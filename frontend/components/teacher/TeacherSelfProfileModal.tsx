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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { saveTeacherProfileAsSelf, type TeacherProfile, type TeacherSelfUpdatePayload } from '@/lib/teacherIdentity';
import { Teacher } from '@/context/DataContext';

interface TeacherSelfProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userUid: string;
  currentTeacher: Teacher | null | undefined;
  onProfileUpdated?: () => void;
}

export function TeacherSelfProfileModal({
  visible,
  onClose,
  userUid,
  currentTeacher,
  onProfileUpdated,
}: TeacherSelfProfileModalProps) {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [bio, setBio] = useState('');
  const [islamicQualification, setIslamicQualification] = useState('');
  const [qualificationsText, setQualificationsText] = useState('');
  const [specializationsText, setSpecializationsText] = useState('');
  const [experience, setExperience] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (visible && currentTeacher) {
      setName(currentTeacher.name || '');
      setTitle(currentTeacher.title || '');
      setBio(currentTeacher.bio || '');
      setIslamicQualification(currentTeacher.islamic_qualification || '');
      setExperience(currentTeacher.experience_years ? String(currentTeacher.experience_years) : '');
      setPhotoUrl(currentTeacher.photo_url || '');

      const quals = Array.isArray(currentTeacher.qualifications)
        ? currentTeacher.qualifications.join(', ')
        : currentTeacher.qualifications || '';
      setQualificationsText(quals);

      const specs = Array.isArray(currentTeacher.specializations)
        ? currentTeacher.specializations.join(', ')
        : currentTeacher.specializations || '';
      setSpecializationsText(specs);

      const langs = Array.isArray(currentTeacher.languages)
        ? currentTeacher.languages.join(', ')
        : currentTeacher.languages || '';
      setLanguagesText(langs);
    }
  }, [visible, currentTeacher]);

  /**
   * Opens the device gallery, uploads the selected photo to Firebase Storage
   * at users/{uid}/profile/teacher_photo.jpg, and updates the local photoUrl state.
   *
   * Storage path follows the existing profile image convention.
   * Does NOT upload to any arbitrary path.
   */
  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select a profile photo.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      setUploadingPhoto(true);

      // Dynamically import Firebase Storage to avoid circular deps
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage: firebaseStorage } = await import('@/lib/firebase');

      // Fetch the image as a blob
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Upload to users/{uid}/profile/teacher_photo.jpg (matches existing storage rules)
      const storagePath = `users/${userUid}/profile/teacher_photo.jpg`;
      const storageRef = ref(firebaseStorage, storagePath);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });

      const downloadUrl = await getDownloadURL(storageRef);
      setPhotoUrl(downloadUrl);
    } catch (err: any) {
      console.error('[handlePickPhoto] Upload failed:', err);
      Alert.alert('Upload Failed', err?.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };


  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your faculty name.');
      return;
    }

    setSaving(true);
    try {
      const updates: TeacherSelfUpdatePayload = {
        name: name.trim(),
        title: title.trim() || 'Faculty Member',
        bio: bio.trim(),
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
        photo_url: photoUrl.trim(),
      };

      await saveTeacherProfileAsSelf(userUid, updates);
      Alert.alert('Profile Saved ✓', 'Your faculty profile details have been updated.');
      onProfileUpdated?.();
      onClose();
    } catch (err: any) {
      console.error('[TeacherSelfProfileModal] Save error:', err);
      Alert.alert('Update Failed', err?.message || 'Could not update faculty profile.');
    } finally {
      setSaving(false);
    }
  };

  const officialId = currentTeacher?.teacher_id || 'TCH-0001';

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
          <Text style={styles.headerTitle}>Faculty Profile</Text>
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
          {/* Institutional Locked Identity Card */}
          <View style={styles.lockedIdentityCard}>
            <View style={styles.lockedRow}>
              <View style={styles.idBadge}>
                <Ionicons name="id-card" size={14} color="#FFFFFF" />
                <Text style={styles.idBadgeText}>OFFICIAL ID: {officialId}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <Text style={styles.verifiedText}>Approved Faculty</Text>
              </View>
            </View>
            <Text style={styles.lockedNote}>
              Official institutional credentials and course syllabus allocations are administered centrally.
            </Text>
          </View>

          {/* Personal & Academic Title */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Faculty Display Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ustaadha Fatima"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Academic Title / Designation</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Senior Tajweed Faculty & Alima"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Islamic Qualification / Sanad */}
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
            <Text style={styles.fieldHint}>Your certified Islamic scholarly degrees and classical Ijazahs.</Text>
          </View>

          {/* General Qualifications */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Academic Degrees & Certifications (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={qualificationsText}
              onChangeText={setQualificationsText}
              placeholder="e.g. M.A. Islamic Studies, B.A. Arabic"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Specializations */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Areas of Specialization (comma separated)</Text>
            <TextInput
              style={styles.input}
              value={specializationsText}
              onChangeText={setSpecializationsText}
              placeholder="e.g. Tajweed, Hanafi Fiqh, Hadith Sciences"
              placeholderTextColor={COLORS.textMuted}
            />
          </View>

          {/* Experience & Languages Row */}
          <View style={styles.row}>
            <View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Experience</Text>
              <TextInput
                style={styles.input}
                value={experience}
                onChangeText={setExperience}
                placeholder="e.g. 5+ Years"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>

            <View style={[styles.formGroup, { flex: 1.5, marginLeft: 8 }]}>
              <Text style={styles.label}>Languages (comma separated)</Text>
              <TextInput
                style={styles.input}
                value={languagesText}
                onChangeText={setLanguagesText}
                placeholder="e.g. Urdu, English, Arabic"
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          </View>

          {/* Biography */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Faculty Biography & Teaching Philosophy</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Share your teaching approach, background, and guidance philosophy for students..."
              placeholderTextColor={COLORS.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Profile Photo Picker */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Profile Photo</Text>
            {/* Live preview */}
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.photoPreview}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person-circle-outline" size={64} color={COLORS.textMuted} />
              </View>
            )}
            <TouchableOpacity
              style={[styles.photoPickerBtn, uploadingPhoto && styles.photoPickerBtnDisabled]}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera-outline" size={18} color="#fff" />
              )}
              <Text style={styles.photoPickerBtnText}>
                {uploadingPhoto ? 'Uploading…' : photoUrl ? 'Change Photo' : 'Select Photo'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Academic Scoping Information */}
          <View style={styles.academicInfoBox}>
            <View style={styles.academicInfoHeader}>
              <Ionicons name="school-outline" size={18} color={COLORS.primary} />
              <Text style={styles.academicInfoTitle}>Assigned Academic Courses</Text>
            </View>
            <Text style={styles.academicInfoDesc}>
              {currentTeacher?.assigned_courses && currentTeacher.assigned_courses.length > 0
                ? `Currently assigned to ${currentTeacher.assigned_courses.length} course curriculum syllabus(es).`
                : 'No course syllabus allocations configured yet.'}
            </Text>
            <Text style={styles.academicInfoNote}>
              Course and subject assignments are governed by institutional administration.
            </Text>
          </View>

          {/* Bottom Save Button */}
          <TouchableOpacity
            style={styles.bottomSaveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.bottomSaveBtnText}>Save Faculty Profile</Text>
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
  lockedIdentityCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: SPACING.lg,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  idBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '700',
  },
  lockedNote: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 17,
  },
  formGroup: {
    marginBottom: SPACING.md,
  },
  row: {
    flexDirection: 'row',
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
  textArea: {
    minHeight: 90,
  },
  academicInfoBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  academicInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  academicInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  academicInfoDesc: {
    fontSize: 12,
    color: COLORS.textMain,
    marginBottom: 4,
  },
  academicInfoNote: {
    fontSize: 11,
    color: COLORS.textMuted,
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
  photoPreview: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 10,
    alignSelf: 'center',
  },
  photoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 10,
  },
  photoPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'center',
    gap: 6,
  },
  photoPickerBtnDisabled: {
    opacity: 0.6,
  },
  photoPickerBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
