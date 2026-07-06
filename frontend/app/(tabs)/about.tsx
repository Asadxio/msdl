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
  Image,
  Animated,
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
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { WHATSAPP_HELP_URL, isValidHttpsUrl, normalizeWhatsAppUrl, prepareExternalUrl } from '@/lib/links';


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

const DEFAULT_ABOUT_CONTENT = `Madarsa Tus Salikat Lil Banat is dedicated to nurturing Islamic knowledge, noble character, and academic excellence for girls through authentic Quranic education, Tajweed, Hadith, Fiqh, and spiritual development.

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
      duration: 450,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.sectionCard, { opacity: fadeAnim }]}>
      <View style={styles.sectionCardHeader}>
        <Ionicons name={icon as any} size={22} color={COLORS.secondary} />
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
    <SectionCard title="🌿 About Our Madrasa" icon="leaf-outline">
      <View style={{ marginBottom: 8 }}>
        <Text style={[styles.bodyText, { lineHeight: 24 }]} numberOfLines={expanded ? undefined : 4}>
          {aboutMadrasa || DEFAULT_ABOUT_CONTENT}
        </Text>
        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.readMoreBtn} accessibilityRole="button" accessibilityLabel={expanded ? "Read Less" : "Read More"}>
          <Text style={styles.readMoreText}>{expanded ? "Read Less ▲" : "Read More ▼"}</Text>
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
            placeholderTextColor={COLORS.textMuted}
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
          <TouchableOpacity style={styles.secondaryBtn} onPress={saveAboutMadrasa} disabled={savingAbout}>
            <Text style={styles.secondaryBtnText}>{savingAbout ? 'Saving About...' : 'Save About'}</Text>
          </TouchableOpacity>
        </>
      ) : null}
    </SectionCard>
  );
});

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { lessonProgress, courses, books } = useData();
  const router = useRouter();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  const [inspirationIdx, setInspirationIdx] = useState(0);
  const lessonsCompletedCount = useMemo(() => Object.values(lessonProgress || {}).filter((p: any) => p?.completed).length, [lessonProgress]);
  const quizzesCompletedCount = useMemo(() => Object.values(lessonProgress || {}).filter((p: any) => p?.quizCompleted).length, [lessonProgress]);
  const totalCoursesCount = useMemo(() => Array.isArray(courses) ? courses.length : 0, [courses]);
  const totalBooksCount = useMemo(() => Array.isArray(books) ? books.length : 0, [books]);

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
    if (user?.metadata?.creationTime) list.push({ id: 'active', title: 'Active Member', desc: 'Joined Madrasa Tus Salikat Lil Banat', icon: 'ribbon-outline', color: '#10B981' });
    if (lessonsCompletedCount >= 1) list.push({ id: 'first_lesson', title: 'First Lesson', desc: 'Completed your first Islamic lesson', icon: 'book-outline', color: '#4F46E5' });
    if (lessonsCompletedCount >= 5) list.push({ id: 'dedicated', title: 'Dedicated Learner', desc: 'Completed 5+ Islamic lessons', icon: 'flame-outline', color: '#D97706' });
    if (quizzesCompletedCount >= 1) list.push({ id: 'first_quiz', title: 'First Quiz', desc: 'Attempted your first knowledge assessment', icon: 'help-circle-outline', color: '#8B5CF6' });
    if (quizzesCompletedCount >= 5) list.push({ id: 'quiz_master', title: 'Quiz Master', desc: 'Completed 5+ quizzes', icon: 'trophy-outline', color: COLORS.goldText });
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
      message: 'Join Madars tus salikat Lilbanat (مدرسۃ السالکات للبنات) app for courses, library and updates.',
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Madars tus salikat Lilbanat • مدرسۃ السالکات للبنات</Text>
          </View>
        </View>
      </View>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} testID="about-scroll">
        {profile && (
          <>
            {/* PHASE 1: Premium Student Identity Card */}
            <View style={styles.premiumProfileCard} testID="user-profile-card">
              <View style={styles.profileHeaderRow}>
                <View style={styles.premiumAvatarContainer}>
                  <Text style={styles.premiumAvatarText}>
                    {(profile.name || user?.displayName || 'U').charAt(0).toUpperCase()}
                  </Text>
                  <View style={styles.avatarRing} />
                </View>
                <View style={styles.profileMainInfo}>
                  <Text style={styles.premiumName}>{profile.name || user?.displayName || 'Student'}</Text>
                  <Text style={styles.studentIdText}>
                    ID: #MST-{(user?.uid || profile?.uid || '000000').slice(0, 6).toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.premiumBadgesContainer}>
                <View style={styles.premiumRoleBadge}>
                  <Ionicons
                    name={profile.role === 'admin' ? 'shield-checkmark' : profile.role === 'teacher' ? 'school' : 'person'}
                    size={14}
                    color={COLORS.goldText}
                  />
                  <Text style={styles.premiumRoleBadgeText}>
                    {(profile.role || 'student').charAt(0).toUpperCase() + (profile.role || 'student').slice(1)}
                  </Text>
                </View>

                {(profile.status === 'approved' || profile.role === 'admin' || profile.role === 'teacher') && (
                  <View style={styles.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
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
                  <Ionicons name="mail-outline" size={18} color={COLORS.primary} style={styles.premiumInfoIcon} />
                  <Text style={styles.premiumInfoText} numberOfLines={1}>{profile.email || user?.email || 'No Email'}</Text>
                </View>
                {!!user?.phoneNumber && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="call-outline" size={18} color={COLORS.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>{user.phoneNumber}</Text>
                  </View>
                )}
                {!!user?.metadata?.creationTime && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>
                      Joined {new Date(user.metadata.creationTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                )}
                {!!user?.metadata?.lastSignInTime && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="time-outline" size={18} color={COLORS.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>
                      Last Active: {new Date(user.metadata.lastSignInTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                )}
                {!!profile.referral_code && (
                  <View style={styles.premiumInfoRow}>
                    <Ionicons name="share-social-outline" size={18} color={COLORS.primary} style={styles.premiumInfoIcon} />
                    <Text style={styles.premiumInfoText}>Referral: {profile.referral_code} • {profile.referral_count || 0} used</Text>
                  </View>
                )}
              </View>
            </View>

            {/* PHASE 2: Student Statistics */}
            <View style={styles.statsSectionContainer}>
              <Text style={styles.sectionSubtitleText}>📊 Academic Performance & Stats</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statCardItem}>
                  <View style={[styles.statIconBox, { backgroundColor: '#EEF2FF' }]}>
                    <Ionicons name="book" size={22} color="#4F46E5" />
                  </View>
                  <Text style={styles.statCardValue}>{totalCoursesCount}</Text>
                  <Text style={styles.statCardLabel}>Courses Available</Text>
                </View>
                <View style={styles.statCardItem}>
                  <View style={[styles.statIconBox, { backgroundColor: '#ECFDF5' }]}>
                    <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                  </View>
                  <Text style={styles.statCardValue}>{lessonsCompletedCount}</Text>
                  <Text style={styles.statCardLabel}>Lessons Completed</Text>
                </View>
                <View style={styles.statCardItem}>
                  <View style={[styles.statIconBox, { backgroundColor: '#FEF3C7' }]}>
                    <Ionicons name="help-circle" size={22} color="#D97706" />
                  </View>
                  <Text style={styles.statCardValue}>{quizzesCompletedCount}</Text>
                  <Text style={styles.statCardLabel}>Quiz Attempts</Text>
                </View>
                <View style={styles.statCardItem}>
                  <View style={[styles.statIconBox, { backgroundColor: '#F5F3FF' }]}>
                    <Ionicons name="library" size={22} color="#7C3AED" />
                  </View>
                  <Text style={styles.statCardValue}>{totalBooksCount}</Text>
                  <Text style={styles.statCardLabel}>Library Books</Text>
                </View>
              </View>
            </View>

            {/* PHASE 9: Earned Achievements */}
            <View style={styles.statsSectionContainer}>
              <Text style={styles.sectionSubtitleText}>🏆 Earned Achievements</Text>
              {earnedBadges.length === 0 ? (
                <View style={styles.emptyBadgesCard}>
                  <Ionicons name="trophy-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.emptyBadgesTitle}>Start Learning to Earn Badges!</Text>
                  <Text style={styles.emptyBadgesDesc}>Complete lessons and quiz assessments to unlock your Islamic student badges.</Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
                  {earnedBadges.map((b) => (
                    <View key={b.id} style={styles.badgeCard}>
                      <View style={[styles.badgeIconBox, { backgroundColor: b.color + '15' }]}>
                        <Ionicons name={b.icon as any} size={24} color={b.color} />
                      </View>
                      <Text style={styles.badgeTitle} numberOfLines={1}>{b.title}</Text>
                      <Text style={styles.badgeDesc} numberOfLines={2}>{b.desc}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* PHASE 3: Quick Actions */}
            <View style={styles.quickActionsContainer}>
              <Text style={styles.quickActionsTitle}>⚡ Quick Actions</Text>
              <View style={styles.quickActionsGrid}>
                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/(tabs)/courses')} accessibilityRole="button" accessibilityLabel="My Courses, Continue learning">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="book-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>My Courses</Text>
                  <Text style={styles.quickActionSubText}>Continue learning</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/(tabs)/library')} accessibilityRole="button" accessibilityLabel="Library, Islamic Books">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="library-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Library</Text>
                  <Text style={styles.quickActionSubText}>Islamic Books</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/(tabs)/quiz')} accessibilityRole="button" accessibilityLabel="Quiz History, View Results">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="help-circle-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Quiz History</Text>
                  <Text style={styles.quickActionSubText}>View Results</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/prayer-times')} accessibilityRole="button" accessibilityLabel="Prayer Times, Today's Salah">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="time-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Prayer Times</Text>
                  <Text style={styles.quickActionSubText}>Today's Salah</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/qibla')} accessibilityRole="button" accessibilityLabel="Qibla, Kaaba Direction">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="compass-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Qibla</Text>
                  <Text style={styles.quickActionSubText}>Kaaba Direction</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/(tabs)/notifications')} accessibilityRole="button" accessibilityLabel="Notifications, Recent updates">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="notifications-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Notifications</Text>
                  <Text style={styles.quickActionSubText}>Recent updates</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={() => safePush('/settings')} accessibilityRole="button" accessibilityLabel="Settings, Manage Account">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="settings-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Settings</Text>
                  <Text style={styles.quickActionSubText}>Manage Account</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={openHelp} accessibilityRole="button" accessibilityLabel="Help, Support">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="logo-whatsapp" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>Help</Text>
                  <Text style={styles.quickActionSubText}>Support</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.quickActionCard} onPress={scrollToAbout} accessibilityRole="button" accessibilityLabel="About, Madrasa Info">
                  <View style={styles.quickActionIconWrapper}>
                    <Ionicons name="information-circle-outline" size={24} color={COLORS.primary} />
                  </View>
                  <Text style={styles.quickActionText}>About</Text>
                  <Text style={styles.quickActionSubText}>Madrasa Info</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickActionCard, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]} onPress={signOut} accessibilityRole="button" accessibilityLabel="Logout, Sign out">
                  <View style={[styles.quickActionIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="log-out-outline" size={24} color={COLORS.error} />
                  </View>
                  <Text style={[styles.quickActionText, { color: COLORS.error }]}>Logout</Text>
                  <Text style={[styles.quickActionSubText, { color: COLORS.error + '99' }]}>Sign out</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {isAdmin && (
          <View style={styles.adminCard} testID="admin-controls">
            <Text style={styles.adminTitle}>Admin Controls</Text>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/users')} testID="manage-users-btn">
              <Ionicons name="people-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Users</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/add-book')} testID="admin-add-book-link">
              <Ionicons name="book-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Add Library Book</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/manage-academics')} testID="manage-academics-btn">
              <Ionicons name="school-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Teachers & Courses</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/payments')} testID="manage-payments-btn">
              <Ionicons name="card-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Payments</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/privacy-requests')} testID="privacy-requests-btn">
              <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Privacy Requests</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/analytics')}>
              <Ionicons name="stats-chart-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Analytics Dashboard</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/send-push')} testID="send-push-btn">
              <Ionicons name="notifications-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Send Push Notifications</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/moderation')} testID="moderation-btn">
              <Ionicons name="flag-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Moderation Queue</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => safePush('/admin/security')} testID="security-btn">
              <Ionicons name="shield-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Security Dashboard</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <View style={styles.exportBlock}>
              <Text style={styles.subTitle}>Data Safety</Text>
              <Text style={styles.bodyText}>
                Recommended backup: schedule daily Firestore exports to Cloud Storage and keep a 30-day retention.
              </Text>
              <Text style={styles.bodyText}>Manual JSON export:</Text>
              <View style={styles.exportRow}>
                {(['users', 'courses', 'payments', 'feedback'] as const).map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.secondaryBtn, styles.exportBtn]}
                    onPress={() => exportCollection(name)}
                    disabled={!!exportingCollection}
                  >
                    {exportingCollection === name ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Text style={styles.secondaryBtnText}>Export {name}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {!isAdmin ? (
          <SectionCard title="💳 Fee Management & Payments" icon="wallet-outline">
            <Text style={styles.bodyText}>Use a single guided flow for fees and donations.</Text>
            <View style={styles.feeOverviewCard}>
              <View style={styles.feeOverviewRow}>
                <Text style={styles.feeLabelText}>Current Fees</Text>
                <Text style={styles.feeAmountText}>₹{Number(settings.fees_amount || 0).toFixed(2)}</Text>
              </View>
              {myPayments[0] ? (
                <View style={[styles.statusCard, { marginVertical: 8 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? "checkmark-circle" : "time"} size={16} color={paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? "#10B981" : COLORS.goldText} />
                    <Text style={styles.statusLabel}>Latest Payment Status</Text>
                  </View>
                  <Text style={[styles.statusValue, { color: paymentState(myPayments[0]) === 'Active' || paymentState(myPayments[0]) === 'Paid' ? "#10B981" : COLORS.goldText }]}>
                    {paymentState(myPayments[0])}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/payment')} testID="open-unified-payment-btn" accessibilityRole="button" accessibilityLabel="Open Payment Flow">
              <Text style={styles.primaryBtnText}>Open Payment Flow</Text>
            </TouchableOpacity>
          </SectionCard>
        ) : (
        <>
        <SectionCard title="Pay Fees (Razorpay Link)" icon="card-outline">
          <Text style={styles.bodyText}>Current Fees: ₹{Number(settings.fees_amount || 0).toFixed(2)}</Text>
          {myPayments[0] && (
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>Latest Payment Status</Text>
              <Text style={styles.statusValue}>{paymentState(myPayments[0])}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={payFees} testID="pay-fees-btn">
            <Text style={styles.primaryBtnText}>Pay Fees</Text>
          </TouchableOpacity>
          {isAdmin && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Text style={styles.subTitle}>Admin Fee Settings</Text>
              <Text style={styles.inputLabel}>Fees Amount</Text>
              <TextInput
                style={[styles.input, focusedInput === 'fees_amount' && styles.inputFocused]}
                placeholder="Fees amount (e.g. 1500)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={String(settings.fees_amount || '')}
                onChangeText={(v) => setSettings((p) => ({ ...p, fees_amount: Number(v || 0) }))}
                onFocus={() => setFocusedInput('fees_amount')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={styles.inputLabel}>Razorpay Payment Link</Text>
              <TextInput
                style={[styles.input, focusedInput === 'razorpay_link' && styles.inputFocused]}
                placeholder="Razorpay Payment Link"
                placeholderTextColor={COLORS.textMuted}
                value={settings.razorpay_link}
                onChangeText={(v) => setSettings((p) => ({ ...p, razorpay_link: v }))}
                autoCapitalize="none"
                keyboardType="url"
                onFocus={() => setFocusedInput('razorpay_link')}
                onBlur={() => setFocusedInput(null)}
              />
              {paymentError ? <Text style={styles.inputError}>{paymentError}</Text> : null}
              <TouchableOpacity style={styles.secondaryBtn} onPress={savePaymentSettings}>
                <Text style={styles.secondaryBtnText}>Save Payment Settings</Text>
              </TouchableOpacity>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Donations (Razorpay Link)" icon="heart-outline">
          <Text style={styles.bodyText}>{settings.donation_content}</Text>
          {isAdmin ? (
            <>
              <Text style={styles.inputLabel}>Editable Donation Content</Text>
              <TextInput
                style={[styles.input, styles.textArea, focusedInput === 'donation_content' && styles.inputFocused]}
                placeholder="Write donation appeal content..."
                placeholderTextColor={COLORS.textMuted}
                value={settings.donation_content}
                onChangeText={(v) => setSettings((p) => ({ ...p, donation_content: v }))}
                multiline
                onFocus={() => setFocusedInput('donation_content')}
                onBlur={() => setFocusedInput(null)}
              />
            </>
          ) : null}
          <Text style={styles.inputLabel}>Donation Amount</Text>
          <TextInput
            style={[styles.input, { marginTop: 10 }, focusedInput === 'donation_amount' && styles.inputFocused]}
            placeholder="Donation Amount"
            placeholderTextColor={COLORS.textMuted}
            keyboardType="numeric"
            value={donationAmount}
            onChangeText={setDonationAmount}
            onFocus={() => setFocusedInput('donation_amount')}
            onBlur={() => setFocusedInput(null)}
          />
          {donationError ? <Text style={styles.inputError}>{donationError}</Text> : null}
          <View style={styles.row}>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('sadqa')}>
              <Text style={styles.primaryBtnText}>Donate Sadqa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('zakat')}>
              <Text style={styles.primaryBtnText}>Donate Zakat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('fitra')}>
              <Text style={styles.primaryBtnText}>Donate Fitra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => donate('langar')}>
              <Text style={styles.primaryBtnText}>Donate Langar</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.bodyText, { marginTop: 10, fontSize: 12 }]}>
            Need Help? Contact us on WhatsApp
          </Text>
        </SectionCard>
        </>
        )}

        <SectionCard title="💬 Feedback & Testimonials" icon="chatbox-ellipses-outline">
          {mySubmittedFeedback.length > 0 ? (
            <View style={styles.mySubmittedFeedbackCard}>
              <View style={styles.submittedHeader}>
                <View style={styles.submittedBadge}>
                  <Ionicons name="checkmark-done" size={16} color="#10B981" />
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
              <Text style={styles.submittedNote}>Your feedback has been received and is under review by madrasa administration.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.inputLabel}>Feedback Message</Text>
              <TextInput
                style={[styles.input, styles.textArea, focusedInput === 'feedback_message' && styles.inputFocused]}
                placeholder="Write your feedback"
                placeholderTextColor={COLORS.textMuted}
                value={fbMessage}
                onChangeText={setFbMessage}
                multiline
                onFocus={() => setFocusedInput('feedback_message')}
                onBlur={() => setFocusedInput(null)}
              />
              <Text style={styles.inputLabel}>Rating (optional)</Text>
              <TextInput
                style={[styles.input, focusedInput === 'feedback_rating' && styles.inputFocused]}
                placeholder="Rating 1-5 (optional)"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={fbRating}
                onChangeText={setFbRating}
                onFocus={() => setFocusedInput('feedback_rating')}
                onBlur={() => setFocusedInput(null)}
              />
              {feedbackError ? <Text style={styles.inputError}>{feedbackError}</Text> : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={submitFeedback} testID="submit-feedback-btn">
                <Text style={styles.primaryBtnText}>Submit Feedback</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.subTitle, { marginTop: 12 }]}>Testimonials</Text>
          {testimonials.length === 0 ? <Text style={styles.bodyText}>No feedback yet.</Text> : null}
          {testimonials.map((item) => (
            <View key={item.id} style={styles.feedbackCard}>
              <Text style={styles.feedbackName}>{item.user_name}</Text>
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
                  <TouchableOpacity style={styles.secondaryBtn} onPress={saveFeedbackEdit}>
                    <Text style={styles.secondaryBtnText}>Save</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.feedbackMsg}>{item.message}</Text>
              )}
              {item.rating ? <Text style={styles.feedbackRating}>Rating: {item.rating}/5</Text> : null}
              {isAdmin && editingFeedbackId !== item.id && (
                <View style={styles.feedbackActions}>
                  <TouchableOpacity onPress={() => { setEditingFeedbackId(item.id); setEditingFeedbackMsg(item.message); }}>
                    <Text style={styles.actionLink}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteFeedback(item.id)}>
                    <Text style={[styles.actionLink, { color: COLORS.error }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </SectionCard>

        <AboutMadrasaSection
          aboutMadrasa={settings.about_madrasa}
          isAdmin={isAdmin}
          onSaved={handleAboutSaved}
        />

        {/* PHASE 10: Security & Privacy */}
        <SectionCard title="🔒 Account Security & Privacy" icon="shield-checkmark-outline">
          <View style={styles.securityList}>
            <TouchableOpacity style={styles.securityRow} onPress={() => safePush('/settings')} accessibilityRole="button" accessibilityLabel="Account Settings and Security">
              <View style={styles.securityIconBox}><Ionicons name="key-outline" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.securityRowTitle}>Account Settings & Security</Text><Text style={styles.securityRowSub}>Manage PIN, app lock, and language preferences</Text></View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
            <TouchableOpacity style={styles.securityRow} onPress={() => safePush('/privacy')} accessibilityRole="button" accessibilityLabel="Privacy Policy">
              <View style={styles.securityIconBox}><Ionicons name="document-lock-outline" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.securityRowTitle}>Privacy Settings & Policy</Text><Text style={styles.securityRowSub}>Review data collection and privacy rights</Text></View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
            <TouchableOpacity style={styles.securityRow} onPress={() => safePush('/data-privacy')} accessibilityRole="button" accessibilityLabel="Data and Privacy Controls">
              <View style={styles.securityIconBox}><Ionicons name="trash-bin-outline" size={20} color={COLORS.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.securityRowTitle}>Data & Privacy Controls</Text><Text style={styles.securityRowSub}>Manage data export or request account deletion</Text></View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <View style={styles.rowDivider} />
            <TouchableOpacity style={[styles.securityRow, { paddingVertical: 12 }]} onPress={signOut} accessibilityRole="button" accessibilityLabel="Sign Out of Session">
              <View style={[styles.securityIconBox, { backgroundColor: '#FEE2E2' }]}><Ionicons name="log-out-outline" size={20} color={COLORS.error} /></View>
              <View style={{ flex: 1 }}><Text style={[styles.securityRowTitle, { color: COLORS.error }]}>Sign Out of Session</Text><Text style={styles.securityRowSub}>Safely log out of your account on this device</Text></View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
        </SectionCard>

        <SectionCard title="🌐 Social & Help" icon="globe-outline">
          {isAdmin ? (
            <>
              <Text style={styles.inputLabel}>WhatsApp Channel Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_channel' && styles.inputFocused]} placeholder="WhatsApp Channel Link" placeholderTextColor={COLORS.textMuted} value={settings.whatsapp_channel} onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_channel: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_channel')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>WhatsApp Contact</Text>
              <TextInput style={[styles.input, focusedInput === 'social_contact' && styles.inputFocused]} placeholder="WhatsApp Contact (URL or number)" placeholderTextColor={COLORS.textMuted} value={settings.whatsapp_contact} onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_contact: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_contact')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>Instagram Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_instagram' && styles.inputFocused]} placeholder="Instagram Link" placeholderTextColor={COLORS.textMuted} value={settings.instagram} onChangeText={(v) => setSettings((p) => ({ ...p, instagram: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_instagram')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>YouTube Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_youtube' && styles.inputFocused]} placeholder="YouTube Link" placeholderTextColor={COLORS.textMuted} value={settings.youtube_link} onChangeText={(v) => setSettings((p) => ({ ...p, youtube_link: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_youtube')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>Telegram Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_telegram' && styles.inputFocused]} placeholder="Telegram Link" placeholderTextColor={COLORS.textMuted} value={settings.telegram_link} onChangeText={(v) => setSettings((p) => ({ ...p, telegram_link: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_telegram')} onBlur={() => setFocusedInput(null)} />
              {socialError ? <Text style={styles.inputError}>{socialError}</Text> : null}
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveSocialSettings}>
                <Text style={styles.secondaryBtnText}>Save Social Links</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity style={styles.premiumSocialBtn} onPress={() => { void openSocialLink(normalizeWhatsAppUrl(settings.whatsapp_channel) || settings.whatsapp_channel, 'WhatsApp Channel'); }}>
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-whatsapp" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.premiumSocialBtnText}>WhatsApp Channel</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.secondary} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.premiumSocialBtn} onPress={() => { void openSocialLink(settings.instagram, 'Instagram'); }}>
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-instagram" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.premiumSocialBtnText}>Instagram</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.secondary} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.premiumSocialBtn} onPress={() => { void openSocialLink(settings.youtube_link, 'YouTube'); }}>
                <View style={styles.socialIconContainer}>
                  <Ionicons name="logo-youtube" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.premiumSocialBtnText}>YouTube</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.secondary} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.premiumSocialBtn} onPress={() => { void openSocialLink(settings.telegram_link, 'Telegram'); }}>
                <View style={styles.socialIconContainer}>
                  <Ionicons name="paper-plane" size={20} color={COLORS.secondary} />
                </View>
                <Text style={styles.premiumSocialBtnText}>Telegram</Text>
                <Ionicons name="open-outline" size={16} color={COLORS.secondary} style={{ marginLeft: "auto" }} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.premiumSocialBtn, { marginTop: 8, borderColor: COLORS.primary, backgroundColor: COLORS.goldBg }]} onPress={openHelp}>
                <View style={[styles.socialIconContainer, { backgroundColor: 'rgba(6, 78, 59, 0.1)' }]}>
                  <Ionicons name="logo-whatsapp" size={20} color={COLORS.primary} />
                </View>
                <Text style={[styles.premiumSocialBtnText, { color: COLORS.primary }]}>WhatsApp Support</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.row}>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={shareApp} testID="share-app-btn">
              <Text style={styles.primaryBtnText}>Share App</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtnSmall} onPress={openHelp} testID="help-btn">
              <Text style={styles.primaryBtnText}>Help (WhatsApp)</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.bodyText, { marginTop: 10, fontSize: 12 }]}>
            Need Help? Contact us on WhatsApp
          </Text>
        </SectionCard>

        {/* PHASE 8: Islamic Inspiration */}
        <View style={styles.inspirationCard} testID="bismillah-section">
          <View style={styles.inspirationHeaderRow}>
            <View style={styles.inspirationBadge}>
              <Ionicons name="sparkles" size={14} color={COLORS.goldText} />
              <Text style={styles.inspirationBadgeText}>{ISLAMIC_INSPIRATIONS[inspirationIdx].type}</Text>
            </View>
            <TouchableOpacity onPress={rotateInspiration} style={styles.inspirationRotateBtn} accessibilityRole="button" accessibilityLabel="Next Islamic Inspiration">
              <Ionicons name="refresh" size={16} color={COLORS.goldText} />
              <Text style={styles.inspirationRotateText}>New Quote</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
          <Text style={styles.inspirationArabic}>{ISLAMIC_INSPIRATIONS[inspirationIdx].arabic}</Text>
          <Text style={styles.inspirationTranslation}>"{ISLAMIC_INSPIRATIONS[inspirationIdx].translation}"</Text>
          <Text style={styles.inspirationSource}>— {ISLAMIC_INSPIRATIONS[inspirationIdx].source}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, ...SHADOWS.header,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textMain },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.lg },
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionCardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textMain },
  goldAccent: { height: 2, backgroundColor: COLORS.secondary, width: 40, borderRadius: 1, marginBottom: SPACING.md, marginTop: 8, opacity: 0.7 },
  bodyText: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
  subTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textMain,
    fontSize: 14,
  },
  inputFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  inputError: { color: COLORS.error, fontSize: 12, fontWeight: '600', marginTop: -4, marginBottom: 8 },
  inputWarning: { color: COLORS.goldText, fontSize: 12, fontWeight: '600', marginTop: -4, marginBottom: 8 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  aboutTextArea: { minHeight: 180, textAlignVertical: 'top' },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtnSmall: { flexGrow: 1, minWidth: 150, backgroundColor: COLORS.goldBg, borderRadius: RADIUS.full, paddingVertical: SPACING.md, alignItems: 'center' },
  primaryBtnText: { color: COLORS.goldText, fontWeight: '700', fontSize: 13 },
  secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.goldText, fontWeight: '700' },
  premiumSocialBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 20, borderRadius: RADIUS.lg, marginBottom: 12, borderWidth: 1, borderColor: COLORS.secondary, shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  premiumSocialBtnText: { color: COLORS.secondary, fontWeight: '700', fontSize: 16, marginLeft: 16 },
  socialIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(212, 175, 55, 0.15)', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusCard: { backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 10, marginVertical: 8 },
  statusLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  statusValue: { fontSize: 14, color: COLORS.primary, fontWeight: '800', textTransform: 'capitalize', marginTop: 3 },
  statusRef: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  feedbackCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: 10, marginTop: 8, gap: 4, backgroundColor: COLORS.surfaceAlt },
  feedbackName: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  feedbackMsg: { fontSize: 13, color: COLORS.textMuted },
  feedbackRating: { fontSize: 12, color: COLORS.goldText, fontWeight: '700' },
  feedbackActions: { flexDirection: 'row', gap: 14, marginTop: 4 },
  actionLink: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  bismillahCard: {
    backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.xxl, padding: SPACING.lg, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  bismillah: { fontSize: 28, color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  bismillahDua: { fontSize: 20, color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginTop: 12, marginBottom: 6 },
  bismillahTranslation: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', fontStyle: 'italic' },
  
  // Premium Profile Card
  premiumProfileCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl, alignItems: 'center', ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border },
  premiumAvatarContainer: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.goldBg, borderWidth: 3, borderColor: COLORS.secondary, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, ...SHADOWS.card },
  premiumAvatarText: { fontSize: 32, fontWeight: '900', color: COLORS.primary },
  premiumName: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, marginBottom: SPACING.xs, textAlign: 'center' },
  premiumBadgesContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  premiumRoleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.goldBg, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  premiumRoleBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.goldText, textTransform: 'uppercase', letterSpacing: 0.5 },
  premiumStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ECFDF5', paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.full },
  premiumStatusPending: { backgroundColor: '#FFFBEB' },
  premiumStatusInactive: { backgroundColor: '#FEF2F2' },
  premiumStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  premiumStatusDotPending: { backgroundColor: '#F59E0B' },
  premiumStatusDotInactive: { backgroundColor: '#EF4444' },
  premiumStatusText: { fontSize: 12, fontWeight: '700', color: '#10B981' },
  premiumStatusTextPending: { color: '#D97706' },
  premiumStatusTextInactive: { color: '#EF4444' },
  premiumDivider: { width: '100%', height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.lg },
  premiumInfoGrid: { width: '100%', gap: SPACING.sm },
  premiumInfoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  premiumInfoIcon: { width: 24, textAlign: 'center' },
  premiumInfoText: { fontSize: 14, color: COLORS.textMuted, flex: 1, fontWeight: '500' },
  
  // Quick Actions
  quickActionsContainer: { gap: SPACING.md },
  quickActionsTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textMain, marginLeft: 4 },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, justifyContent: 'space-between' },
  quickActionCard: { width: '48%', backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: SPACING.md, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card, gap: 8 },
  quickActionIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  quickActionText: { fontSize: 13, fontWeight: '600', color: COLORS.textMain, textAlign: 'center' },

  adminCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card, gap: 8 },
  adminTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  adminItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  adminItemText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textMain },
  exportBlock: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, gap: 8 },
  exportRow: { gap: 8 },
  exportBtn: { paddingHorizontal: 10 },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  profileMainInfo: {
    flex: 1,
  },
  avatarRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.goldBg,
    opacity: 0.6,
  },
  studentIdText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.goldText,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  statsSectionContainer: {
    marginTop: SPACING.lg,
    width: '100%',
  },
  sectionSubtitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  statCardItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  statIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textMain,
  },
  statCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  quickActionSubText: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
  badgesScroll: {
    paddingVertical: 4,
    gap: SPACING.md,
  },
  badgeCard: {
    width: 160,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldBg,
    ...SHADOWS.card,
  },
  badgeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
  },
  badgeDesc: {
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 15,
  },
  emptyBadgesCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  emptyBadgesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  emptyBadgesDesc: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
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
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  securityRowSub: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  mySubmittedFeedbackCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 8,
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
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  submittedDate: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
  },
  submittedMsgText: {
    fontSize: 14,
    color: '#047857',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  submittedNote: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '500',
  },
  feeOverviewCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginVertical: 10,
  },
  feeOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeLabelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  feeAmountText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  readMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  readMoreText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  inspirationCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    borderWidth: 1.5,
    borderColor: COLORS.goldBg,
    ...SHADOWS.card,
  },
  inspirationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.md,
  },
  inspirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  inspirationBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldText,
    textTransform: 'uppercase',
  },
  inspirationRotateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  inspirationRotateText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldText,
  },
  inspirationArabic: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    textAlign: 'center',
    marginVertical: SPACING.md,
    lineHeight: 36,
  },
  inspirationTranslation: {
    fontSize: 14,
    color: COLORS.textMain,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  inspirationSource: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.goldText,
  },
});
