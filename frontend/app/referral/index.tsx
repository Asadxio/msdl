import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, RADIUS, SPACING, SHADOWS, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import {
  ReferralRecord,
  generateReferralCode,
  getSadqahTier,
  getReferralShareMessage,
  subscribeToMyReferrals,
} from '@/lib/referral';
import { goBackOrReplace } from '@/lib/navigation';

export default function SadqahReferralScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = useMemo(() => {
    return profile?.referral_code || generateReferralCode(user?.uid || '', profile?.name);
  }, [profile?.referral_code, user?.uid, profile?.name]);

  const totalInvited = profile?.referral_count || referrals.length || 0;
  const currentTier = useMemo(() => getSadqahTier(totalInvited), [totalInvited]);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeToMyReferrals(user.uid, (data) => {
      setReferrals(data);
      setLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    Alert.alert('دعوت کوڈ کاپی ہوگیا', 'دعوت کوڈ کامیابی سے کاپی ہو چکا ہے۔');
  };

  const handleShareInvite = async () => {
    const msg = getReferralShareMessage(referralCode, profile?.name);
    try {
      await Share.share({
        message: msg,
        title: 'مدرسۃ السالکات للبنات — دعوت و صدقہ جاریہ',
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
          <Text style={styles.arabicHeader}>الدَّعْوَةُ إِلَى الخَيْرِ وَالصَّدَقَةُ الجَارِيَة</Text>
          <Text style={styles.headerTitle}>Sadqah-e-Jariyah & Dawat Hub</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hadith Hero Banner */}
        <View style={styles.hadithCard}>
          <View style={styles.hadithIconWrap}>
            <Ionicons name="gift" size={24} color="#C8A84E" />
          </View>
          <Text style={styles.hadithArabic}>
            قَالَ رَسُولُ اللَّهِ ﷺ: « مَنْ دَلَّ عَلَى خَيْرٍ فَلَهُ مِثْلُ أَجْرِ فَاعِلِهِ »
          </Text>
          <Text style={styles.hadithUrdu}>
            ”جس نے کسی نیکی کی رہنمائی کی، اسے نیکی کرنے والے کے برابر ثواب ملے گا۔“ (صحیح مسلم)
          </Text>
        </View>

        {/* Invite Code Card */}
        <View style={styles.inviteCard}>
          <Text style={styles.inviteCardLabel}>آپ کا مخصوص دعوت کوڈ (Your Referral Code):</Text>
          <View style={styles.codeRow}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopyCode} activeOpacity={0.8}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color="#005F46" />
              <Text style={styles.copyBtnText}>{copied ? 'کاپی شدہ' : 'کاپی'}</Text>
            </TouchableOpacity>
          </View>

          {/* Share Buttons */}
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={handleShareInvite}
            activeOpacity={0.85}
          >
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            <Text style={styles.shareBtnText}>واٹس ایپ پر دعوت ارسال کریں (Share)</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Ionicons name="people" size={24} color="#005F46" />
            <Text style={styles.statVal}>{totalInvited}</Text>
            <Text style={styles.statLabel}>شامل شدہ بہنیں</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="ribbon" size={24} color="#C8A84E" />
            <Text style={[styles.statVal, { color: '#C8A84E' }]}>{currentTier.badge.split(' ')[0]}</Text>
            <Text style={styles.statLabel}>{currentTier.badge}</Text>
          </View>
        </View>

        {/* Milestone Banner */}
        <View style={styles.milestoneCard}>
          <View style={styles.milestoneHeader}>
            <Ionicons name="sparkles" size={18} color="#C8A84E" />
            <Text style={styles.milestoneTitle}>صدقہ جاریہ کا درجہ: {currentTier.arabicTitle}</Text>
          </View>
          <Text style={styles.milestoneSub}>
            ہر وہ بہن جو آپ کے توسط سے قرآن و سنت اور فقہ سیکھے گی، اس کے علم و عمل کا ثواب قیامت تک آپ کے نامۂ اعمال میں درج ہوتا رہے گا۔
          </Text>
        </View>

        {/* Invited Sisters List */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>دعوت قبول کرنے والی بہنیں (Joined Sisters):</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginTop: 12 }} />
          ) : referrals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="heart-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyTitle}>ابھی تک کوئی دعوت درج نہیں ہوئی</Text>
              <Text style={styles.emptySub}>
                اوپر دیے گئے بٹن سے اپنی سہیلیوں، بہنوں اور عزیزوں کو مدرسہ کی دعوت بھیجیں اور صدقہ جاریہ کا حصہ بنیں۔
              </Text>
            </View>
          ) : (
            referrals.map((item) => (
              <View key={item.id} style={styles.sisterRow}>
                <View style={styles.sisterAvatar}>
                  <Ionicons name="person" size={16} color="#005F46" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sisterName}>{item.referee_name}</Text>
                  <Text style={styles.sisterStatus}>
                    طالبہ مدرسہ • شمولیت: صدقہ جاریہ
                  </Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#007A58" />
                  <Text style={styles.verifiedText}>جوائن شدہ</Text>
                </View>
              </View>
            ))
          )}
        </View>
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
    gap: 12,
    paddingBottom: 40,
  },
  hadithCard: {
    backgroundColor: '#003D2E',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    gap: 8,
  },
  hadithIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(200, 168, 78, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hadithArabic: {
    fontSize: 15,
    color: '#FDFBF4',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
  },
  hadithUrdu: {
    fontSize: 12,
    color: '#C8A84E',
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '600',
  },
  inviteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 10,
    ...SHADOWS.card,
  },
  inviteCardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  codeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#005F46',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: RADIUS.lg,
    gap: 8,
    marginTop: 4,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    ...SHADOWS.card,
  },
  statVal: {
    fontSize: 22,
    fontWeight: '800',
    color: '#005F46',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  milestoneCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  milestoneSub: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 17,
  },
  listSection: {
    gap: 8,
    marginTop: 4,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  emptySub: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  sisterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 10,
    ...SHADOWS.card,
  },
  sisterAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sisterName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  sisterStatus: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007A58',
  },
});
