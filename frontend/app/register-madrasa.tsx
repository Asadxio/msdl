import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { setActiveOrganizationId } from '@/lib/tenantContext';
import { COLORS } from '@/constants/theme';

export default function RegisterMadrasaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshProfile } = useAuth();

  // Institution Form Fields
  const [madrasaName, setMadrasaName] = useState('');
  const [nameArabic, setNameArabic] = useState('');
  const [madrasaCode, setMadrasaCode] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('India');
  const [tagline, setTagline] = useState('');
  const [starterCourse, setStarterCourse] = useState('Tajweed & Islamic Essentials');
  const [upiId, setUpiId] = useState('');

  // Principal / Mudir Account Fields (if not already logged in)
  const [principalName, setPrincipalName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const autoGenerateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 24);
  };

  const handleMadrasaNameChange = (text: string) => {
    setMadrasaName(text);
    if (!madrasaCode || madrasaCode === autoGenerateSlug(madrasaName)) {
      setMadrasaCode(autoGenerateSlug(text));
    }
  };

  const handleSubmit = useCallback(async () => {
    setErrorMsg(null);

    // Validation
    const cleanName = madrasaName.trim();
    if (!cleanName || cleanName.length < 3) {
      setErrorMsg('Please enter a valid Madrasa Name (at least 3 characters).');
      return;
    }

    const cleanSlug = (madrasaCode.trim() || autoGenerateSlug(cleanName)).toLowerCase();
    if (!cleanSlug || cleanSlug.length < 2) {
      setErrorMsg('Please enter a valid short code or identifier for the madrasa.');
      return;
    }

    if (!city.trim()) {
      setErrorMsg('Please specify the City where your Madrasa is located.');
      return;
    }

    let activeUid = user?.uid;

    setSubmitting(true);
    try {
      // If user is not signed in, create their Mudir/Admin account first
      if (!activeUid) {
        const cleanEmail = email.trim().toLowerCase();
        const cleanPass = password.trim();

        if (!principalName.trim()) {
          setErrorMsg('Please enter the Principal / Mudir full name.');
          setSubmitting(false);
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          setErrorMsg('Please enter a valid official email address.');
          setSubmitting(false);
          return;
        }

        if (cleanPass.length < 6) {
          setErrorMsg('Password must be at least 6 characters long.');
          setSubmitting(false);
          return;
        }

        if (cleanPass !== confirmPassword.trim()) {
          setErrorMsg('Passwords do not match. Please re-enter.');
          setSubmitting(false);
          return;
        }

        // Create Firebase Auth user
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        activeUid = cred.user.uid;
      }

      // Call Cloud Function to provision the Organization, owner user profile, and owner membership securely via Admin SDK
      const createOrgCall = httpsCallable(functions, 'createOrganization');
      await createOrgCall({
        id: cleanSlug,
        slug: cleanSlug,
        name: cleanName,
        name_arabic: nameArabic.trim(),
        city: city.trim(),
        state: stateName.trim(),
        country: country.trim() || 'India',
        tagline: tagline.trim(),
        starter_course_name: starterCourse.trim(),
        principal_name: principalName.trim(),
        phone: phone.trim(),
        upi_id: upiId.trim(),
        upi_name: cleanName,
      });

      // Update tenant context to new Madrasa
      await setActiveOrganizationId(cleanSlug);
      if (refreshProfile) {
        await refreshProfile().catch(() => {});
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      Alert.alert(
        'Mubarak! Madrasa Registered',
        `Your madrasa "${cleanName}" has been successfully set up on Suffah with code "${cleanSlug}". Welcome to your digital campus!`,
        [
          {
            text: 'Enter Campus (داخل ہوں)',
            onPress: () => {
              router.replace('/(tabs)');
            },
          },
        ]
      );
    } catch (err: any) {
      console.error('[RegisterMadrasa] Submission failed:', err);
      setErrorMsg(err?.message || 'Failed to register Madrasa. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }, [
    madrasaName,
    madrasaCode,
    city,
    stateName,
    country,
    tagline,
    starterCourse,
    principalName,
    email,
    phone,
    password,
    confirmPassword,
    user?.uid,
    refreshProfile,
    router,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      {/* Header Banner */}
      <LinearGradient
        colors={['#064E3B', '#005F46']}
        style={[styles.headerGradient, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go Back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.brandArabic}>صُـفَّـة • تسجيل مدرسة جديدة</Text>
            <Text style={styles.brandTitle}>REGISTER A NEW MADRASA</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <Text style={styles.headerSubtitle}>
          Bring your institution online with dedicated classes, teachers, student management & purdah-compliant audio
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={[styles.formContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={18} color={COLORS.error} />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Section 1: Institution Details */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="business" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
            <Text style={styles.sectionTitle}>Madrasa / Campus Details</Text>
          </View>

          <Text style={styles.inputLabel}>Madrasa Name (نامِ مدرسہ) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Jamia Fatima Lil Banat"
            placeholderTextColor={COLORS.textSecondary}
            value={madrasaName}
            onChangeText={handleMadrasaNameChange}
          />

          <Text style={styles.inputLabel}>Arabic Calligraphy Title (نامِ مدرسہ عربی میں - اختیاری)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. جامعة فاطمة للبنات"
            placeholderTextColor={COLORS.textSecondary}
            value={nameArabic}
            onChangeText={setNameArabic}
          />

          <Text style={styles.inputLabel}>Campus Code / Slug (مدرسہ کوڈ) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. jamia-fatima"
            placeholderTextColor={COLORS.textSecondary}
            value={madrasaCode}
            onChangeText={setMadrasaCode}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Unique code used by your students to identify your campus.
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.inputLabel}>City (شہر) *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Hyderabad, London, Cairo"
                placeholderTextColor={COLORS.textSecondary}
                value={city}
                onChangeText={setCity}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.inputLabel}>State / Province (صوبہ)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Telangana, England"
                placeholderTextColor={COLORS.textSecondary}
                value={stateName}
                onChangeText={setStateName}
              />
            </View>
          </View>

          <Text style={styles.inputLabel}>Country (ملک) *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. India, United Kingdom, UAE, USA, Pakistan"
            placeholderTextColor={COLORS.textSecondary}
            value={country}
            onChangeText={setCountry}
          />

          <Text style={styles.inputLabel}>Motto / Tagline (شعائر / تعارف)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Dedicated to Women's Islamic Education"
            placeholderTextColor={COLORS.textSecondary}
            value={tagline}
            onChangeText={setTagline}
          />

          <Text style={styles.inputLabel}>First Starter Course (ابتدائی کورس)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Tajweed & Quran Recitation"
            placeholderTextColor={COLORS.textSecondary}
            value={starterCourse}
            onChangeText={setStarterCourse}
          />

          <Text style={styles.inputLabel}>Institutional UPI ID for Fee Collection (یو پی آئی آئی ڈی)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. yourmadrasa@icici or 9876543210@upi"
            placeholderTextColor={COLORS.textSecondary}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            Direct student fee payments will be sent directly to this institutional UPI ID.
          </Text>
        </View>

        {/* Section 2: Mudir / Admin Account */}
        {!user ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="person-circle" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Principal / Mudir Account</Text>
            </View>
            <Text style={styles.helperText}>
              This will be your master login to manage your faculty, students & classes.
            </Text>

            <Text style={styles.inputLabel}>Full Name (پورا نام) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Maulana / Ustaadha Name"
              placeholderTextColor={COLORS.textSecondary}
              value={principalName}
              onChangeText={setPrincipalName}
            />

            <Text style={styles.inputLabel}>Official Email (ای میل پتہ) *</Text>
            <TextInput
              style={styles.input}
              placeholder="principal@yourmadrasa.org"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Phone / WhatsApp Number (فون نمبر)</Text>
            <TextInput
              style={styles.input}
              placeholder="+91 / +44 / +1 ..."
              placeholderTextColor={COLORS.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Create Password (پاس ورڈ) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Minimum 6 characters"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <Text style={styles.inputLabel}>Confirm Password (تصدیق پاس ورڈ) *</Text>
            <TextInput
              style={styles.input}
              placeholder="Re-enter password"
              placeholderTextColor={COLORS.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>
        ) : (
          <View style={styles.loggedInBadgeCard}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} style={{ marginRight: 8 }} />
            <Text style={styles.loggedInBadgeText}>
              You are signed in as institutional owner. This madrasa will be linked to your account.
            </Text>
          </View>
        )}

        {/* Submit CTA */}
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.88}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.submitBtnRow}>
              <Text style={styles.submitButtonText}>Register Campus & Launch (قیام فرمائیں)</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          By registering, your institution agrees to maintain Islamic modesty, student safety & academic excellence on Suffah.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F0',
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  brandArabic: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FDE68A',
    marginBottom: 2,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12.5,
    color: '#D1FAE5',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.error,
    marginLeft: 8,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.textMain,
  },
  helperText: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loggedInBadgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  loggedInBadgeText: {
    fontSize: 13,
    color: '#065F46',
    flex: 1,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 17,
    paddingHorizontal: 20,
  },
});
