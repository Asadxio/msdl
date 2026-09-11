import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { setActiveOrganizationId } from '@/lib/tenantContext';
import { parseCSVToStudentRows, validateStudentImportRows, type RawImportRow } from '@/lib/bulkStudentImport';

interface OrgCreateResponse {
  success: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  starter_course_id?: string;
}

export default function StartMadrasaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);

  // Step 1: Institution Details
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');

  // Step 2: Branding & Leadership
  const [logoUrl, setLogoUrl] = useState('');
  const [principalName, setPrincipalName] = useState(profile?.name || '');
  const [tagline, setTagline] = useState('Nurturing Ilm, Haya & Tarbiyah');

  // Step 3: Academic Structure
  const [starterCourseName, setStarterCourseName] = useState('Awwaleen / Class 1');

  // Step 4: Faculty Setup (Optional)
  const [headTeacherName, setHeadTeacherName] = useState('');
  const [headTeacherPhone, setHeadTeacherPhone] = useState('');

  // Step 5: Student Intake / CSV Import (Optional)
  const [rawStudentInput, setRawStudentInput] = useState('');
  const [parsedStudents, setParsedStudents] = useState<RawImportRow[]>([]);
  const [validationErrorSummary, setValidationErrorSummary] = useState<string>('');

  const totalSteps = 6;

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!name.trim()) {
        Alert.alert('Institution Name Required', 'Please enter the name of your madrasa.');
        return;
      }
      if (!slug.trim()) {
        const autoSlug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        setSlug(autoSlug);
      }
    }

    if (currentStep === 5 && rawStudentInput.trim()) {
      const rows = parseCSVToStudentRows(rawStudentInput);
      const report = validateStudentImportRows(rows);
      setParsedStudents(report.validRows);
      if (report.errors.length > 0) {
        setValidationErrorSummary(`${report.errors.length} rows had errors. ${report.validRows.length} valid students will be imported.`);
      } else {
        setValidationErrorSummary('');
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      router.back();
    }
  };

  const handleFinishOnboarding = async () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please provide your madrasa name.');
      return;
    }

    try {
      setLoading(true);

      const createOrgCall = httpsCallable<any, OrgCreateResponse>(functions, 'createOrganization');
      const orgResult = await createOrgCall({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        logo_url: logoUrl.trim() || undefined,
        starter_course_name: starterCourseName.trim() || undefined,
      });

      const newOrg = orgResult.data.organization;
      if (!newOrg?.id) {
        throw new Error('Failed to retrieve created institution ID.');
      }

      // Switch active tenant locally
      await setActiveOrganizationId(newOrg.id);

      // Import starter students if provided
      if (parsedStudents.length > 0) {
        try {
          const bulkCall = httpsCallable(functions, 'bulkImportStudents');
          await bulkCall({
            organization_id: newOrg.id,
            students: parsedStudents.map((s) => ({
              ...s,
              course_id: orgResult.data.starter_course_id || undefined,
            })),
          });
        } catch (studentErr) {
          console.warn('[StartMadrasa] Student bulk import warning:', studentErr);
        }
      }

      Alert.alert(
        'Mabrook! 🎉',
        `'${newOrg.name}' has been successfully established on the MSLB Platform. You are now the Head Administrator.`,
        [
          {
            text: 'Go to Admin Workspace',
            onPress: () => router.replace('/admin/manage-academics'),
          },
        ]
      );
    } catch (err: any) {
      console.error('[StartMadrasa] Error:', err);
      Alert.alert('Setup Failed', err?.message || 'Could not complete madrasa setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handlePrevStep}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start a Madrasa</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{currentStep}/{totalSteps}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Step 1: Identity */}
        {currentStep === 1 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="school-outline" size={28} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Madrasa Identity</Text>
            <Text style={styles.subtitle}>Enter the foundational details of your Islamic institution.</Text>

            <Text style={styles.label}>Institution Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Jamia Ayesha Lil Banat"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Institution Slug (Unique Subdomain / ID)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. jamia-ayesha"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={slug}
              onChangeText={setSlug}
            />

            <Text style={styles.label}>Official Contact Phone</Text>
            <TextInput
              style={styles.input}
              placeholder="+91-9876543210"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <Text style={styles.label}>Official Contact Email</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@jamiaayesha.edu"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Hyderabad"
                  placeholderTextColor="#9CA3AF"
                  value={city}
                  onChangeText={setCity}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>State</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Telangana"
                  placeholderTextColor="#9CA3AF"
                  value={stateName}
                  onChangeText={setStateName}
                />
              </View>
            </View>
          </View>
        )}

        {/* Step 2: Branding & Leadership */}
        {currentStep === 2 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="ribbon-outline" size={28} color={COLORS.secondary} />
            </View>
            <Text style={styles.title}>Branding & Leadership</Text>
            <Text style={styles.subtitle}>Customize how students and parents view your madrasa.</Text>

            <Text style={styles.label}>Principal / Mohtamim Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Maulana / Ustaadha ..."
              placeholderTextColor="#9CA3AF"
              value={principalName}
              onChangeText={setPrincipalName}
            />

            <Text style={styles.label}>Motto / Tagline</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Nurturing Ilm, Haya & Tarbiyah"
              placeholderTextColor="#9CA3AF"
              value={tagline}
              onChangeText={setTagline}
            />

            <Text style={styles.label}>Logo URL (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="https://..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={logoUrl}
              onChangeText={setLogoUrl}
            />
          </View>
        )}

        {/* Step 3: Initial Academic Structure */}
        {currentStep === 3 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="book-outline" size={28} color="#2563EB" />
            </View>
            <Text style={styles.title}>First Academic Class</Text>
            <Text style={styles.subtitle}>Create your starting class or syllabus stream.</Text>

            <Text style={styles.label}>Starter Class / Course Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Awwaleen / Class 1 / Qirat Essentials"
              placeholderTextColor="#9CA3AF"
              value={starterCourseName}
              onChangeText={setStarterCourseName}
            />

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>
                You can add more classes, assign subjects (Tajweed, Fiqh, Hadith), and customize modules anytime from Manage Academics.
              </Text>
            </View>
          </View>
        )}

        {/* Step 4: Faculty Setup */}
        {currentStep === 4 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="people-outline" size={28} color="#059669" />
            </View>
            <Text style={styles.title}>Faculty Setup</Text>
            <Text style={styles.subtitle}>Optionally assign your first head ustaadha or teacher.</Text>

            <Text style={styles.label}>Teacher Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ustaadha Fatma"
              placeholderTextColor="#9CA3AF"
              value={headTeacherName}
              onChangeText={setHeadTeacherName}
            />

            <Text style={styles.label}>Teacher Contact Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+91-..."
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={headTeacherPhone}
              onChangeText={setHeadTeacherPhone}
            />
          </View>
        )}

        {/* Step 5: Student Setup / Bulk Import */}
        {currentStep === 5 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="cloud-upload-outline" size={28} color="#7C3AED" />
            </View>
            <Text style={styles.title}>Student Roster Ingestion</Text>
            <Text style={styles.subtitle}>Paste student CSV data (Name, Email, Phone, Guardian) or skip.</Text>

            <Text style={styles.label}>CSV Data (Format: Name, Email, Phone)</Text>
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder={'Amina Khan, amina@example.com, +919876543210\nZainab Ali, zainab@example.com, +919876543211'}
              placeholderTextColor="#9CA3AF"
              multiline
              value={rawStudentInput}
              onChangeText={setRawStudentInput}
            />

            {validationErrorSummary ? (
              <Text style={styles.warningText}>{validationErrorSummary}</Text>
            ) : null}
          </View>
        )}

        {/* Step 6: Confirmation */}
        {currentStep === 6 && (
          <View style={styles.stepCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>Confirm & Launch</Text>
            <Text style={styles.subtitle}>Review your madrasa workspace settings before finalizing.</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Madrasa:</Text>
              <Text style={styles.summaryValue}>{name}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Slug / ID:</Text>
              <Text style={styles.summaryValue}>{slug || 'Auto-generated'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Admin Email:</Text>
              <Text style={styles.summaryValue}>{email}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Starting Class:</Text>
              <Text style={styles.summaryValue}>{starterCourseName || 'None'}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Students to Import:</Text>
              <Text style={styles.summaryValue}>{parsedStudents.length}</Text>
            </View>
          </View>
        )}

        {/* Controls */}
        <View style={styles.actionsRow}>
          {currentStep < totalSteps ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep}>
              <Text style={styles.primaryBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
              onPress={handleFinishOnboarding}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Launch Madrasa Workspace</Text>
                  <Ionicons name="sparkles" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  stepIndicator: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  stepText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#E5E7EB',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  body: {
    padding: SPACING.lg,
  },
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  },
  label: {
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
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textMain,
  },
  row: {
    flexDirection: 'row',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0FDF4',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.primary,
    marginLeft: 8,
    lineHeight: 18,
  },
  warningText: {
    fontSize: 13,
    color: '#D97706',
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F3F4F6',
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  actionsRow: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
});
