import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useActiveOrganization, DEFAULT_ORGANIZATION_ID } from '@/lib/tenantContext';
import { CustomerSupportModal } from '@/components/CustomerSupportModal';

export default function OrganizationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const { activeOrgId, activeOrg, loading: orgLoading } = useActiveOrganization();

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('India');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [primaryColor, setPrimaryColor] = useState('#005F46');
  const [secondaryColor, setSecondaryColor] = useState('#C8A84E');

  const [saving, setSaving] = useState(false);
  const [supportModalVisible, setSupportModalVisible] = useState(false);

  useEffect(() => {
    if (activeOrg) {
      setName(activeOrg.name || '');
      setTagline(activeOrg.tagline || '');
      setLogoUrl(activeOrg.logo_url || '');
      setPhone(activeOrg.phone || '');
      setEmail(activeOrg.email || '');
      setAddress(activeOrg.address || '');
      setCity(activeOrg.city || '');
      setStateName(activeOrg.state || '');
      setCountry(activeOrg.country || 'India');
      setTimezone(activeOrg.timezone || 'Asia/Kolkata');
      setPrimaryColor(activeOrg.primary_color || '#005F46');
      setSecondaryColor(activeOrg.secondary_color || '#C8A84E');
    }
  }, [activeOrg]);

  const handleSaveSettings = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Madrasa name cannot be empty.');
      return;
    }

    const orgData = {
      name: name.trim(),
      tagline: tagline.trim(),
      logo_url: logoUrl.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      city: city.trim(),
      state: stateName.trim(),
      country: country.trim(),
      timezone: timezone.trim(),
      primary_color: primaryColor.trim(),
      secondary_color: secondaryColor.trim(),
      updated_at: serverTimestamp(),
    };

    try {
      setSaving(true);
      const targetOrgId = activeOrgId || DEFAULT_ORGANIZATION_ID;
      try {
        const updateCall = httpsCallable(functions, 'updateOrganizationSettings');
        await updateCall({
          organization_id: targetOrgId,
          ...orgData,
        });
      } catch (fnErr) {
        console.warn('[OrganizationSettings] Cloud Function failed, updating Firestore directly:', fnErr);
        await setDoc(doc(db, 'organizations', targetOrgId), orgData, { merge: true });
      }

      Alert.alert('Settings Saved', 'Your madrasa settings have been updated.');
    } catch (err: any) {
      console.error('[OrganizationSettings] Save failed:', err);
      Alert.alert('Save Failed', err?.message || 'Could not update settings. Please check your network.');
    } finally {
      setSaving(false);
    }
  };

  const isSuspended = activeOrg?.status === 'suspended';
  const isTrial = activeOrg?.status === 'trial';
  const paymentStatus = activeOrg?.payment_status || (activeOrg?.status === 'active' ? 'received' : 'pending');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Madrasa Profile & Settings</Text>
        <TouchableOpacity style={styles.supportHeaderBtn} onPress={() => setSupportModalVisible(true)}>
          <Ionicons name="headset-outline" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusOrgName}>{activeOrg?.name || 'Madrasa Workspace'}</Text>
              <Text style={styles.statusOrgSlug}>ID: {activeOrgId || DEFAULT_ORGANIZATION_ID}</Text>
            </View>
            <View style={[
              styles.statusChip,
              isSuspended ? styles.statusSuspended : isTrial ? styles.statusTrial : styles.statusActive
            ]}>
              <Text style={styles.statusChipText}>
                {(activeOrg?.status || 'ACTIVE').toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.quotasGrid}>
            <View style={styles.quotaItem}>
              <Text style={styles.quotaLabel}>Plan</Text>
              <Text style={styles.quotaValue}>{(activeOrg?.plan_id || 'Starter').toUpperCase()}</Text>
            </View>
            <View style={styles.quotaItem}>
              <Text style={styles.quotaLabel}>Student Capacity</Text>
              <Text style={styles.quotaValue}>{activeOrg?.student_limit || 200} Max</Text>
            </View>
            <View style={styles.quotaItem}>
              <Text style={styles.quotaLabel}>Payment Status</Text>
              <Text style={[styles.quotaValue, { color: paymentStatus === 'received' ? '#059669' : '#D97706' }]}>
                {paymentStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          {paymentStatus === 'pending' && (
            <View style={styles.paymentNoticeBox}>
              <Ionicons name="information-circle-outline" size={18} color="#B45309" />
              <Text style={styles.paymentNoticeText}>
                Your madrasa is in trial mode. Upon payment confirmation, your account will be activated with full student capacity.
              </Text>
            </View>
          )}
        </View>

        {/* Form Fields */}
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Institutional Identity</Text>

          <Text style={styles.fieldLabel}>Madrasa Name *</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            placeholder="Official Name of Madrasa"
          />

          <Text style={styles.fieldLabel}>Motto / Tagline</Text>
          <TextInput
            style={styles.textInput}
            value={tagline}
            onChangeText={setTagline}
            placeholder="e.g. Nurturing Ilm, Haya & Tarbiyah"
          />

          <Text style={styles.fieldLabel}>Logo URL (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={logoUrl}
            onChangeText={setLogoUrl}
            placeholder="https://..."
            autoCapitalize="none"
          />

          <Text style={styles.sectionTitle}>Official Contact & Location</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+91-..."
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.textInput}
                value={email}
                onChangeText={setEmail}
                placeholder="admin@madrasa.edu"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <Text style={styles.fieldLabel}>Physical Address</Text>
          <TextInput
            style={styles.textInput}
            value={address}
            onChangeText={setAddress}
            placeholder="Street address / campus location"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>City</Text>
              <TextInput
                style={styles.textInput}
                value={city}
                onChangeText={setCity}
                placeholder="City"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>State</Text>
              <TextInput
                style={styles.textInput}
                value={stateName}
                onChangeText={setStateName}
                placeholder="State"
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Branding Accents</Text>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.fieldLabel}>Primary Color</Text>
              <TextInput
                style={styles.textInput}
                value={primaryColor}
                onChangeText={setPrimaryColor}
                placeholder="#005F46"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Secondary Accent</Text>
              <TextInput
                style={styles.textInput}
                value={secondaryColor}
                onChangeText={setSecondaryColor}
                placeholder="#C8A84E"
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={styles.saveBtnInner}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Customer Support CTA */}
        <TouchableOpacity
          style={styles.supportBanner}
          onPress={() => setSupportModalVisible(true)}
        >
          <Ionicons name="help-buoy-outline" size={24} color={COLORS.primary} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.supportBannerTitle}>Need Assistance?</Text>
            <Text style={styles.supportBannerSubtitle}>Contact MSLB Onboarding Team on WhatsApp</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
      </ScrollView>

      <CustomerSupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  supportHeaderBtn: {
    padding: 6,
  },
  body: {
    padding: SPACING.lg,
    paddingBottom: 40,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusOrgName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  statusOrgSlug: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusTrial: {
    backgroundColor: '#FEF3C7',
  },
  statusSuspended: {
    backgroundColor: '#FEE2E2',
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  quotasGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    justifyContent: 'space-around',
  },
  quotaItem: {
    alignItems: 'center',
  },
  quotaLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  quotaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  paymentNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    gap: 8,
  },
  paymentNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
  },
  row: {
    flexDirection: 'row',
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.xl,
    ...SHADOWS.card,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  supportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  supportBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  supportBannerSubtitle: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
