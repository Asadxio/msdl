/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Share,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { WHATSAPP_HELP_URL, MADRASA_WEBSITE_URL, isValidHttpsUrl, normalizeWhatsAppUrl, prepareExternalUrl } from '@/lib/links';

// ─── MSLB Institutional Design System ───
const THEME = {
  primary: '#005F46',
  primaryLight: '#0B6B53',
  gold: '#C8A84E',
  softGold: '#E8D9A8',
  goldBg: '#FEF9EE',
  goldBorder: '#F3E5BE',
  background: '#F7F8F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F2',
  textMain: '#12332A',
  textMuted: '#60736B',
  border: '#E2E8E4',
  error: '#DC2626',
  errorBg: '#FEF2F2',
  success: '#10B981',
  successBg: '#ECFDF5',
};

type AppSettings = {
  fees_amount: number;
  razorpay_link: string;
  whatsapp_channel: string;
  whatsapp_contact: string;
  instagram: string;
  youtube_link: string;
  telegram_link: string;
  donation_content: string;
  about_madrasa: string;
};

type FeedbackItem = {
  id: string;
  user_name: string;
  message: string;
  rating?: number;
  user_id?: string;
  created_at?: any;
};

type PaymentItem = {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  state?: 'pending' | 'approved' | 'rejected' | 'verified' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'disputed' | 'expired';
  status?: 'pending' | 'approved' | 'rejected' | 'verified' | 'submitted' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded' | 'disputed' | 'expired';
  provider?: 'razorpay';
  type?: 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar';
};

function paymentState(payment: Pick<PaymentItem, 'state' | 'status'>): string {
  return payment.state ?? payment.status ?? 'pending';
}

const DEFAULT_ABOUT_CONTENT = `Madrasatu-s-Salikat Lil Banat is dedicated to nurturing Islamic knowledge, noble character, and academic excellence for girls through authentic Quranic education, Tajweed, Hadith, Fiqh, and spiritual development.

Our mission is to create confident, knowledgeable, and practicing Muslim women who embody Islamic values while contributing positively to society.

Through structured courses, experienced teachers, live classes, digital learning resources, and continuous guidance, we strive to provide a safe and inspiring environment for lifelong learning.

May Allah ﷻ accept this effort and make it a means of beneficial knowledge for generations to come.`;

const DEFAULT_SETTINGS: AppSettings = {
  fees_amount: 0,
  razorpay_link: '',
  whatsapp_channel: '',
  whatsapp_contact: '',
  instagram: '',
  youtube_link: '',
  telegram_link: '',
  donation_content: 'Your sadaqah, zakat, fitrah and langar support help students access Islamic education with dignity and consistency.',
  about_madrasa: DEFAULT_ABOUT_CONTENT,
};

const DEV_RAZORPAY_TEST_LINK = 'https://rzp.io/l/test123';

const ISLAMIC_INSPIRATIONS = [
  { type: "Quran Verse", arabic: "رَّبِّ زِدْنِي عِلْمًا", translation: "My Lord, increase me in knowledge.", source: "Surah Taha 20:114" },
  { type: "Hadith", arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ", translation: "The best of you are those who learn the Quran and teach it.", source: "Sahih Bukhari" },
  { type: "Masnoon Dua", arabic: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا", translation: "O Allah, I ask You for beneficial knowledge, acceptable provision, and righteous deeds.", source: "Sunan Ibn Majah" },
  { type: "Islamic Quote", arabic: "الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي قَلْبِ مَنْ يَشَاءُ", translation: "Knowledge is a light that Allah casts into the heart of whom He wills.", source: "Imam Malik (RA)" },
  { type: "Masnoon Dua", arabic: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", translation: "Our Lord, give us in this world [that which is] good and in the Hereafter [that which is] good and protect us from the punishment of the Fire.", source: "Surah Al-Baqarah 2:201" }
];

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.sectionCard, { opacity: fadeAnim }]}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconBox}>
          <Ionicons name={icon as any} size={18} color={THEME.primary} />
        </View>
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      <View style={styles.goldAccent} />
      {children}
    </Animated.View>
  );
}

type AboutMadrasaSectionProps = {
  aboutMadrasa: string;
  isAdmin: boolean;
  onSaved: (aboutMadrasa: string) => void;
};

const AboutMadrasaSection = React.memo(function AboutMadrasaSection({ aboutMadrasa, isAdmin, onSaved }: AboutMadrasaSectionProps) {
  const [aboutDraft, setAboutDraft] = useState(aboutMadrasa);
  const [aboutError, setAboutError] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);
  const [focused, setFocused] = useState(false);
  const [serverChangedWhileEditing, setServerChangedWhileEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const editingRef = useRef(false);
  const latestServerAboutRef = useRef(aboutMadrasa);

  useEffect(() => {
    const serverValueChanged = aboutMadrasa !== latestServerAboutRef.current;
    if (serverValueChanged) {
      latestServerAboutRef.current = aboutMadrasa;
    }

    if (editingRef.current) {
      if (serverValueChanged) {
        setServerChangedWhileEditing(true);
      }
      return;
    }

    setAboutDraft(aboutMadrasa);
    setServerChangedWhileEditing(false);
  }, [aboutMadrasa]);

  const saveAboutMadrasa = async () => {
    if (!isAdmin || savingAbout) return;
    const cleanedAbout = aboutDraft.trim();
    if (serverChangedWhileEditing && cleanedAbout !== latestServerAboutRef.current.trim()) {
      const message = 'About content changed on the server while you were editing. Review the latest displayed value before saving again.';
      setAboutError(message);
      Alert.alert('Refresh Required', message);
      return;
    }
    setAboutError('');
    setSavingAbout(true);
    try {
      const settingsRef = doc(db, 'app_settings', 'platform');
      await runTransaction(db, async (transaction) => {
        transaction.set(settingsRef, {
          profile: { about_madrasa: cleanedAbout },
          updated_at: serverTimestamp(),
        }, { merge: true });
      });
      latestServerAboutRef.current = cleanedAbout;
      setServerChangedWhileEditing(false);
      onSaved(cleanedAbout);
      setAboutDraft(cleanedAbout);
      Alert.alert('Saved', 'About Our Madrasa updated successfully.');
    } catch (error: any) {
      console.error('[About] saveAboutMadrasa transaction ERROR', error);
      const message = error?.message || 'Could not save About Our Madrasa content. Please check your connection and try again.';
      setAboutError(message);
      Alert.alert('Save failed', message);
    } finally {
      setSavingAbout(false);
    }
  };

  return (
    <SectionCard title="About Our Madrasa" icon="leaf-outline">
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.bodyText, { lineHeight: 22 }]} numberOfLines={expanded ? undefined : 4}>
          {aboutMadrasa || DEFAULT_ABOUT_CONTENT}
        </Text>
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          style={styles.readMoreBtn}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Read Less" : "Read More"}
        >
          <Text style={styles.readMoreText}>{expanded ? "Read Less ▲" : "Read More ▼"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.websiteLinkButton}
          onPress={() => Linking.openURL(MADRASA_WEBSITE_URL)}
          accessibilityRole="button"
          accessibilityLabel="Visit Official Madrasa Website"
        >
          <Ionicons name="globe-outline" size={16} color={THEME.primary} />
          <Text style={styles.websiteLinkButtonText}>Visit Official Website</Text>
          <Ionicons name="open-outline" size={14} color={THEME.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.premiumDivider} />
      {isAdmin ? (
        <>
          <Text style={[styles.inputLabel, { marginTop: SPACING.md }]}>Editable About Content</Text>
          <TextInput
            style={[styles.input, styles.aboutTextArea, focused && styles.inputFocused]}
            value={aboutDraft}
            onChangeText={setAboutDraft}
            multiline
            placeholder="Write the complete About Our Madrasa content..."
            placeholderTextColor={THEME.textMuted}
            onFocus={() => {
              editingRef.current = true;
              setFocused(true);
            }}
            onBlur={() => {
              editingRef.current = false;
              setFocused(false);
            }}
          />
          {serverChangedWhileEditing ? <Text style={styles.inputWarning}>Latest server content changed while you are editing. Review before saving.</Text> : null}
          {aboutError ? <Text style={styles.inputError}>{aboutError}</Text> : null}
          <TouchableOpacity style={styles.secondaryBtn} onPress={saveAboutMadrasa} disabled={savingAbout} accessibilityRole="button" accessibilityLabel="Save About Content">
            <Text style={styles.secondaryBtnText}>{savingAbout ? 'Saving About...' : 'Save About'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SectionCard>
  );
});

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut } = useAuth();
  const { lessonProgress, courses, books } = useData();
  const router = useRouter();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';
  const isTeacher = profile?.role === 'teacher' || profile?.role === 'assistant_teacher';

  const [inspirationIdx, setInspirationIdx] = useState(0);
  const lessonsCompletedCount = useMemo(() => Object.values(lessonProgress || {}).filter((p: any) => p?.completed).length, [lessonProgress]);
  const quizzesCompletedCount = useMemo(() => Object.values(lessonProgress || {}).filter((p: any) => p?.quizCompleted).length, [lessonProgress]);
  const totalCoursesCount = useMemo(() => Array.isArray(courses) ? courses.length : 0, [courses]);
  const totalBooksCount = useMemo(() => Array.isArray(books) ? books.length : 0, [books]);

  const [teacherLiveCount, setTeacherLiveCount] = useState(0);
  const [teacherSubmissionsCount, setTeacherSubmissionsCount] = useState(0);
  const [teacherAttendanceCount, setTeacherAttendanceCount] = useState(0);

  const myAssignedCoursesCount = useMemo(() => {
    if (!courses) return 0;
    if (!profile?.name) return courses.length;
    const teacherNameNorm = profile.name.trim().toLowerCase();
    const assigned = courses.filter(
      (c) =>
        (c.teacher_name && c.teacher_name.toLowerCase().includes(teacherNameNorm)) ||
        (user?.uid && (c as any).teacher_id === user.uid)
    );
    return assigned.length > 0 ? assigned.length : courses.length;
  }, [courses, profile?.name, user?.uid]);

  useEffect(() => {
    if (!isTeacher) return;
    const qLive = query(collection(db, 'live_classes'), where('status', 'in', ['live', 'scheduled']), limit(20));
    const unsubLive = onSnapshot(qLive, (snap) => setTeacherLiveCount(snap.size), () => {});

    const qSub = query(collection(db, 'submissions'), where('status', '==', 'submitted'), limit(20));
    const unsubSub = onSnapshot(qSub, (snap) => setTeacherSubmissionsCount(snap.size), () => {});

    const todayStr = new Date().toISOString().slice(0, 10);
    const qAtt = query(collection(db, 'attendance'), where('date', '==', todayStr), limit(50));
    const unsubAtt = onSnapshot(qAtt, (snap) => setTeacherAttendanceCount(snap.size), () => {});

    return () => {
      unsubLive();
      unsubSub();
      unsubAtt();
    };
  }, [isTeacher]);

  const rotateInspiration = useCallback(() => {
    setInspirationIdx((prev) => (prev + 1) % ISLAMIC_INSPIRATIONS.length);
  }, []);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [fbMessage, setFbMessage] = useState('');
  const [fbRating, setFbRating] = useState('');
  const [myPayments, setMyPayments] = useState<PaymentItem[]>([]);
  const [donationAmount, setDonationAmount] = useState('');
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editingFeedbackMsg, setEditingFeedbackMsg] = useState('');
  const [exportingCollection, setExportingCollection] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [donationError, setDonationError] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const testimonials = useMemo(() => feedback.slice(0, 6), [feedback]);
  const mySubmittedFeedback = useMemo(() => feedback.filter(f => f.user_id === user?.uid || (profile?.name && f.user_name === profile.name)), [feedback, user?.uid, profile?.name]);

  const earnedBadges = useMemo(() => {
    const list = [];
    if (user?.metadata?.creationTime) list.push({ id: 'active', title: 'Active Member', desc: 'Joined Madrasatu-s-Salikat Lil Banat', icon: 'ribbon-outline', color: '#10B981' });
    if (lessonsCompletedCount >= 1) list.push({ id: 'first_lesson', title: 'First Lesson', desc: 'Completed your first Islamic lesson', icon: 'book-outline', color: '#4F46E5' });
    if (lessonsCompletedCount >= 5) list.push({ id: 'dedicated', title: 'Dedicated Learner', desc: 'Completed 5+ Islamic lessons', icon: 'flame-outline', color: '#D97706' });
    if (quizzesCompletedCount >= 1) list.push({ id: 'first_quiz', title: 'First Quiz', desc: 'Attempted your first knowledge assessment', icon: 'help-circle-outline', color: '#8B5CF6' });
    if (quizzesCompletedCount >= 5) list.push({ id: 'quiz_master', title: 'Quiz Master', desc: 'Completed 5+ quizzes', icon: 'trophy-outline', color: THEME.gold });
    if (myPayments.length > 0) list.push({ id: 'supporter', title: 'Madrasa Supporter', desc: 'Contributed fees or sadqa to the madrasa', icon: 'heart-outline', color: '#E11D48' });
    return list;
  }, [user, lessonsCompletedCount, quizzesCompletedCount, myPayments.length]);

  const handleAboutSaved = useCallback((aboutMadrasa: string) => {
    setSettings((prev) => ({ ...prev, about_madrasa: aboutMadrasa }));
  }, []);

  const serialize = (value: any): any => {
    if (value?.toDate && typeof value.toDate === 'function') {
      try {
        return value.toDate().toISOString();
      } catch {
        return value;
      }
    }
    if (Array.isArray(value)) return value.map((v) => serialize(v));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    }
    return value;
  };

  const exportCollection = async (collectionName: 'users' | 'courses' | 'payments' | 'feedback') => {
    if (!isAdmin) return;
    setExportingCollection(collectionName);
    try {
      const snap = await getDocs(collection(db, collectionName));
      const data = snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
      await Share.share({
        message: JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            collection: collectionName,
            count: data.length,
            data,
          },
          null,
          2,
        ),
      });
    } catch (err: any) {
      Alert.alert('Export Failed', err?.message || `Could not export ${collectionName}.`);
    } finally {
      setExportingCollection(null);
    }
  };

  useEffect(() => {
    const settingsRef = doc(db, 'app_settings', 'platform');
    const unsubscribe = onSnapshot(
      settingsRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const ytTgLegacy = String(data.youtube_telegram || '').trim();
        const profileSettings = data.profile && typeof data.profile === 'object' ? data.profile : {};
        const canonicalAbout = typeof profileSettings.about_madrasa === 'string'
          ? profileSettings.about_madrasa
          : '';

        setSettings((prev) => ({
          ...prev,
          fees_amount: Number(data.fees_amount || 0),
          razorpay_link: data.razorpay_link || '',
          whatsapp_channel: data.whatsapp_channel || '',
          whatsapp_contact: data.whatsapp_contact || '',
          instagram: data.instagram || '',
          youtube_link: data.youtube_link || ytTgLegacy || '',
          telegram_link: data.telegram_link || '',
          donation_content: data.donation_content || prev.donation_content,
          about_madrasa: canonicalAbout,
        }));
      },
      (error) => {
        console.error('[About] loadSettings onSnapshot ERROR', error);
      },
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'feedback'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: FeedbackItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setFeedback(arr);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'payments'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const arr: PaymentItem[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setMyPayments(arr);
    });
    return unsub;
  }, [user, user?.uid]);

  const saveSettings = async () => {
    if (!isAdmin) return;
    const settingsPayload = {
      fees_amount: settings.fees_amount,
      razorpay_link: settings.razorpay_link,
      whatsapp_channel: settings.whatsapp_channel,
      whatsapp_contact: settings.whatsapp_contact,
      instagram: settings.instagram,
      youtube_link: settings.youtube_link,
      telegram_link: settings.telegram_link,
      donation_content: settings.donation_content,
    };
    try {
      await setDoc(doc(db, 'app_settings', 'platform'), {
        ...settingsPayload,
        updated_at: serverTimestamp(),
      }, { merge: true });
      Alert.alert('Saved', 'Settings updated successfully.');
    } catch (error: any) {
      console.error('[About] saveSettings ERROR', error);
      Alert.alert('Save failed', error?.message || 'Could not save settings.');
    }
  };

  const saveSocialSettings = async () => {
    if (!isAdmin) return;
    if (!settings.whatsapp_channel.trim() && !settings.whatsapp_contact.trim() && !settings.instagram.trim() && !settings.youtube_link.trim() && !settings.telegram_link.trim()) {
      setSocialError('Add at least one social/contact link before saving.');
      return;
    }
    setSocialError('');
    await saveSettings();
  };

  const submitFeedback = async () => {
    if (!user || !profile) return;
    if (!fbMessage.trim()) {
      setFeedbackError('Feedback message is required.');
      Alert.alert('Missing', 'Please write feedback message.');
      return;
    }
    setFeedbackError('');
    try {
      const parsed = Number(fbRating || 0);
      await addDoc(collection(db, 'feedback'), {
        user_id: user.uid,
        user_name: profile.name,
        message: fbMessage.trim(),
        rating: Number.isFinite(parsed) && parsed > 0 ? Math.min(5, Math.max(1, parsed)) : null,
        created_at: serverTimestamp(),
      });
      setFbMessage('');
      setFbRating('');
      Alert.alert('Thanks!', 'Your feedback has been submitted.');
    } catch (error) {
      console.log('[About] submitFeedback ERROR', error);
      Alert.alert('Error', 'Could not submit feedback right now.');
    }
  };

  const saveFeedbackEdit = async () => {
    if (!isAdmin || !editingFeedbackId) return;
    try {
      await updateDoc(doc(db, 'feedback', editingFeedbackId), {
        message: editingFeedbackMsg.trim(),
        updated_at: serverTimestamp(),
      });
      setEditingFeedbackId(null);
      setEditingFeedbackMsg('');
    } catch (error) {
      console.log('[About] saveFeedbackEdit ERROR', error);
      Alert.alert('Error', 'Could not save feedback edit.');
    }
  };

  const deleteFeedback = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'feedback', id));
    } catch (error) {
      console.log('[About] deleteFeedback ERROR', error);
      Alert.alert('Error', 'Could not delete feedback.');
    }
  };

  const openHelp = async () => {
    const url = normalizeWhatsAppUrl(settings.whatsapp_contact || WHATSAPP_HELP_URL);
    if (!url) {
      Alert.alert('Unavailable', 'WhatsApp support is not configured yet.');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      try {
        await Linking.openURL(WHATSAPP_HELP_URL);
      } catch {
        Alert.alert('Unavailable', 'Could not open WhatsApp right now.');
      }
    }
  };

  const openSocialLink = async (url: string, label: string) => {
    try {
      if (!url?.trim()) {
        Alert.alert('Not set', `${label} link is not configured yet.`);
        return;
      }
      const clean = url.trim();
      const canOpen = await Linking.canOpenURL(clean);
      if (!canOpen) {
        Alert.alert('Unavailable', `Could not open ${label} right now.`);
        return;
      }
      await Linking.openURL(clean);
    } catch {
      Alert.alert('Unavailable', `Could not open ${label} right now.`);
    }
  };

  const shareApp = async () => {
    await Share.share({
      message: 'Join Madrasatu-s-Salikat Lil Banat (مدرسۃ السالکات للبنات) app for courses, library and updates.\nhttps://madrasa-website-299.netlify.app/',
    });
  };

  const getLatestPaymentSettings = async () => {
    const platformSnap = await getDoc(doc(db, 'app_settings', 'platform'));
    const globalSnap = await getDoc(doc(db, 'app_settings', 'global'));
    const data = {
      ...(platformSnap.exists() ? (platformSnap.data() as any) : {}),
      ...(globalSnap.exists() ? (globalSnap.data() as any) : {}),
    };
    const rawLink = String(data.razorpay_link || settings.razorpay_link || '').trim();
    const fallbackLink = __DEV__ && !rawLink ? DEV_RAZORPAY_TEST_LINK : '';
    return {
      razorpay_link: rawLink || fallbackLink,
      fees_amount: Number(data.fees_amount ?? settings.fees_amount ?? 0),
    };
  };

  const createPaymentNotification = async (name: string, amount: number, type: string) => {
    await addDoc(collection(db, 'notifications'), {
      title: 'Payment Submitted',
      message: `${name} submitted ${type} payment of ₹${Number(amount || 0).toFixed(2)}.`,
      user_id: 'all',
      category: 'notification',
      created_at: serverTimestamp(),
    });
  };

  const payFees = async () => {
    if (!user || !profile) return;
    try {
      const paymentSettings = await getLatestPaymentSettings();
      const link = paymentSettings.razorpay_link;
      const amount = Number(paymentSettings.fees_amount || 0);
      if (!link) {
        Alert.alert('Unavailable', 'Payment link is not configured by admin yet.');
        return;
      }
      if (!isValidHttpsUrl(link)) {
        Alert.alert('Invalid Link', 'Payment link must be a valid http/https URL.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        Alert.alert('Invalid Fees', 'Fees amount must be greater than 0.');
        return;
      }

      await addDoc(collection(db, 'payments'), {
        user_id: user.uid,
        user_name: profile.name,
        amount,
        state: 'pending',
        status: 'pending',
        provider: 'razorpay',
        review_mode: 'manual',
        currency: 'INR',
        type: 'fees',
        created_at: serverTimestamp(),
      });
      await createPaymentNotification(profile.name, amount, 'fees');
      const safeUrl = prepareExternalUrl(link);
      if (!safeUrl) {
        Alert.alert('Invalid Link', 'Payment link is invalid.');
        return;
      }
      await Linking.openURL(safeUrl).catch(() => {
        Alert.alert('Payment Link Unavailable', 'Could not open the Razorpay link. Please contact admin for manual payment instructions.');
      });
      Alert.alert('Recorded', 'Your payment attempt was recorded and is pending admin approval.');
    } catch (error) {
      console.log('[About] payFees ERROR', error);
      Alert.alert('Error', 'Could not start fees payment.');
    }
  };

  const donate = async (donationType: 'sadqa' | 'zakat' | 'fitra' | 'langar') => {
    if (!user || !profile) return;
    try {
      const paymentSettings = await getLatestPaymentSettings();
      const link = paymentSettings.razorpay_link;
      const amount = Number(donationAmount || 0);
      if (!link) {
        Alert.alert('Unavailable', 'Payment link is not configured by admin yet.');
        return;
      }
      if (!isValidHttpsUrl(link)) {
        Alert.alert('Invalid Link', 'Payment link must be a valid http/https URL.');
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        setDonationError('Enter a valid donation amount greater than 0.');
        Alert.alert('Invalid Amount', 'Enter a valid donation amount.');
        return;
      }
      setDonationError('');
      await addDoc(collection(db, 'payments'), {
        user_id: user.uid,
        user_name: profile.name,
        amount,
        state: 'pending',
        status: 'pending',
        provider: 'razorpay',
        review_mode: 'manual',
        currency: 'INR',
        type: donationType,
        created_at: serverTimestamp(),
      });
      await createPaymentNotification(profile.name, amount, donationType);
      const safeUrl = prepareExternalUrl(link);
      if (!safeUrl) {
        Alert.alert('Invalid Link', 'Payment link is invalid.');
        return;
      }
      await Linking.openURL(safeUrl).catch(() => {
        Alert.alert('Payment Link Unavailable', 'Could not open the Razorpay link. Please contact admin for manual payment instructions.');
      });
      Alert.alert('Donation Initiated', `${donationType.toUpperCase()} donation recorded and pending admin approval.`);
    } catch (error) {
      console.log('[About] donate ERROR', error);
      Alert.alert('Error', 'Could not start donation right now.');
    }
  };

  const savePaymentSettings = async () => {
    if (!isAdmin) return;
    const link = settings.razorpay_link.trim();
    const feeAmount = Number(settings.fees_amount || 0);
    if (!link) {
      setPaymentError('Razorpay payment link is required.');
      Alert.alert('Missing Link', 'Please set the Razorpay payment link.');
      return;
    }
    if (!isValidHttpsUrl(link)) {
      setPaymentError('Please enter a valid http/https URL.');
      Alert.alert('Invalid Link', 'Please enter a valid payment link URL.');
      return;
    }
    if (!Number.isFinite(feeAmount) || feeAmount <= 0) {
      setPaymentError('Fees amount must be greater than 0.');
      Alert.alert('Invalid Fees', 'Fees amount must be greater than 0.');
      return;
    }
    setPaymentError('');
    await saveSettings();
  };

  const scrollRef = useRef<ScrollView>(null);
  const scrollToAbout = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const safePush = (path: string) => {
    try {
      if (!path) return;
      router.push(path as any);
    } catch {
      // no-op
    }
  };

  const handleSignOutConfirm = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of your account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => { void signOut(); },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.background} />
      
      {/* ─── Hero Header Bar ─── */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>
              {isAdmin ? 'Institutional Administration' : isTeacher ? 'Faculty Services & Profile' : 'Student Services & Profile'}
            </Text>
            <Text style={styles.headerSubtitle}>Madrasatu-s-Salikat Lil Banat • مدرسۃ السالکات للبنات</Text>
          </View>
          <TouchableOpacity
            style={styles.headerSettingBtn}
            onPress={() => safePush('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
          >
            <Ionicons name="settings-outline" size={20} color={THEME.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="about-scroll"
      >
        {profile && (
          <>
            {/* ─── 1. Profile / Identity Card ─── */}
            <View style={styles.premiumProfileCard} testID="user-profile-card">
              <View style={styles.profileHeaderRow}>
                <View style={styles.premiumAvatarContainer}>
                  <Text style={styles.premiumAvatarText}>
                    {(profile.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                  </Text>
                  <View style={styles.avatarRing} />
                </View>
                <View style={styles.profileMainInfo}>
                  <Text style={styles.premiumName}>
                    {profile.name || user?.displayName || (isAdmin ? 'Executive Admin' : isTeacher ? 'Faculty Member' : 'Student')}
                  </Text>
                  <Text style={styles.studentIdText}>
                    {isAdmin ? 'SYS ID' : isTeacher ? 'FACULTY ID' : 'STUDENT ID'}: #{isAdmin ? 'SYS-ADM-' : isTeacher ? 'TCH-' : 'MST-'}{(user?.uid || profile?.uid || '000000').slice(0, 6).toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.premiumBadgesContainer}>
                <View style={[styles.premiumRoleBadge, (isAdmin || isTeacher) && styles.execAdminRoleBadge]}>
                  <Ionicons
                    name={isAdmin ? 'shield-checkmark' : isTeacher ? 'school' : 'person'}
                    size={14}
                    color={isAdmin || isTeacher ? '#FFFFFF' : THEME.gold}
                  />
                  <Text style={[styles.premiumRoleBadgeText, (isAdmin || isTeacher) && styles.execAdminRoleBadgeText]}>
                    {profile.role === 'super_admin' ? 'SUPER ADMIN' : profile.role === 'admin' ? 'ADMINISTRATOR' : isTeacher ? 'FACULTY / USTAADHA' : (profile.role || 'student').toUpperCase()}
                  </Text>
                </View>

                {(profile.status === 'approved' || profile.role === 'admin' || isTeacher) && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={THEME.success} />
                    <Text style={styles.verifiedBadgeText}>Verified</Text>
                  </View>
                )}

                <View style={[
                  styles.premiumStatusBadge,
                  profile.status === 'pending' && styles.premiumStatusPending,
                  (profile.status === 'deactivated' || profile.status === 'rejected' || profile.status === 'suspended') && styles.premiumStatusInactive,
                ]}>
                  <View style={[
                    styles.premiumStatusDot,
                    profile.status === 'pending' && styles.premiumStatusDotPending,
                    (profile.status === 'deactivated' || profile.status === 'rejected' || profile.status === 'suspended') && styles.premiumStatusDotInactive,
                  ]} />
                  <Text style={[
                    styles.premiumStatusText,
                    profile.status === 'pending' && styles.premiumStatusTextPending,
                    (profile.status === 'deactivated' || profile.status === 'rejected' || profile.status === 'suspended') && styles.premiumStatusTextInactive,
                  ]}>
                    {profile.status === 'approved' ? 'Active' : profile.status === 'pending' ? 'Pending' : profile.status === 'deactivated' ? 'Deactivated' : profile.status === 'rejected' ? 'Rejected' : profile.status === 'suspended' ? 'Suspended' : 'Active'}
                  </Text>
                </View>
              </View>

              <View style={styles.premiumDivider} />

              <View style={styles.premiumInfoGrid}>
                <View style={styles.premiumInfoRow}>
                  <Ionicons name="mail-outline" size={18} color={THEME.primary} style={styles.premiumInfoIcon} />
                  <Text style={styles.premiumInfoText} numberOfLines={1}>{profile.email || user?.email || 'No Email Registered'}</Text>
                </View>
                {!!user?.phoneNumber && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="call-outline" size={18} color={THEME.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>{user.phoneNumber}</Text>
                  </View>
                )}
                {!!user?.metadata?.creationTime && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={THEME.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>
                      Enrolled: {new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                )}
                {!!user?.metadata?.lastSignInTime && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="time-outline" size={18} color={THEME.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>
                      Last Active: {new Date(user.metadata.lastSignInTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                )}
                {!!profile.referral_code && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="share-social-outline" size={18} color={THEME.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>Referral Code: {profile.referral_code} • {profile.referral_count || 0} invites</Text>
                  </View>
                )}
                {isAdmin && (
                  <View style={styles.execSummaryBox}>
                    <Text style={styles.execSummaryTitle}>🔐 Active Executive Authorization</Text>
                    <Text style={styles.execSummaryText}>
                      Full Administrative Access: LMS Coursework, User Database, Live Class Broadcasting, Payments & Security.
                    </Text>
                  </View>
                )}
                {isTeacher && (
                  <View style={[styles.execSummaryBox, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                    <Text style={[styles.execSummaryTitle, { color: THEME.primary }]}>📚 Faculty Instructional Authorization</Text>
                    <Text style={[styles.execSummaryText, { color: THEME.textMain }]}>
                      Authorized for Course Syllabus, Live Streaming, Daily Attendance Logging, and Student Assessments.
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {isAdmin ? (
              /* ─── Admin Overview ─── */
              <View style={styles.statsSectionContainer}>
                <Text style={styles.sectionSubtitleText}>🛡️ Executive Control Overview</Text>
                <View style={styles.execPermissionsCard}>
                  <View style={styles.execPermHeader}>
                    <Ionicons name="key" size={18} color={THEME.primary} />
                    <Text style={styles.execPermTitle}>Platform Permissions</Text>
                  </View>
                  <Text style={styles.execPermDesc}>
                    Authenticated with executive root privileges across the MSLB educational infrastructure.
                  </Text>
                  <View style={styles.execPermGrid}>
                    <View style={styles.execPermChip}><Ionicons name="people" size={13} color="#1565C0" /><Text style={styles.execPermChipText}>User Control</Text></View>
                    <View style={styles.execPermChip}><Ionicons name="school" size={13} color="#2E7D32" /><Text style={styles.execPermChipText}>Academics</Text></View>
                    <View style={styles.execPermChip}><Ionicons name="videocam" size={13} color="#E65100" /><Text style={styles.execPermChipText}>Live Streams</Text></View>
                    <View style={styles.execPermChip}><Ionicons name="analytics" size={13} color="#6A1B9A" /><Text style={styles.execPermChipText}>Financials</Text></View>
                  </View>
                </View>

                <Text style={[styles.sectionSubtitleText, { marginTop: SPACING.md }]}>⚡ Quick Administration</Text>
                <View style={styles.statsGrid}>
                  <TouchableOpacity style={styles.statCardItem} onPress={() => safePush('/admin/users')} accessibilityRole="button" accessibilityLabel="User Roster">
                    <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                      <Ionicons name="people" size={20} color="#4F46E5" />
                    </View>
                    <Text style={styles.statCardValue}>Users</Text>
                    <Text style={styles.statCardLabel}>Roster Control</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statCardItem} onPress={() => safePush('/admin/manage-academics')} accessibilityRole="button" accessibilityLabel="Academic Management">
                    <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="school" size={20} color="#10B981" />
                    </View>
                    <Text style={styles.statCardValue}>LMS</Text>
                    <Text style={styles.statCardLabel}>Courses & Teachers</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statCardItem} onPress={() => safePush('/admin/analytics')} accessibilityRole="button" accessibilityLabel="Analytics Dashboard">
                    <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                      <Ionicons name="stats-chart" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.statCardValue}>Audit</Text>
                    <Text style={styles.statCardLabel}>System Analytics</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statCardItem} onPress={() => safePush('/admin/security')} accessibilityRole="button" accessibilityLabel="Security Diagnostics">
                    <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
                    </View>
                    <Text style={styles.statCardValue}>Security</Text>
                    <Text style={styles.statCardLabel}>Health Check</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : isTeacher ? (
              <>
                {/* ─── 2A. Teacher Teaching Overview (Clickable Live Data) ─── */}
                <View style={styles.statsSectionContainer}>
                  <Text style={styles.sectionSubtitleText}>📖 Teaching Workspace Overview</Text>
                  <View style={styles.statsGrid}>
                    <TouchableOpacity
                      style={styles.statCardItem}
                      onPress={() => safePush('/(tabs)/courses')}
                      accessibilityRole="button"
                      accessibilityLabel="My Courses"
                    >
                      <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="book" size={20} color={THEME.primary} />
                      </View>
                      <Text style={styles.statCardValue}>{myAssignedCoursesCount}</Text>
                      <Text style={styles.statCardLabel}>My Courses</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCardItem}
                      onPress={() => safePush('/live-class')}
                      accessibilityRole="button"
                      accessibilityLabel="Live Classes"
                    >
                      <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="videocam" size={20} color="#D97706" />
                      </View>
                      <Text style={styles.statCardValue}>{teacherLiveCount}</Text>
                      <Text style={styles.statCardLabel}>Live Classes</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCardItem}
                      onPress={() => safePush('/attendance')}
                      accessibilityRole="button"
                      accessibilityLabel="Attendance Log"
                    >
                      <View style={[styles.statIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="people" size={20} color="#2563EB" />
                      </View>
                      <Text style={styles.statCardValue}>{teacherAttendanceCount}</Text>
                      <Text style={styles.statCardLabel}>Today's Attendance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.statCardItem}
                      onPress={() => safePush('/(tabs)/quiz')}
                      accessibilityRole="button"
                      accessibilityLabel="Submissions"
                    >
                      <View style={[styles.statIconBox, { backgroundColor: '#FDF2F8' }]}>
                        <Ionicons name="clipboard" size={20} color="#DB2777" />
                      </View>
                      <Text style={styles.statCardValue}>{teacherSubmissionsCount}</Text>
                      <Text style={styles.statCardLabel}>Submissions</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* ─── 2B. Personal Academic Performance & Stats (Preserved) ─── */}
                <View style={styles.statsSectionContainer}>
                  <Text style={styles.sectionSubtitleText}>📊 Institutional Curriculum Stats</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="school-outline" size={20} color="#4F46E5" />
                      </View>
                      <Text style={styles.statCardValue}>{totalCoursesCount}</Text>
                      <Text style={styles.statCardLabel}>Total Courses</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                      </View>
                      <Text style={styles.statCardValue}>{lessonsCompletedCount}</Text>
                      <Text style={styles.statCardLabel}>Lessons Done</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="help-circle-outline" size={20} color="#D97706" />
                      </View>
                      <Text style={styles.statCardValue}>{quizzesCompletedCount}</Text>
                      <Text style={styles.statCardLabel}>Quizzes Passed</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                        <Ionicons name="library-outline" size={20} color="#7C3AED" />
                      </View>
                      <Text style={styles.statCardValue}>{totalBooksCount}</Text>
                      <Text style={styles.statCardLabel}>Library Books</Text>
                    </View>
                  </View>
                </View>

                {/* ─── 3. Earned Achievements (Preserved) ─── */}
                <View style={styles.statsSectionContainer}>
                  <Text style={styles.sectionSubtitleText}>🏆 Faculty Honors & Badges</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
                    <View style={styles.badgeCard}>
                      <View style={[styles.badgeIconBox, { backgroundColor: '#10B98118' }]}>
                        <Ionicons name="school" size={22} color="#10B981" />
                      </View>
                      <Text style={styles.badgeTitle} numberOfLines={1}>Faculty Member</Text>
                      <Text style={styles.badgeDesc} numberOfLines={2}>Verified Islamic educator at MSLB</Text>
                    </View>
                    {earnedBadges.map((b) => (
                      <View key={b.id} style={styles.badgeCard}>
                        <View style={[styles.badgeIconBox, { backgroundColor: b.color + '18' }]}>
                          <Ionicons name={b.icon as any} size={22} color={b.color} />
                        </View>
                        <Text style={styles.badgeTitle} numberOfLines={1}>{b.title}</Text>
                        <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </>
            ) : (
              <>
                {/* ─── 2. Academic Performance & Stats (2x2 Balanced Grid) ─── */}
                <View style={styles.statsSectionContainer}>
                  <Text style={styles.sectionSubtitleText}>📊 Academic Performance</Text>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="book" size={20} color="#4F46E5" />
                      </View>
                      <Text style={styles.statCardValue}>{totalCoursesCount}</Text>
                      <Text style={styles.statCardLabel}>Courses</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      </View>
                      <Text style={styles.statCardValue}>{lessonsCompletedCount}</Text>
                      <Text style={styles.statCardLabel}>Lessons Done</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="help-circle" size={20} color="#D97706" />
                      </View>
                      <Text style={styles.statCardValue}>{quizzesCompletedCount}</Text>
                      <Text style={styles.statCardLabel}>Quizzes Passed</Text>
                    </View>
                    <View style={styles.statCardItem}>
                      <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                        <Ionicons name="library" size={20} color="#7C3AED" />
                      </View>
                      <Text style={styles.statCardValue}>{totalBooksCount}</Text>
                      <Text style={styles.statCardLabel}>Library Books</Text>
                    </View>
                  </View>
                </View>

                {/* ─── 3. Earned Achievements ─── */}
                <View style={styles.statsSectionContainer}>
                  <Text style={styles.sectionSubtitleText}>🏆 Earned Badges & Badges</Text>
                  {earnedBadges.length === 0 ? (
                    <View style={styles.emptyBadgesCard}>
                      <Ionicons name="trophy-outline" size={28} color={THEME.textMuted} />
                      <Text style={styles.emptyBadgesTitle}>Start Learning to Earn Badges!</Text>
                      <Text style={styles.emptyBadgesDesc}>Complete lessons and quiz assessments to unlock Islamic student honors.</Text>
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
                      {earnedBadges.map((b) => (
                        <View key={b.id} style={styles.badgeCard}>
                          <View style={[styles.badgeIconBox, { backgroundColor: b.color + '18' }]}>
                            <Ionicons name={b.icon as any} size={22} color={b.color} />
                          </View>
                          <Text style={styles.badgeTitle} numberOfLines={1}>{b.title}</Text>
                          <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </>
            )}

            {/* ─── 4. Quick Actions (Categorized 2-Column Responsive Grid) ─── */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsTitle}>⚡ Quick Actions</Text>

              <Text style={styles.quickActionCategoryTitle}>{isTeacher ? 'Teaching & Academics' : 'Academic Services'}</Text>
              <View style={styles.quickActionsGrid}>
                {isTeacher ? (
                  <>
                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/courses')}
                      accessibilityRole="button"
                      accessibilityLabel="My Courses, Manage syllabus"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="book-outline" size={20} color={THEME.primary} />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Assigned Courses</Text>
                        <Text style={styles.quickActionSubText}>Manage Syllabus</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/live-class')}
                      accessibilityRole="button"
                      accessibilityLabel="Live Classroom, Host live session"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                        <Ionicons name="videocam-outline" size={20} color="#2563EB" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Live Classroom</Text>
                        <Text style={styles.quickActionSubText}>Host & Stream</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/attendance')}
                      accessibilityRole="button"
                      accessibilityLabel="Attendance, Mark daily presence"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#F0FDF4' }]}>
                        <Ionicons name="checkbox-outline" size={20} color="#16A34A" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Mark Attendance</Text>
                        <Text style={styles.quickActionSubText}>Daily Presence</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/quiz')}
                      accessibilityRole="button"
                      accessibilityLabel="Student Evaluations, Review quizzes"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FDF2F8' }]}>
                        <Ionicons name="clipboard-outline" size={20} color="#DB2777" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Evaluations</Text>
                        <Text style={styles.quickActionSubText}>Review Quizzes</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/library')}
                      accessibilityRole="button"
                      accessibilityLabel="Library, Islamic Books"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="library-outline" size={20} color="#4F46E5" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Islamic Library</Text>
                        <Text style={styles.quickActionSubText}>Reference Texts</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.quickActionCard, styles.quickActionHighlight]}
                      onPress={() => safePush('/payment')}
                      accessibilityRole="button"
                      accessibilityLabel="Pay Fees, Course & Support"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="card-outline" size={20} color="#D97706" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Pay Fees</Text>
                        <Text style={styles.quickActionSubText}>Fee & Donations</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.quickActionCard, styles.quickActionHighlight]}
                      onPress={() => safePush('/payment')}
                      accessibilityRole="button"
                      accessibilityLabel="Pay Fees, Course & Support"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                        <Ionicons name="card-outline" size={20} color="#D97706" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Pay Fees</Text>
                        <Text style={styles.quickActionSubText}>Fee & Donations</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/courses')}
                      accessibilityRole="button"
                      accessibilityLabel="My Courses, Continue learning"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                        <Ionicons name="book-outline" size={20} color={THEME.primary} />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>My Courses</Text>
                        <Text style={styles.quickActionSubText}>Study materials</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/library')}
                      accessibilityRole="button"
                      accessibilityLabel="Library, Islamic Books"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="library-outline" size={20} color="#4F46E5" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Library</Text>
                        <Text style={styles.quickActionSubText}>Islamic Books</Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.quickActionCard}
                      onPress={() => safePush('/(tabs)/quiz')}
                      accessibilityRole="button"
                      accessibilityLabel="Quiz History, View Results"
                    >
                      <View style={[styles.quickActionIconWrapper, { backgroundColor: '#F5F3FF' }]}>
                        <Ionicons name="help-circle-outline" size={20} color="#7C3AED" />
                      </View>
                      <View style={styles.quickActionContent}>
                        <Text style={styles.quickActionText}>Quiz & Certificates</Text>
                        <Text style={styles.quickActionSubText}>Test & Results</Text>
                      </View>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <Text style={styles.quickActionCategoryTitle}>Faith & Tools</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={() => safePush('/prayer-times')}
                  accessibilityRole="button"
                  accessibilityLabel="Prayer Times, Today's Salah"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#E0F2FE' }]}>
                    <Ionicons name="time-outline" size={20} color="#0284C7" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>Prayer Times</Text>
                    <Text style={styles.quickActionSubText}>Salah Schedule</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={() => safePush('/qibla')}
                  accessibilityRole="button"
                  accessibilityLabel="Qibla, Kaaba Direction"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="compass-outline" size={20} color="#D97706" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>Qibla Finder</Text>
                    <Text style={styles.quickActionSubText}>Kaaba Direction</Text>
                  </View>
                </TouchableOpacity>
              </View>

              <Text style={styles.quickActionCategoryTitle}>{isTeacher ? 'Communication & Account' : 'Account & Services'}</Text>
              <View style={styles.quickActionsGrid}>
                {isTeacher && (
                  <TouchableOpacity
                    style={styles.quickActionCard}
                    onPress={() => safePush('/(tabs)/chats')}
                    accessibilityRole="button"
                    accessibilityLabel="Faculty Chat, Direct Messages"
                  >
                    <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FAF5FF' }]}>
                      <Ionicons name="chatbubbles-outline" size={20} color="#9333EA" />
                    </View>
                    <View style={styles.quickActionContent}>
                      <Text style={styles.quickActionText}>Faculty Chat</Text>
                      <Text style={styles.quickActionSubText}>1-on-1 Messages</Text>
                    </View>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={() => safePush('/(tabs)/notifications')}
                  accessibilityRole="button"
                  accessibilityLabel="Notifications, Recent updates"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="notifications-outline" size={20} color="#4F46E5" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>Notifications</Text>
                    <Text style={styles.quickActionSubText}>Announcements</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={() => safePush('/settings')}
                  accessibilityRole="button"
                  accessibilityLabel="Settings, Manage Account"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="settings-outline" size={20} color={THEME.textMain} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>Settings</Text>
                    <Text style={styles.quickActionSubText}>Preferences & Security</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={openHelp}
                  accessibilityRole="button"
                  accessibilityLabel="Help, Support"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="logo-whatsapp" size={20} color="#10B981" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>WhatsApp Help</Text>
                    <Text style={styles.quickActionSubText}>Official Support</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={() => Linking.openURL(MADRASA_WEBSITE_URL)}
                  accessibilityRole="button"
                  accessibilityLabel="Official Website, Visit Web Portal"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#E0E7FF' }]}>
                    <Ionicons name="globe-outline" size={20} color="#4338CA" />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>Web Portal</Text>
                    <Text style={styles.quickActionSubText}>Official Website</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickActionCard}
                  onPress={scrollToAbout}
                  accessibilityRole="button"
                  accessibilityLabel="About, Madrasa Info"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEF9EE' }]}>
                    <Ionicons name="information-circle-outline" size={20} color={THEME.gold} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={styles.quickActionText}>About Madrasa</Text>
                    <Text style={styles.quickActionSubText}>Mission & Info</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickActionCard, styles.logoutQuickActionCard]}
                  onPress={handleSignOutConfirm}
                  accessibilityRole="button"
                  accessibilityLabel="Logout, Sign out"
                >
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="log-out-outline" size={20} color={THEME.error} />
                  </View>
                  <View style={styles.quickActionContent}>
                    <Text style={[styles.quickActionText, { color: THEME.error }]}>Sign Out</Text>
                    <Text style={[styles.quickActionSubText, { color: THEME.error + 'AA' }]}>End session</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ─── 5. Admin Controls (Role Protected) ─── */}
        {isAdmin && (
          <View style={styles.adminCard} testID="admin-controls">
            <View style={styles.adminTitleRow}>
              <Ionicons name="shield-checkmark" size={18} color={THEME.primary} />
              <Text style={styles.adminTitle}>Administrative Tools</Text>
            </View>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/users')} testID="manage-users-btn">
              <Ionicons name="people-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Manage Users Roster</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/add-book')} testID="admin-add-book-link">
              <Ionicons name="book-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Add Library Book</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/manage-academics')} testID="manage-academics-btn">
              <Ionicons name="school-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Manage Teachers & Courses</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/payments')} testID="manage-payments-btn">
              <Ionicons name="card-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Manage Payments & Audits</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/privacy-requests')} testID="privacy-requests-btn">
              <Ionicons name="shield-checkmark-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Privacy & Deletion Requests</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/analytics')}>
              <Ionicons name="stats-chart-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Analytics & Health Dashboard</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/send-push')} testID="send-push-btn">
              <Ionicons name="notifications-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Send Push Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/moderation')} testID="moderation-btn">
              <Ionicons name="flag-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Community Moderation Queue</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/security')} testID="security-btn">
              <Ionicons name="shield-outline" size={20} color={THEME.primary} />
              <Text style={styles.adminItemText}>Security Diagnostics</Text>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.exportBlock}>
              <Text style={styles.subTitle}>Database Data Export</Text>
              <Text style={styles.bodyText}>
                Export clean JSON backups of Firestore collections directly:
              </Text>
              <View style={styles.exportRow}>
                {(['users', 'courses', 'payments', 'feedback'] as const).map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.secondaryBtn, styles.exportBtn]}
                    onPress={() => exportCollection(name)}
                    disabled={!!exportingCollection}
                    accessibilityRole="button"
                    accessibilityLabel={`Export ${name} collection`}
                  >
                    {exportingCollection === name ? (
                      <ActivityIndicator size="small" color={THEME.primary} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Export {name}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── 6. Fee Management & Payments ─── */}
        {!isAdmin ? (
          <SectionCard title="Fee Management & Payments" icon="wallet-outline">
            <Text style={styles.bodyText}>Secure and direct payment of academic fees and voluntary Islamic contributions.</Text>
            <View style={styles.feeOverviewCard}>
              <View style={styles.feeOverviewRow}>
                <Text style={styles.feeLabelText}>Current Academic Fee</Text>
                <Text style={styles.feeAmountText}>₹{Number(settings.fees_amount || 0).toFixed(2)}</Text>
              </View>
              {myPayments[0] ? (
                <View style={[styles.statusCard, { marginVertical: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? "checkmark-circle" : "time"}
                      size={16}
                      color={paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? THEME.success : THEME.gold}
                    />
                    <Text style={styles.statusLabel}>Latest Payment Status</Text>
                  </View>
                  <Text style={[styles.statusValue, { color: paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? THEME.success : THEME.gold }]}>
                    {paymentState(myPayments[0]).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push('/payment')}
              testID="open-unified-payment-btn"
              accessibilityRole="button"
              accessibilityLabel="Open Payment Flow"
            >
              <Ionicons name="card-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Open Unified Payment Flow</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : (
          <>
            <SectionCard title="Pay Fees (Razorpay Link)" icon="card-outline">
              <Text style={styles.bodyText}>Current Configured Fees: ₹{Number(settings.fees_amount || 0).toFixed(2)}</Text>
              {myPayments[0] && (
                <View style={styles.statusCard}>
                  <Text style={styles.statusLabel}>Latest Payment Status</Text>
                  <Text style={styles.statusValue}>{paymentState(myPayments[0])}</Text>
                </View>
              )}
              <TouchableOpacity style={styles.primaryBtn} onPress={payFees} testID="pay-fees-btn" accessibilityRole="button" accessibilityLabel="Pay Fees">
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Test Pay Fees</Text>
              </TouchableOpacity>
              
              <View style={{ marginTop: 14, gap: 8 }}>
                <Text style={styles.subTitle}>Admin Fee Configuration</Text>
                <Text style={styles.inputLabel}>Monthly Fee Amount (INR)</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'fees_amount' && styles.inputFocused]}
                  placeholder="Fees amount (e.g. 1500)"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                  value={String(settings.fees_amount || '')}
                  onChangeText={(v) => setSettings((p) => ({ ...p, fees_amount: Number(v || 0) }))}
                  onFocus={() => setFocusedInput('fees_amount')}
                  onBlur={() => setFocusedInput(null)}
                />
                <Text style={styles.inputLabel}>Razorpay Payment Link</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'razorpay_link' && styles.inputFocused]}
                  placeholder="Razorpay Payment Link (https://...)"
                  placeholderTextColor={THEME.textMuted}
                  value={settings.razorpay_link}
                  onChangeText={(v) => setSettings((p) => ({ ...p, razorpay_link: v }))}
                  autoCapitalize="none"
                  keyboardType="url"
                  onFocus={() => setFocusedInput('razorpay_link')}
                  onBlur={() => setFocusedInput(null)}
                />
                {paymentError ? <Text style={styles.inputError}>{paymentError}</Text> : null}
                <TouchableOpacity style={styles.secondaryBtn} onPress={savePaymentSettings} accessibilityRole="button" accessibilityLabel="Save Payment Settings">
                  <Text style={styles.secondaryBtnText}>Save Fee Settings</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>

            <SectionCard title="Donations (Voluntary Contributions)" icon="heart-outline">
              <Text style={styles.bodyText}>{settings.donation_content}</Text>
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Editable Donation Appeal</Text>
              <TextInput
                style={[styles.input, styles.textArea, focusedInput === 'donation_content' && styles.inputFocused]}
                placeholder="Write donation appeal content..."
                placeholderTextColor={THEME.textMuted}
                value={settings.donation_content}
                onChangeText={(v) => setSettings((p) => ({ ...p, donation_content: v }))}
                multiline
                onFocus={() => setFocusedInput('donation_content')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Donation Amount</Text>
              <TextInput
                style={[styles.input, focusedInput === 'donation_amount' && styles.inputFocused]}
                placeholder="Enter amount (₹)"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
                value={donationAmount}
                onChangeText={setDonationAmount}
                onFocus={() => setFocusedInput('donation_amount')}
                onBlur={() => setFocusedInput(null)}
              />
              {donationError ? <Text style={styles.inputError}>{donationError}</Text> : null}
              <View style={styles.row}>
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('sadqa')} accessibilityRole="button" accessibilityLabel="Donate Sadqa">
                  <Text style={styles.primaryBtnSmallText}>Donate Sadqa</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('zakat')} accessibilityRole="button" accessibilityLabel="Donate Zakat">
                  <Text style={styles.primaryBtnSmallText}>Donate Zakat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('fitra')} accessibilityRole="button" accessibilityLabel="Donate Fitra">
                  <Text style={styles.primaryBtnSmallText}>Donate Fitra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('langar')} accessibilityRole="button" accessibilityLabel="Donate Langar">
                  <Text style={styles.primaryBtnSmallText}>Donate Langar</Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          </>
        )}

        {/* ─── 7. Feedback & Community Testimonials ─── */}
        <SectionCard title="Feedback & Testimonials" icon="chatbox-ellipses-outline">
          {mySubmittedFeedback.length > 0 ? (
            <View style={styles.mySubmittedFeedbackCard}>
              <View style={styles.submittedHeader}>
                <View style={styles.submittedBadge}>
                  <Ionicons name="checkmark-done" size={16} color={THEME.success} />
                  <Text style={styles.submittedBadgeText}>Submitted</Text>
                </View>
                <Text style={styles.submittedDate}>
                  {mySubmittedFeedback[0].created_at ? new Date(mySubmittedFeedback[0].created_at).toLocaleDateString() : 'Recent'}
                </Text>
              </View>
              <Text style={styles.submittedMsgText}>{mySubmittedFeedback[0].message}</Text>
              {mySubmittedFeedback[0].rating ? (
                <Text style={styles.feedbackRating}>Rating: {mySubmittedFeedback[0].rating}/5 ⭐</Text>
              ) : null}
              <Text style={styles.submittedNote}>Your feedback has been received and reviewed by administration.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Feedback Message</Text>
              <TextInput
                style={[styles.input, styles.textArea, focusedInput === 'feedback_message' && styles.inputFocused]}
                placeholder="Share your experience with Madrasatu-s-Salikat..."
                placeholderTextColor={THEME.textMuted}
                value={fbMessage}
                onChangeText={setFbMessage}
                multiline
                onFocus={() => setFocusedInput('feedback_message')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 10 }]}>Rating (1 to 5 Stars - Optional)</Text>
              <TextInput
                style={[styles.input, focusedInput === 'feedback_rating' && styles.inputFocused]}
                placeholder="Rating 1-5"
                placeholderTextColor={THEME.textMuted}
                keyboardType="numeric"
                value={fbRating}
                onChangeText={setFbRating}
                onFocus={() => setFocusedInput('feedback_rating')}
                onBlur={() => setFocusedInput(null)}
              />
              {feedbackError ? <Text style={styles.inputError}>{feedbackError}</Text> : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={submitFeedback} testID="submit-feedback-btn" accessibilityRole="button" accessibilityLabel="Submit Feedback">
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Submit Feedback</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.subTitle, { marginTop: 16 }]}>Student Testimonials</Text>
          {testimonials.length === 0 ? <Text style={styles.bodyText}>No student testimonials yet.</Text> : null}
          {testimonials.map((item) => (
            <View key={item.id} style={styles.feedbackCard}>
              <View style={styles.feedbackHeaderRow}>
                <Text style={styles.feedbackName}>{item.user_name}</Text>
                {item.rating ? <Text style={styles.feedbackRating}>{item.rating} ★</Text> : null}
              </View>
              {editingFeedbackId === item.id ? (
                <>
                  <Text style={styles.inputLabel}>Edit Feedback</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, focusedInput === 'edit_feedback' && styles.inputFocused]}
                    value={editingFeedbackMsg}
                    onChangeText={setEditingFeedbackMsg}
                    multiline
                    onFocus={() => setFocusedInput('edit_feedback')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  <TouchableOpacity style={styles.secondaryBtn} onPress={saveFeedbackEdit} accessibilityRole="button" accessibilityLabel="Save Feedback Edit">
                    <Text style={styles.secondaryBtnText}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.feedbackMsg}>{item.message}</Text>
              )}
              {isAdmin && editingFeedbackId !== item.id && (
                <View style={styles.feedbackActions}>
                  <TouchableOpacity onPress={() => { setEditingFeedbackId(item.id); setEditingFeedbackMsg(item.message); }} accessibilityRole="button" accessibilityLabel="Edit Feedback">
                    <Text style={styles.actionLink}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteFeedback(item.id)} accessibilityRole="button" accessibilityLabel="Delete Feedback">
                    <Text style={[styles.actionLink, { color: THEME.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </SectionCard>

        {/* ─── 8. About Madrasa Section ─── */}
        <AboutMadrasaSection
          aboutMadrasa={settings.about_madrasa}
          isAdmin={isAdmin}
          onSaved={handleAboutSaved}
        />

        {/* ─── 9. Account Security & Privacy ─── */}
        <SectionCard title="Account Security & Privacy" icon="shield-checkmark-outline">
          <View style={styles.securityList}>
            <TouchableOpacity
              style={styles.securityRow}
              onPress={() => safePush('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Account Settings and Security"
            >
              <View style={styles.securityIconBox}><Ionicons name="key-outline" size={18} color={THEME.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.securityRowTitle}>Account Settings & Security</Text>
                <Text style={styles.securityRowSub}>Manage PIN, app lock, and cache</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.securityRow}
              onPress={() => safePush('/privacy')}
              accessibilityRole="button"
              accessibilityLabel="Privacy Policy"
            >
              <View style={styles.securityIconBox}><Ionicons name="document-lock-outline" size={18} color={THEME.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.securityRowTitle}>Privacy Policy</Text>
                <Text style={styles.securityRowSub}>Review data protection policies</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.securityRow}
              onPress={() => safePush('/data-privacy')}
              accessibilityRole="button"
              accessibilityLabel="Data and Privacy Controls"
            >
              <View style={styles.securityIconBox}><Ionicons name="trash-bin-outline" size={18} color={THEME.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.securityRowTitle}>Data & Privacy Controls</Text>
                <Text style={styles.securityRowSub}>Manage data export or request deletion</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={[styles.securityRow, { paddingVertical: 12 }]}
              onPress={handleSignOutConfirm}
              accessibilityRole="button"
              accessibilityLabel="Sign Out of Session"
            >
              <View style={[styles.securityIconBox, { backgroundColor: THEME.errorBg }]}>
                <Ionicons name="log-out-outline" size={18} color={THEME.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.securityRowTitle, { color: THEME.error }]}>Sign Out of Session</Text>
                <Text style={styles.securityRowSub}>Safely log out of your account on this phone</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={THEME.textMuted} />
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ─── 10. Social & Official Channels ─── */}
        <SectionCard title="Official Social & Support" icon="globe-outline">
          {isAdmin ? (
            <>
              <Text style={styles.inputLabel}>WhatsApp Channel Link</Text>
              <TextInput
                style={[styles.input, focusedInput === 'social_channel' && styles.inputFocused]}
                placeholder="WhatsApp Channel Link"
                placeholderTextColor={THEME.textMuted}
                value={settings.whatsapp_channel}
                onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_channel: v }))}
                keyboardType="url"
                onFocus={() => setFocusedInput('social_channel')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>WhatsApp Contact</Text>
              <TextInput
                style={[styles.input, focusedInput === 'social_contact' && styles.inputFocused]}
                placeholder="WhatsApp Contact URL or Phone"
                placeholderTextColor={THEME.textMuted}
                value={settings.whatsapp_contact}
                onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_contact: v }))}
                keyboardType="url"
                onFocus={() => setFocusedInput('social_contact')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Instagram Link</Text>
              <TextInput
                style={[styles.input, focusedInput === 'social_instagram' && styles.inputFocused]}
                placeholder="Instagram Link"
                placeholderTextColor={THEME.textMuted}
                value={settings.instagram}
                onChangeText={(v) => setSettings((p) => ({ ...p, instagram: v }))}
                keyboardType="url"
                onFocus={() => setFocusedInput('social_instagram')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>YouTube Link</Text>
              <TextInput
                style={[styles.input, focusedInput === 'social_youtube' && styles.inputFocused]}
                placeholder="YouTube Link"
                placeholderTextColor={THEME.textMuted}
                value={settings.youtube_link}
                onChangeText={(v) => setSettings((p) => ({ ...p, youtube_link: v }))}
                keyboardType="url"
                onFocus={() => setFocusedInput('social_youtube')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={[styles.inputLabel, { marginTop: 8 }]}>Telegram Link</Text>
              <TextInput
                style={[styles.input, focusedInput === 'social_telegram' && styles.inputFocused]}
                placeholder="Telegram Link"
                placeholderTextColor={THEME.textMuted}
                value={settings.telegram_link}
                onChangeText={(v) => setSettings((p) => ({ ...p, telegram_link: v }))}
                keyboardType="url"
                onFocus={() => setFocusedInput('social_telegram')}
                onBlur={() => setFocusedInput(null)}
              />
              {socialError ? <Text style={styles.inputError}>{socialError}</Text> : null}
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveSocialSettings} accessibilityRole="button" accessibilityLabel="Save Social Links">
                <Text style={styles.secondaryBtnText}>Save Social Links</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ marginTop: 4, gap: 10 }}>
              <TouchableOpacity
                style={styles.premiumSocialBtn}
                onPress={() => { void openSocialLink(normalizeWhatsAppUrl(settings.whatsapp_channel) || settings.whatsapp_channel, 'WhatsApp Channel'); }}
                accessibilityRole="button"
                accessibilityLabel="Open WhatsApp Channel"
              >
                <View style={[styles.socialIconContainer, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="logo-whatsapp" size={18} color="#10B981" />
                </View>
                <Text style={styles.premiumSocialBtnText}>WhatsApp Channel</Text>
                <Ionicons name="open-outline" size={16} color={THEME.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.premiumSocialBtn}
                onPress={() => { void openSocialLink(settings.instagram, 'Instagram'); }}
                accessibilityRole="button"
                accessibilityLabel="Open Instagram Profile"
              >
                <View style={[styles.socialIconContainer, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="logo-instagram" size={18} color="#DB2777" />
                </View>
                <Text style={styles.premiumSocialBtnText}>Instagram</Text>
                <Ionicons name="open-outline" size={16} color={THEME.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.premiumSocialBtn}
                onPress={() => { void openSocialLink(settings.youtube_link, 'YouTube'); }}
                accessibilityRole="button"
                accessibilityLabel="Open YouTube Channel"
              >
                <View style={[styles.socialIconContainer, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="logo-youtube" size={18} color="#EF4444" />
                </View>
                <Text style={styles.premiumSocialBtnText}>YouTube</Text>
                <Ionicons name="open-outline" size={16} color={THEME.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.premiumSocialBtn}
                onPress={() => { void openSocialLink(settings.telegram_link, 'Telegram'); }}
                accessibilityRole="button"
                accessibilityLabel="Open Telegram Channel"
              >
                <View style={[styles.socialIconContainer, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="paper-plane" size={18} color="#2563EB" />
                </View>
                <Text style={styles.premiumSocialBtnText}>Telegram</Text>
                <Ionicons name="open-outline" size={16} color={THEME.textMuted} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.premiumSocialBtn, { borderColor: THEME.primary, backgroundColor: '#E8F5EE' }]}
                onPress={openHelp}
                accessibilityRole="button"
                accessibilityLabel="Open WhatsApp Support"
              >
                <View style={[styles.socialIconContainer, { backgroundColor: THEME.primary }]}>
                  <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                </View>
                <Text style={[styles.premiumSocialBtnText, { color: THEME.primary, fontWeight: '800' }]}>Direct WhatsApp Support</Text>
                <Ionicons name="arrow-forward" size={16} color={THEME.primary} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.row, { marginTop: 14 }]}>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={shareApp} testID="share-app-btn" accessibilityRole="button" accessibilityLabel="Share App with Friends">
              <Ionicons name="share-social-outline" size={16} color={THEME.gold} />
              <Text style={styles.primaryBtnSmallText}>Share App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={openHelp} testID="help-btn" accessibilityRole="button" accessibilityLabel="Get Help on WhatsApp">
              <Ionicons name="help-buoy-outline" size={16} color={THEME.gold} />
              <Text style={styles.primaryBtnSmallText}>Help & Support</Text>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* ─── 11. Daily Islamic Inspiration ─── */}
        <View style={styles.inspirationCard} testID="bismillah-section">
          <View style={styles.inspirationHeaderRow}>
            <View style={styles.inspirationBadge}>
              <Ionicons name="sparkles" size={14} color={THEME.gold} />
              <Text style={styles.inspirationBadgeText}>{ISLAMIC_INSPIRATIONS[inspirationIdx].type}</Text>
            </View>
            <TouchableOpacity
              onPress={rotateInspiration}
              style={styles.inspirationRotateBtn}
              accessibilityRole="button"
              accessibilityLabel="Next Islamic Inspiration"
            >
              <Ionicons name="refresh" size={15} color={THEME.gold} />
              <Text style={styles.inspirationRotateText}>New Quote</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
          <Text style={styles.inspirationArabic}>{ISLAMIC_INSPIRATIONS[inspirationIdx].arabic}</Text>
          <Text style={styles.inspirationTranslation}>&quot;{ISLAMIC_INSPIRATIONS[inspirationIdx].translation}&quot;</Text>
          <Text style={styles.inspirationSource}>— {ISLAMIC_INSPIRATIONS[inspirationIdx].source}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  header: {
    backgroundColor: THEME.surface,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    ...SHADOWS.header,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textMain,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },
  headerSettingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
    gap: 20,
  },
  sectionCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...SHADOWS.card,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  sectionCardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textMain,
    flex: 1,
  },
  goldAccent: {
    height: 2.5,
    backgroundColor: THEME.gold,
    width: 28,
    borderRadius: 2,
    marginBottom: 16,
    marginTop: 6,
    opacity: 0.8,
  },
  bodyText: {
    fontSize: 14,
    color: THEME.textMuted,
    lineHeight: 22,
  },
  subTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textMain,
    marginBottom: 4,
  },
  input: {
    backgroundColor: THEME.surfaceAlt,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: THEME.textMain,
    fontSize: 14,
  },
  inputFocused: {
    borderColor: THEME.primary,
    backgroundColor: THEME.surface,
  },
  inputError: {
    color: THEME.error,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  inputWarning: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  aboutTextArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  primaryBtn: {
    backgroundColor: THEME.primary,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    minHeight: 52,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  primaryBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.goldBg,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: THEME.goldBorder,
    gap: 6,
    minHeight: 48,
  },
  primaryBtnSmallText: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    minHeight: 48,
  },
  secondaryBtnText: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  premiumSocialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 52,
  },
  premiumSocialBtnText: {
    color: THEME.textMain,
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 12,
  },
  socialIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 12,
  },
  statusLabel: {
    fontSize: 11,
    color: THEME.textMuted,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    backgroundColor: THEME.surfaceAlt,
    gap: 4,
  },
  feedbackHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedbackName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMain,
  },
  feedbackMsg: {
    fontSize: 13,
    color: THEME.textMuted,
    lineHeight: 18,
  },
  feedbackRating: {
    fontSize: 12,
    color: THEME.gold,
    fontWeight: '700',
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  actionLink: {
    fontSize: 12,
    color: THEME.primary,
    fontWeight: '700',
  },
  bismillah: {
    fontSize: 22,
    color: THEME.primary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  
  // Premium Profile Card
  premiumProfileCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    gap: 16,
  },
  profileMainInfo: {
    flex: 1,
  },
  premiumAvatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.goldBg,
    borderWidth: 2,
    borderColor: THEME.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumAvatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.primary,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: THEME.goldBorder,
    opacity: 0.6,
  },
  premiumName: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.textMain,
    letterSpacing: -0.2,
  },
  studentIdText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.gold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  premiumBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    width: '100%',
    marginBottom: 16,
  },
  premiumRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.goldBorder,
  },
  premiumRoleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  execAdminRoleBadge: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  execAdminRoleBadgeText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.successBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.success,
  },
  premiumStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.successBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  premiumStatusPending: {
    backgroundColor: '#FFFBEB',
  },
  premiumStatusInactive: {
    backgroundColor: THEME.errorBg,
  },
  premiumStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.success,
  },
  premiumStatusDotPending: {
    backgroundColor: '#F59E0B',
  },
  premiumStatusDotInactive: {
    backgroundColor: THEME.error,
  },
  premiumStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.success,
  },
  premiumStatusTextPending: {
    color: '#D97706',
  },
  premiumStatusTextInactive: {
    color: THEME.error,
  },
  premiumDivider: {
    width: '100%',
    height: 1,
    backgroundColor: THEME.border,
    marginBottom: 16,
  },
  premiumInfoGrid: {
    width: '100%',
    gap: 8,
  },
  premiumInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumInfoIcon: {
    width: 22,
    textAlign: 'center',
  },
  premiumInfoText: {
    fontSize: 13,
    color: THEME.textMuted,
    flex: 1,
    fontWeight: '500',
  },
  execSummaryBox: {
    backgroundColor: '#EEF2FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    width: '100%',
  },
  execSummaryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#312E81',
    marginBottom: 2,
  },
  execSummaryText: {
    fontSize: 11,
    color: '#4338CA',
    lineHeight: 16,
  },

  // Stats Grid (2x2 Balanced)
  statsSectionContainer: {
    width: '100%',
  },
  sectionSubtitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.textMain,
    marginBottom: 10,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCardItem: {
    width: '48.5%',
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    minHeight: 92,
    ...SHADOWS.card,
  },
  statIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.textMain,
  },
  statCardLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  // Achievements Badges
  badgesScroll: {
    paddingVertical: 2,
    gap: 10,
  },
  badgeCard: {
    width: 140,
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    ...SHADOWS.card,
  },
  badgeIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMain,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 14,
  },
  emptyBadgesCard: {
    backgroundColor: THEME.surfaceAlt,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 4,
  },
  emptyBadgesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
  },
  emptyBadgesDesc: {
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Quick Actions (2-Column Responsive Layout)
  quickActionsContainer: {
    gap: 4,
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.textMain,
    marginBottom: 4,
  },
  quickActionCategoryTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 6,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickActionCard: {
    width: '48.5%',
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    ...SHADOWS.card,
    gap: 10,
    minHeight: 64,
  },
  quickActionHighlight: {
    borderColor: THEME.goldBorder,
    backgroundColor: THEME.goldBg,
  },
  quickActionIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionContent: {
    flex: 1,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMain,
  },
  quickActionSubText: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 1,
    fontWeight: '500',
  },
  logoutQuickActionCard: {
    width: '100%',
    borderColor: '#FECACA',
    backgroundColor: THEME.errorBg,
    marginTop: 4,
  },

  // Admin Card
  adminCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: THEME.border,
    gap: 2,
  },
  adminTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    marginBottom: 4,
  },
  adminTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.primary,
  },
  adminItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    minHeight: 48,
  },
  adminItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.textMain,
  },
  exportBlock: {
    marginTop: 12,
    paddingTop: 8,
    gap: 6,
  },
  exportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  exportBtn: {
    flex: 1,
    minWidth: 120,
    marginTop: 0,
  },

  // Fee Overview
  feeOverviewCard: {
    backgroundColor: THEME.surfaceAlt,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    marginVertical: 10,
    gap: 8,
  },
  feeOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabelText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: THEME.textMain,
  },
  feeAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.primary,
  },

  // Security List
  securityList: {
    gap: 0,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    minHeight: 48,
  },
  securityIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMain,
  },
  securityRowSub: {
    fontSize: 11.5,
    color: THEME.textMuted,
    marginTop: 1,
  },
  rowDivider: {
    height: 1,
    backgroundColor: THEME.border,
    marginVertical: 2,
  },

  // Feedback Submitted
  mySubmittedFeedbackCard: {
    backgroundColor: THEME.successBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  submittedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  submittedBadgeText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: THEME.success,
  },
  submittedDate: {
    fontSize: 11,
    color: '#065F46',
    fontWeight: '500',
  },
  submittedMsgText: {
    fontSize: 13.5,
    color: '#047857',
    lineHeight: 19,
  },
  submittedNote: {
    fontSize: 11.5,
    color: '#065F46',
    fontWeight: '500',
  },

  // Exec Permissions
  execPermissionsCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    ...SHADOWS.card,
  },
  execPermHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  execPermTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
  },
  execPermDesc: {
    fontSize: 11.5,
    color: THEME.textMuted,
    lineHeight: 16,
    marginBottom: 8,
  },
  execPermGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  execPermChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  execPermChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: THEME.textMain,
  },

  readMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  readMoreText: {
    color: THEME.primary,
    fontWeight: '700',
    fontSize: 12.5,
  },
  websiteLinkButton: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
  },
  websiteLinkButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.primary,
  },

  // Daily Inspiration
  inspirationCard: {
    backgroundColor: THEME.surface,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.goldBorder,
    ...SHADOWS.card,
  },
  inspirationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  inspirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    borderWidth: 1,
    borderColor: THEME.goldBorder,
  },
  inspirationBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
  },
  inspirationRotateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
  },
  inspirationRotateText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
  inspirationArabic: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.primary,
    textAlign: 'center',
    marginVertical: 10,
    lineHeight: 34,
  },
  inspirationTranslation: {
    fontSize: 13.5,
    color: THEME.textMain,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 4,
  },
  inspirationSource: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400E',
  },
});
