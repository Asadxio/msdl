import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, I18nManager } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const STORAGE_KEY_PREFIX = 'onboarding_completed::';
const SCREEN_KEYS = [
  'welcome',
  'live_classes',
  'audio_lessons',
  'attendance_quiz',
  'islamic_tools',
  'get_started',
];

const TRANSLATIONS: Record<string, Record<string, { title: string; desc: string }>> = {
  en: {
    welcome: { title: 'Welcome to Madrasa', desc: 'Premium Islamic learning, live classes, and community.' },
    live_classes: { title: 'Live Classes', desc: 'Join interactive live lessons with teachers.' },
    audio_lessons: { title: 'Audio Lessons', desc: 'Listen to curated audio lessons anytime.' },
    attendance_quiz: { title: 'Attendance & Quiz', desc: 'Track attendance and take assessments.' },
    islamic_tools: { title: 'Islamic Tools', desc: 'Prayer times, Qibla, and Islamic calendar.' },
    get_started: { title: 'Get Started', desc: 'Create an account or sign in to continue.' },
  },
  ar: {
    welcome: { title: 'مرحبًا بك في المدرسة', desc: 'التعلم الإسلامي المميز، الدروس الحية، والمجتمع.' },
    live_classes: { title: 'الدروس الحية', desc: 'انضم إلى دروس مباشرة تفاعلية مع المدرسين.' },
    audio_lessons: { title: 'دروس صوتية', desc: 'استمع إلى دروس صوتية مُختارة في أي وقت.' },
    attendance_quiz: { title: 'الحضور والاختبار', desc: 'تعقب الحضور وأجرِ الاختبارات.' },
    islamic_tools: { title: 'أدوات إسلامية', desc: 'مواقيت الصلاة، القبلة، والتقويم الإسلامي.' },
    get_started: { title: 'ابدأ الآن', desc: 'قم بإنشاء حساب أو تسجيل الدخول للمتابعة.' },
  },
  ur: {
    welcome: { title: 'مدرسہ میں خوش آمدید', desc: 'معیاری اسلامی تعلیم، لائیو کلاسز، اور کمیونٹی.' },
    live_classes: { title: 'لائیو کلاسز', desc: 'اساتذہ کے ساتھ انٹرایکٹو لائیو اسباق میں شامل ہوں۔' },
    audio_lessons: { title: 'آڈیو اسباق', desc: 'جب چاہیں منتخب آڈیو اسباق سنیں۔' },
    attendance_quiz: { title: 'حاضری اور کوئز', desc: 'حاضری ٹریک کریں اور اسیسمنٹس دیں۔' },
    islamic_tools: { title: 'اسلامی ٹولز', desc: 'نماز کے اوقات، قبلہ، اور اسلامی کیلنڈر۔' },
    get_started: { title: 'شروع کریں', desc: 'جاری رکھنے کے لیے اکاؤنٹ بنائیں یا لاگ ان کریں۔' },
  },
};

function useLocaleKey() {
  const rtl = I18nManager.isRTL;
  if (rtl) return 'ar';
  // basic heuristic: prefer Urdu if device locale contains 'ur'
  const raw = (Constants?.expoConfig?.locale || '').toLowerCase();
  if (raw.includes('ur')) return 'ur';
  return 'en';
}

export default function OnboardingFirstTime() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const locale = useLocaleKey();
  const t = TRANSLATIONS[locale] || TRANSLATIONS.en;

  const [index, setIndex] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => { Animated.timing(anim, { toValue: index, duration: 380, useNativeDriver: true }).start(); }, [index]);

  const appVersion = String(Constants.expoConfig?.version || Constants.manifest?.version || '1.0.0');
  const storageKey = `${STORAGE_KEY_PREFIX}${appVersion}`;

  const finish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(storageKey, 'true');
    } catch {}
    // route based on auth state
    // import lazily to avoid circulars
    const { useAuth } = await import('@/context/AuthContext');
    // we can't call hook here; instead inspect AsyncStorage-auth fallback: navigate to login (app will redirect if user exists)
    router.replace('/auth/login');
  }, [router, storageKey]);

  const skip = useCallback(async () => {
    try { await AsyncStorage.setItem(storageKey, 'true'); } catch {}
    router.replace('/auth/login');
  }, [router, storageKey]);

  const next = useCallback(() => {
    if (index + 1 >= SCREEN_KEYS.length) {
      finish();
      return;
    }
    setIndex((i) => Math.min(SCREEN_KEYS.length - 1, i + 1));
  }, [index, finish]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const page = SCREEN_KEYS[index];
  const text = t[page];

  const rtl = I18nManager.isRTL;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={skip} accessibilityLabel="Skip onboarding">
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={[styles.card, { transform: [{ translateX: anim.interpolate({ inputRange: [0, SCREEN_KEYS.length - 1], outputRange: [0, -(SCREEN_KEYS.length - 1) * 10] }) }] }] }>
        <Text style={[styles.title, rtl ? { textAlign: 'right' } : {}]}>{text.title}</Text>
        <Text style={[styles.desc, rtl ? { textAlign: 'right' } : {}]}>{text.desc}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.progressRow}>
          {SCREEN_KEYS.map((_, i) => (
            <View key={i} style={[styles.dot, i === index ? styles.dotActive : {}]} />
          ))}
        </View>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={prev} disabled={index === 0} style={styles.controlLeft}>
            <Ionicons name="chevron-back" size={20} color={index === 0 ? '#ccc' : COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={next} style={styles.nextBtn} accessibilityLabel={index === SCREEN_KEYS.length - 1 ? 'Done' : 'Next'}>
            <Text style={styles.nextText}>{index === SCREEN_KEYS.length - 1 ? 'Done' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: SPACING.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingVertical: SPACING.md },
  skip: { color: COLORS.textMuted, fontWeight: '600' },
  card: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPOGRAPHY.title, color: COLORS.primary, textAlign: 'center', marginBottom: SPACING.md },
  desc: { ...TYPOGRAPHY.body, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: SPACING.md },
  footer: { paddingBottom: SPACING.xl },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: SPACING.md },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: 'rgba(6,78,59,0.12)', marginHorizontal: 4 },
  dotActive: { backgroundColor: COLORS.primary, width: 24 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlLeft: { padding: 8 },
  nextBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: RADIUS.full },
  nextText: { color: '#fff', fontWeight: '700' },
});
