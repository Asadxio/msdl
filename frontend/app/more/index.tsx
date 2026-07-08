import { ScreenRefreshControl, ScalePressable } from '@/components/ui';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Linking, Share, Platform } from 'react-native';
import { WHATSAPP_HELP_URL } from '@/lib/links';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { COLORS, SHADOWS, SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

/* ─────────────────────────────────── Types ──────────────────────────────── */

type MenuItem = {
  label: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route?: string;
  onPress?: () => void;
  colorBg?: string;
  colorIcon?: string;
  disabled?: boolean;
};

type MenuSection = {
  title: string;
  emoji: string;
  colorBg: string;
  colorIcon: string;
  adminOnly?: boolean;
  items: MenuItem[];
};

/* ─────────────────────────────── Quick Actions ─────────────────────────── */

type QuickAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  bg: string;
  fg: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Courses', icon: 'school-outline', route: '/(tabs)/courses', bg: '#EEF2FF', fg: '#4F46E5' },
  { label: 'Library', icon: 'library-outline', route: '/more/library', bg: '#F0FDF4', fg: '#16A34A' },
  { label: 'Quiz', icon: 'help-circle-outline', route: '/more/quiz', bg: '#FFF7ED', fg: '#EA580C' },
  { label: 'Prayer', icon: 'time-outline', route: '/prayer-times', bg: '#ECFDF5', fg: '#059669' },
  { label: 'Qibla', icon: 'compass-outline', route: '/qibla', bg: '#FEF3C7', fg: '#D97706' },
  { label: 'Calendar', icon: 'calendar-number-outline', route: '/islamic-calendar', bg: '#F5F3FF', fg: '#7C3AED' },
  { label: 'Alerts', icon: 'notifications-outline', route: '/(tabs)/notifications', bg: '#FEE2E2', fg: '#DC2626' },
  { label: 'Settings', icon: 'settings-outline', route: '/settings', bg: '#F1F5F9', fg: '#475569' },
];

/* ─────────────────────────────── Menu Sections ─────────────────────────── */

const MENU_SECTIONS: MenuSection[] = [
  {
    title: 'Learning',
    emoji: '📚',
    colorBg: '#EEF2FF',
    colorIcon: '#4F46E5',
    items: [
      { label: 'Applications', subtitle: 'Islamic tools and features', icon: 'apps-outline', route: '/more/applications' },
      { label: 'Attendance', subtitle: 'Track your attendance', icon: 'calendar-outline', route: '/more/attendance', colorBg: '#ECFDF5', colorIcon: '#10B981' },
      { label: 'Recordings', subtitle: 'Watch lesson recordings', icon: 'play-circle-outline', route: '/recordings' },
      { label: 'Announcements', subtitle: 'Live status and announcements', icon: 'radio-outline', route: '/status', colorBg: '#FFF7ED', colorIcon: '#EA580C' },
      { label: 'Teachers', subtitle: 'Meet your teachers', icon: 'people-outline', route: '/more/teachers' },
      { label: 'Payment History', subtitle: 'View your payment records', icon: 'receipt-outline', route: '/payment-history', colorBg: '#ECFDF5', colorIcon: '#10B981' },
    ]
  },
  {
    title: 'Student Services',
    emoji: '💳',
    colorBg: '#ECFDF5',
    colorIcon: '#10B981',
    items: [
      { label: 'About & Donations', subtitle: 'App info and support', icon: 'heart-outline', route: '/payment', colorBg: '#FEF3C7', colorIcon: '#D97706' },
      { label: 'Certificates', subtitle: 'View your certificates', icon: 'ribbon-outline', route: '/(tabs)/certificate', colorBg: '#F5F3FF', colorIcon: '#7C3AED' },
      { label: 'Quiz Analytics', subtitle: 'Track your quiz performance', icon: 'stats-chart-outline', route: '/(tabs)/progress', colorBg: '#EEF2FF', colorIcon: '#4F46E5' },
    ]
  },
  {
    title: 'App Features',
    emoji: '⚙️',
    colorBg: '#F8FAFC',
    colorIcon: '#64748B',
    items: [
      { label: 'Settings', subtitle: 'App preferences and account', icon: 'settings-outline', route: '/settings' },
      { label: 'Privacy Policy', subtitle: 'Review your privacy rights', icon: 'shield-checkmark-outline', route: '/privacy', colorBg: '#F5F3FF', colorIcon: '#8B5CF6' },
      { label: 'Terms & Conditions', subtitle: 'View app terms', icon: 'document-text-outline', route: '/terms', colorBg: '#F5F3FF', colorIcon: '#8B5CF6' },
      { label: 'Community Guidelines', subtitle: 'Respectful behavior rules', icon: 'people-outline', route: '/community-guidelines' },
      { label: 'Data & Privacy Controls', subtitle: 'Manage your data settings', icon: 'lock-closed-outline', route: '/data-privacy', colorBg: '#F5F3FF', colorIcon: '#8B5CF6' },
    ]
  },
  {
    title: 'Admin Controls',
    emoji: '🛡️',
    colorBg: '#FFF1F2',
    colorIcon: '#E11D48',
    adminOnly: true,
    items: [
      { label: 'Manage Academics', subtitle: 'Admin controls for academics', icon: 'school-outline', route: '/admin/manage-academics' },
      { label: 'Admin Payments', subtitle: 'Admin billing tools', icon: 'card-outline', route: '/admin/payments' },
      { label: 'Admin Users', subtitle: 'Manage registered users', icon: 'people-circle-outline', route: '/admin/users' },
      { label: 'Analytics Dashboard', subtitle: 'Platform-wide metrics and reports', icon: 'bar-chart-outline', route: '/admin/analytics' },
      { label: 'Moderation Queue', subtitle: 'Review flagged content and reports', icon: 'flag-outline', route: '/admin/moderation' },
      { label: 'Security Dashboard', subtitle: 'Monitor security events and access', icon: 'shield-outline', route: '/admin/security' },
      { label: 'Privacy Requests', subtitle: 'Review user data requests', icon: 'document-lock-outline', route: '/admin/privacy-requests' },
      { label: 'Send Push Notifications', subtitle: 'Broadcast messages to users', icon: 'notifications-outline', route: '/admin/send-push' },
    ]
  }
];

/* ─────────────────────────────── Social Links ──────────────────────────── */

type SocialLink = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  url: string | null;
  bg: string;
  fg: string;
};

const SOCIAL_LINKS: SocialLink[] = [
  { label: 'WhatsApp', icon: 'logo-whatsapp', url: WHATSAPP_HELP_URL, bg: '#DCFCE7', fg: '#16A34A' },
  { label: 'YouTube', icon: 'logo-youtube', url: null, bg: '#FEE2E2', fg: '#DC2626' },
  { label: 'Instagram', icon: 'logo-instagram', url: null, bg: '#FCE7F3', fg: '#DB2777' },
  { label: 'Telegram', icon: 'paper-plane-outline', url: null, bg: '#DBEAFE', fg: '#2563EB' },
];

/* ────────────────────────────── Main Component ─────────────────────────── */

export default function MoreLandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, user } = useAuth();
  const { lessonProgress, courses, books } = useData();
  const quizzesCompleted = useMemo(() => {
    if (!lessonProgress) return 0;
    return Object.values(lessonProgress).filter(p => p.quizCompleted).length;
  }, [lessonProgress]);
  const totalCourses = useMemo(() => Array.isArray(courses) ? courses.length : 0, [courses]);
  const totalBooks = useMemo(() => Array.isArray(books) ? books.length : 0, [books]);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await new Promise(r => setTimeout(r, 500));
  });

  const initials = useMemo(() => {
    const name = profile?.name || user?.displayName || 'Student';
    return name.substring(0, 2).toUpperCase();
  }, [profile?.name, user?.displayName]);

  const memberSince = useMemo(() => {
    if (user?.metadata?.creationTime) {
      return new Date(user.metadata.creationTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
    }
    return 'Recently';
  }, [user?.metadata?.creationTime]);

  const lessonsCompleted = useMemo(() => {
    if (!lessonProgress) return 0;
    return Object.values(lessonProgress).filter(p => p.completed).length;
  }, [lessonProgress]);
  
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out Madrasa Tus Salikat Lil Banat — an Islamic learning platform for students. Download now!',
      });
    } catch (_e) {
      // User cancelled share
    }
  };

  const handleRateApp = () => {
    // On Android, link to Play Store listing
    const storeUrl = Platform.select({
      android: 'https://play.google.com/store/apps/details?id=com.mslb.frontend',
      ios: 'https://apps.apple.com/app/idXXXXXXXXXX',
      default: '',
    });
    if (storeUrl) Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]} 
      showsVerticalScrollIndicator={false} 
      refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <Text style={styles.title}>Student Services</Text>
        <Text style={styles.subtitle}>Everything you need for learning, student services, and account management.</Text>
      </View>

      {/* ─── 👤 Profile Card ─── */}
      <ScalePressable 
        style={styles.profileCard} 
        onPress={() => router.push('/settings')} 
        accessibilityRole="button" 
        accessibilityLabel="View Profile and Settings"
      >
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitials}>{initials}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileGreeting}>AS-SALAMU ALAYKUM ✨</Text>
          <Text style={styles.profileName} numberOfLines={1}>{profile?.name || user?.displayName || 'Student'}</Text>
          <View style={styles.profileBadges}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Student'}</Text>
            </View>
          </View>
          <Text style={styles.profileEmail} numberOfLines={1}>{user?.email || profile?.email}</Text>
          <Text style={styles.profileMeta}>Member since {memberSince}</Text>
        </View>
        <View style={styles.profileChevron}>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </View>
      </ScalePressable>

      {/* ─── Stats Card ─── */}
      <View style={styles.statsGrid}>
        <ScalePressable style={styles.statCard} accessibilityRole="summary" accessibilityLabel={`Courses Available: ${totalCourses}`}>
          <View style={[styles.statIconContainer, { backgroundColor: '#EEF2FF' }]}>
            <Ionicons name="book" size={24} color="#4F46E5" />
          </View>
          <Text style={styles.statValue}>{totalCourses}</Text>
          <Text style={styles.statLabel}>Courses Available</Text>
        </ScalePressable>
        <ScalePressable style={styles.statCard} accessibilityRole="summary" accessibilityLabel={`Lessons Done: ${lessonsCompleted}`}>
          <View style={[styles.statIconContainer, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
          </View>
          <Text style={styles.statValue}>{lessonsCompleted}</Text>
          <Text style={styles.statLabel}>Lessons Done</Text>
        </ScalePressable>
        <ScalePressable style={styles.statCard} accessibilityRole="summary" accessibilityLabel={`Quizzes Done: ${quizzesCompleted}`}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="help-circle" size={24} color="#D97706" />
          </View>
          <Text style={styles.statValue}>{quizzesCompleted}</Text>
          <Text style={styles.statLabel}>Quizzes Done</Text>
        </ScalePressable>
        <ScalePressable style={styles.statCard} accessibilityRole="summary" accessibilityLabel={`Library Books: ${totalBooks}`}>
          <View style={[styles.statIconContainer, { backgroundColor: '#F5F3FF' }]}>
            <Ionicons name="library" size={24} color="#7C3AED" />
          </View>
          <Text style={styles.statValue}>{totalBooks}</Text>
          <Text style={styles.statLabel}>Library Books</Text>
        </ScalePressable>
      </View>

      {/* ─── ⚡ Quick Actions Grid ─── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>⚡  QUICK ACTIONS</Text>
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map((action) => (
            <ScalePressable
              key={action.label}
              style={styles.quickItem}
              onPress={() => router.push(action.route as any)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
            >
              <View style={[styles.quickIconContainer, { backgroundColor: action.bg }]}>
                <Ionicons name={action.icon} size={24} color={action.fg} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={1}>{action.label}</Text>
            </ScalePressable>
          ))}
        </View>
      </View>

      {/* ─── Menu Sections ─── */}
      {MENU_SECTIONS.filter(s => s.adminOnly ? isAdmin : true).map((section) => (
        <View key={section.title} style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>{section.emoji}  {section.title.toUpperCase()}</Text>
          <View style={styles.sectionList}>
            {section.items.map((item) => (
              <ScalePressable
                key={item.label}
                style={styles.rowCard}
                onPress={() => {
                  if (item.onPress) item.onPress();
                  else if (item.route) router.push(item.route as any);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${item.label}, ${item.subtitle}`}
                disabled={item.disabled}
              >
                <View style={[styles.rowIconContainer, { backgroundColor: item.colorBg || section.colorBg }]}>
                  <Ionicons name={item.icon} size={22} color={item.colorIcon || section.colorIcon} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                </View>
                <View style={styles.rowChevronContainer}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </View>
              </ScalePressable>
            ))}
          </View>
        </View>
      ))}

      {/* ─── 🕌 About Madrasa ─── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>🕌  ABOUT MADRASA</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutName}>Madrasa Tus Salikat Lil Banat</Text>
          <Text style={styles.aboutDesc}>
            An Islamic educational institution dedicated to providing quality Deeni education for girls. 
            Our mission is to nurture knowledgeable, practicing Muslimas who can contribute positively to society.
          </Text>
          <View style={styles.aboutMeta}>
            <View style={styles.aboutMetaRow}>
              <View style={[styles.aboutIconBox, { backgroundColor: '#EEF2FF' }]}>
                <Ionicons name="location-outline" size={18} color="#4F46E5" />
              </View>
              <Text style={styles.aboutMetaText}>Madrasa Tus Salikat Lil Banat</Text>
            </View>
            <View style={styles.aboutMetaRow}>
              <View style={[styles.aboutIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="school-outline" size={18} color="#10B981" />
              </View>
              <Text style={styles.aboutMetaText}>Islamic Education for Girls</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─── ❤️ Support & Social ─── */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>❤️  SUPPORT</Text>
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Need Help?</Text>
          <Text style={styles.supportSubtitle}>We&apos;re here to help you. Contact the Madrasa anytime.</Text>
          
          {/* Social Links */}
          <View style={styles.socialRow}>
            {SOCIAL_LINKS.filter(s => s.url).map((link) => (
              <ScalePressable
                key={link.label}
                style={[styles.socialButton, { backgroundColor: link.bg }]}
                onPress={() => link.url && Linking.openURL(link.url)}
                accessibilityRole="button"
                accessibilityLabel={link.label}
              >
                <Ionicons name={link.icon} size={24} color={link.fg} />
              </ScalePressable>
            ))}
          </View>

          {/* Action rows */}
          <View style={styles.supportList}>
            <ScalePressable style={styles.supportRow} onPress={handleShareApp} accessibilityRole="button" accessibilityLabel="Share App">
              <View style={[styles.supportIcon, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="share-social-outline" size={22} color="#2563EB" />
              </View>
              <View style={styles.supportRowContent}>
                <Text style={styles.supportLabel}>Share App</Text>
                <Text style={styles.supportRowSub}>Share MSDL with friends and family</Text>
              </View>
              <View style={styles.rowChevronContainer}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            </ScalePressable>

            <ScalePressable style={styles.supportRow} onPress={handleRateApp} accessibilityRole="button" accessibilityLabel="Rate App">
              <View style={[styles.supportIcon, { backgroundColor: '#FEF9C3' }]}>
                <Ionicons name="star-outline" size={22} color="#CA8A04" />
              </View>
              <View style={styles.supportRowContent}>
                <Text style={styles.supportLabel}>Rate App</Text>
                <Text style={styles.supportRowSub}>Leave a review on Google Play</Text>
              </View>
              <View style={styles.rowChevronContainer}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
              </View>
            </ScalePressable>

            {WHATSAPP_HELP_URL ? (
              <ScalePressable style={styles.supportRow} onPress={() => Linking.openURL(WHATSAPP_HELP_URL)} accessibilityRole="button" accessibilityLabel="Contact Us via WhatsApp">
                <View style={[styles.supportIcon, { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={22} color="#16A34A" />
                </View>
                <View style={styles.supportRowContent}>
                  <Text style={styles.supportLabel}>Contact Us</Text>
                  <Text style={styles.supportRowSub}>Direct support desk via WhatsApp</Text>
                </View>
                <View style={styles.rowChevronContainer}>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                </View>
              </ScalePressable>
            ) : null}
          </View>
        </View>
      </View>

      {/* ─── Footer ─── */}
      <View style={styles.footer}>
        <Text style={styles.footerHeart}>Made with ❤️ for Islamic Education</Text>
        <Text style={styles.footerTitle}>Madrasa Tus Salikat Lil Banat</Text>
        {appVersion && <Text style={styles.footerVersion}>Version {appVersion}</Text>}
      </View>
    </ScrollView>
  );
}

/* ────────────────────────────────── Styles ──────────────────────────────── */

const CARD_RADIUS = 20;
const CARD_BORDER = 'rgba(15, 23, 42, 0.06)';
const CARD_SHADOW_OPACITY = 0.05;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { paddingHorizontal: 16 },

  /* Header */
  header: { marginBottom: 24 },
  title: { ...TYPOGRAPHY.title, fontSize: 24, color: '#0F172A', letterSpacing: -0.4, fontWeight: '800', marginBottom: 4 },
  subtitle: { ...TYPOGRAPHY.body, fontSize: 14, color: '#64748B', lineHeight: 20 },
  
  /* Profile Card */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    marginBottom: 24,
    ...SHADOWS.card,
    shadowOpacity: 0.06,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 112,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#1B4332',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileInitials: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  profileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  profileGreeting: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
    letterSpacing: 0.6,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  profileBadges: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    textTransform: 'uppercase',
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
    marginBottom: 4,
  },
  profileMeta: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },
  profileChevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  /* Stats Grid (2 Columns, Equal Height, Centered Content) */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    columnGap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 16,
    ...SHADOWS.card,
    shadowOpacity: CARD_SHADOW_OPACITY,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    minHeight: 116,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },

  /* Quick Actions Grid (4 Columns) */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: 8,
    minHeight: 80,
  },
  quickIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },

  /* Section Blocks */
  sectionBlock: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    marginLeft: 4,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  sectionList: {
    gap: 12,
  },

  /* Row Cards */
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    ...SHADOWS.card,
    shadowOpacity: CARD_SHADOW_OPACITY,
    minHeight: 72,
  },
  rowIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { 
    flex: 1,
    justifyContent: 'center',
  },
  rowLabel: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#0F172A',
    marginBottom: 4,
  },
  rowSubtitle: { 
    fontSize: 12, 
    color: '#64748B',
    fontWeight: '400',
  },
  rowChevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* About Card */
  aboutCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    ...SHADOWS.card,
    shadowOpacity: CARD_SHADOW_OPACITY,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  aboutName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  aboutDesc: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 20,
  },
  aboutMeta: {
    gap: 12,
  },
  aboutMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  aboutIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutMetaText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
  },

  /* Support Card */
  supportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: 20,
    ...SHADOWS.card,
    shadowOpacity: CARD_SHADOW_OPACITY,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  supportTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  supportSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 20,
    lineHeight: 20,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportList: {
    gap: 12,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: CARD_RADIUS,
    backgroundColor: '#F8FAFC',
    minHeight: 72,
  },
  supportIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  supportRowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  supportLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  supportRowSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(15, 23, 42, 0.06)',
  },
  footerHeart: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});

