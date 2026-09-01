import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { VerifiedSanad, verifySanadById } from '@/lib/sanadVerification';
import { goBackOrReplace } from '@/lib/navigation';

export default function VerifySanadScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [searchId, setSearchId] = useState(id || '');
  const [sanad, setSanad] = useState<VerifiedSanad | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (id) {
      setSearchId(id);
      handleVerify(id);
    }
  }, [id]);

  const handleVerify = async (certIdToVerify?: string) => {
    const target = (certIdToVerify || searchId).trim();
    if (!target) return;

    setLoading(true);
    setSearched(true);
    try {
      const result = await verifySanadById(target);
      setSanad(result);
    } catch {
      setSanad(null);
    } finally {
      setLoading(false);
    }
  };

  const handleShareVerification = async () => {
    if (!sanad) return;
    const shareMsg =
      'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n\n' +
      '📜 *مدرسۃ السالکات للبنات — سند کی سرکاری تصدیق*\n\n' +
      '✅ یہ سند باقاعدہ تصدیق شدہ ہے:\n' +
      'طالبہ: ' + sanad.studentName + '\n' +
      'شعبہ / کورس: ' + sanad.courseName + '\n' +
      'درجہ: ' + (sanad.gradeLabel || 'کامیاب') + '\n' +
      'تاریخ: ' + sanad.completionDate + ' (' + (sanad.hijriDate || '') + ')\n' +
      'سند نمبر: ' + sanad.certificateId + '\n\n' +
      '🔗 لائیو تصدیقی لنک: https://mslb.app/verify-sanad?id=' + encodeURIComponent(sanad.certificateId);

    try {
      await Share.share({
        message: shareMsg,
        title: 'Sanad Verification - Madrasatu-s-Salikat',
      });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>تَصْدِيقُ الشَّهَادَاتِ وَالأَسْنَاد</Text>
          <Text style={styles.headerTitle}>Official Sanad Verification</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search Input Card */}
        <View style={styles.searchCard}>
          <Text style={styles.searchLabel}>سند نمبر درج فرمائیں (Enter Certificate Serial):</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="e.g. MSLB-SANAD-2026-..."
              placeholderTextColor="#94A3B8"
              value={searchId}
              onChangeText={setSearchId}
              autoCapitalize="characters"
              returnKeyType="search"
              onSubmitEditing={() => handleVerify()}
            />
            <TouchableOpacity
              style={[styles.verifyBtn, loading && { opacity: 0.6 }]}
              onPress={() => handleVerify()}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="search" size={16} color="#FFFFFF" />
                  <Text style={styles.verifyBtnText}>تصدیق کریں</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#C8A84E" />
            <Text style={styles.loadingText}>سند کا ریکارڈ چیک کیا جا رہا ہے...</Text>
          </View>
        ) : sanad ? (
          /* Verified Sanad Card */
          <View style={styles.verifiedCard}>
            {/* Islamic Header & Seal */}
            <View style={styles.bismillahBox}>
              <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
              <Text style={styles.madrasaTitle}>مدرسۃ السالکات للبنات</Text>
              <Text style={styles.madrasaEng}>Madrasatu-s-Salikat Lil Banat</Text>
            </View>

            {/* Verification Status Banner */}
            <View style={styles.statusBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#007A58" />
              <View style={{ flex: 1 }}>
                <Text style={styles.statusTitle}>سند باقاعدہ مصدقہ و اصلی ہے</Text>
                <Text style={styles.statusSub}>Officially Issued & Verified Sanad</Text>
              </View>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>فاضلہ / طالبہ کا نام:</Text>
                <Text style={styles.detailValue}>{sanad.studentName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>شعبہ / مضمون:</Text>
                <Text style={styles.detailValue}>{sanad.courseName}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>درجہ و امتیاز:</Text>
                <Text style={[styles.detailValue, { color: '#005F46', fontWeight: '800' }]}>
                  {sanad.gradeLabel || 'کامیاب'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>تاریخِ تکمیل:</Text>
                <Text style={styles.detailValue}>
                  {sanad.completionDate + (sanad.hijriDate ? (' (' + sanad.hijriDate + ')') : '')}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>سند سیریل نمبر:</Text>
                <Text style={[styles.detailValue, styles.serialText]}>{sanad.certificateId}</Text>
              </View>
            </View>

            {/* Authority Stamp */}
            <View style={styles.authorityRow}>
              <View style={styles.stampBadge}>
                <Text style={styles.stampText}>★ OFFICIAL SEAL ★</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorityLabel}>جاری کردہ ادارہ:</Text>
                <Text style={styles.authorityValue}>{sanad.issuingAuthority}</Text>
              </View>
            </View>

            {/* Share Action */}
            <TouchableOpacity
              style={styles.shareVerificationBtn}
              onPress={handleShareVerification}
              activeOpacity={0.85}
            >
              <Ionicons name="share-social" size={18} color="#FFFFFF" />
              <Text style={styles.shareVerificationBtnText}>تصدیقی لنک شیئر کریں (Share)</Text>
            </TouchableOpacity>
          </View>
        ) : searched ? (
          /* Unverified / Not Found Card */
          <View style={styles.errorCard}>
            <Ionicons name="close-circle" size={54} color="#DC2626" />
            <Text style={styles.errorTitle}>سند کا ریکارڈ دستیاب نہیں</Text>
            <Text style={styles.errorSub}>
              درج کردہ سند نمبر کے مطابق مدرسہ کے ریکارڈ میں کوئی سند موجود نہیں ہے۔ برائے مہربانی سیریل نمبر دوبارہ چیک فرمائیں۔
            </Text>
          </View>
        ) : (
          /* Initial State Card */
          <View style={styles.infoCard}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#C8A84E" />
            <Text style={styles.infoTitle}>سرکاری سند کی تصدیق</Text>
            <Text style={styles.infoSub}>
              مدرسۃ السالکات للبنات کی طرف سے جاری کردہ کسی بھی سند، اجازت، یا سرٹیفکیٹ کی لائیو اور مستند تصدیق کے لیے اوپر سیریل نمبر درج فرمائیں۔
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 14,
    color: '#C8A84E',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  headerTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 14,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: 8,
    ...SHADOWS.card,
  },
  searchLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005F46',
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  verifiedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: '#C8A84E',
    gap: 12,
    ...SHADOWS.card,
  },
  bismillahBox: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    gap: 2,
  },
  bismillahText: {
    fontSize: 15,
    color: '#005F46',
    fontWeight: '700',
  },
  madrasaTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  madrasaEng: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    padding: 10,
    borderRadius: RADIUS.lg,
    gap: 10,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#007A58',
  },
  statusSub: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.lg,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  serialText: {
    color: '#005F46',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  authorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: RADIUS.md,
  },
  stampBadge: {
    backgroundColor: '#C8A84E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  stampText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#002E23',
  },
  authorityLabel: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '700',
  },
  authorityValue: {
    fontSize: 11,
    color: '#78350F',
    fontWeight: '600',
  },
  shareVerificationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#005F46',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 8,
    marginTop: 4,
  },
  shareVerificationBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  errorSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  infoSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});
