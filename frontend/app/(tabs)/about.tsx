import React, { useEffect, useMemo, useState } from 'react';
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
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';

type AppSettings = {
  fees_amount: number;
  razorpay_link: string;
  whatsapp_channel: string;
  whatsapp_contact: string;
  instagram: string;
  youtube_telegram: string;
};

type FeedbackItem = {
  id: string;
  user_name: string;
  message: string;
  rating?: number;
  user_id?: string;
};

type PaymentItem = {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'verified' | 'submitted';
  provider?: 'razorpay';
  type?: 'fees' | 'sadqa' | 'zakat' | 'fitra';
};

const DEFAULT_SETTINGS: AppSettings = {
  fees_amount: 0,
  razorpay_link: '',
  whatsapp_channel: '',
  whatsapp_contact: '',
  instagram: '',
  youtube_telegram: '',
};
const HELP_WHATSAPP_URL = 'https://wa.link/s82kj2';
const AVATAR_OPTIONS = ['person', 'flower', 'star', 'sparkles'] as const;

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <Ionicons name={icon as any} size={22} color={COLORS.secondary} />
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      <View style={styles.goldAccent} />
      {children}
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const isAdmin = profile?.role === 'admin';

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [fbMessage, setFbMessage] = useState('');
  const [fbRating, setFbRating] = useState('');
  const [myPayments, setMyPayments] = useState<PaymentItem[]>([]);
  const [donationAmount, setDonationAmount] = useState('');
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editingFeedbackMsg, setEditingFeedbackMsg] = useState('');
  const [exportingCollection, setExportingCollection] = useState<string | null>(null);
  const [savingProfileMedia, setSavingProfileMedia] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [donationError, setDonationError] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [socialError, setSocialError] = useState('');
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const testimonials = useMemo(() => feedback.slice(0, 6), [feedback]);

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
    const loadSettings = async () => {
      const snap = await getDoc(doc(db, 'app_settings', 'platform'));
      if (snap.exists()) {
        const data = snap.data() as any;
        setSettings((prev) => ({
          ...prev,
          fees_amount: Number(data.fees_amount || 0),
          razorpay_link: data.razorpay_link || '',
          whatsapp_channel: data.whatsapp_channel || '',
          whatsapp_contact: data.whatsapp_contact || '',
          instagram: data.instagram || '',
          youtube_telegram: data.youtube_telegram || '',
        }));
      }
    };
    loadSettings().catch(() => {});
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
    if (!settings.whatsapp_channel.trim() && !settings.whatsapp_contact.trim() && !settings.instagram.trim() && !settings.youtube_telegram.trim()) {
      setSocialError('Add at least one social/contact link before saving.');
      return;
    }
    setSocialError('');
    await setDoc(doc(db, 'app_settings', 'platform'), {
      ...settings,
      updated_at: serverTimestamp(),
    }, { merge: true });
    Alert.alert('Saved', 'Settings updated successfully.');
  };

  const submitFeedback = async () => {
    if (!user || !profile) return;
    if (!fbMessage.trim()) {
      setFeedbackError('Feedback message is required.');
      Alert.alert('Missing', 'Please write feedback message.');
      return;
    }
    setFeedbackError('');
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
  };

  const saveFeedbackEdit = async () => {
    if (!isAdmin || !editingFeedbackId) return;
    await updateDoc(doc(db, 'feedback', editingFeedbackId), {
      message: editingFeedbackMsg.trim(),
      updated_at: serverTimestamp(),
    });
    setEditingFeedbackId(null);
    setEditingFeedbackMsg('');
  };

  const deleteFeedback = async (id: string) => {
    if (!isAdmin) return;
    await deleteDoc(doc(db, 'feedback', id));
  };

  const openSocial = async (value: string) => {
    if (!value.trim()) return;
    await Linking.openURL(value.trim());
  };

  const openHelp = async () => {
    const canOpen = await Linking.canOpenURL(HELP_WHATSAPP_URL);
    if (!canOpen) {
      Alert.alert('Unavailable', 'Could not open WhatsApp right now.');
      return;
    }
    await Linking.openURL(HELP_WHATSAPP_URL);
  };

  const shareApp = async () => {
    await Share.share({
      message: 'Join Madrasa Tus Salikat Lil Banat app for courses, library and updates.',
    });
  };

  const getLatestPaymentSettings = async () => {
    const snap = await getDoc(doc(db, 'app_settings', 'platform'));
    const data = snap.exists() ? (snap.data() as any) : {};
    return {
      razorpay_link: String(data.razorpay_link || settings.razorpay_link || '').trim(),
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
    const paymentSettings = await getLatestPaymentSettings();
    const link = paymentSettings.razorpay_link;
    const amount = Number(paymentSettings.fees_amount || 0);
    if (!link) {
      Alert.alert('Unavailable', 'Payment link is not configured by admin yet.');
      return;
    }
    if (!link.startsWith('http')) {
      Alert.alert('Invalid Link', 'Payment link must be a valid URL.');
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
      status: 'pending',
      provider: 'razorpay',
      type: 'fees',
      created_at: serverTimestamp(),
    });
    await createPaymentNotification(profile.name, amount, 'fees');
    await Linking.openURL(link);
    Alert.alert('Recorded', 'Your payment attempt was recorded and is pending admin approval.');
  };

  const donate = async (donationType: 'sadqa' | 'zakat' | 'fitra') => {
    if (!user || !profile) return;
    const paymentSettings = await getLatestPaymentSettings();
    const link = paymentSettings.razorpay_link;
    const amount = Number(donationAmount || 0);
    if (!link) {
      Alert.alert('Unavailable', 'Payment link is not configured by admin yet.');
      return;
    }
    if (!link.startsWith('http')) {
      Alert.alert('Invalid Link', 'Payment link must be a valid URL.');
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
      status: 'pending',
      provider: 'razorpay',
      type: donationType,
      created_at: serverTimestamp(),
    });
    await createPaymentNotification(profile.name, amount, donationType);
    await Linking.openURL(link);
    Alert.alert('Donation Initiated', `${donationType.toUpperCase()} donation recorded and pending admin approval.`);
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
    if (!link.startsWith('http')) {
      setPaymentError('Please enter a valid URL starting with http or https.');
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

  const updateProfileMedia = async (updates: { photo_url?: string; avatar?: string }) => {
    if (!user) return;
    setSavingProfileMedia(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
      await refreshProfile();
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfileMedia(false);
    }
  };

  const validatePickedAsset = (asset: any): string | null => {
    const mime = asset.mimeType || '';
    if (mime && !mime.startsWith('image/')) return 'Only image files are allowed.';
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) return 'Image size must be below 5MB.';
    return null;
  };

  const pickProfileImage = async (source: 'camera' | 'gallery') => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker: any = require('expo-image-picker');
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', `Please allow ${source} access to upload profile image.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled || !result.assets[0]) return;
    const errorMessage = validatePickedAsset(result.assets[0]);
    if (errorMessage) {
      Alert.alert('Invalid Image', errorMessage);
      return;
    }
    await updateProfileMedia({ photo_url: result.assets[0].uri, avatar: profile?.avatar || 'person' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSubtitle}>Madrasa Tus Salikat Lil Banat</Text>
          </View>
          <TouchableOpacity style={styles.moreBtn} onPress={() => router.push('/more')} testID="goto-more-btn">
            <Ionicons name="grid-outline" size={16} color={COLORS.primary} />
            <Text style={styles.moreBtnText}>More</Text>
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} testID="about-scroll">
        {profile && (
          <View style={styles.profileCard} testID="user-profile-card">
            <View style={styles.profileIconCircle}>
              {profile.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.profilePhoto} />
              ) : (
                <Ionicons name={(profile.avatar as any) || 'person'} size={24} color={COLORS.primary} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <Text style={styles.profileEmail}>{profile.email}</Text>
              <Text style={styles.profileRole}>{profile.role}</Text>
              {!!profile.referral_code && <Text style={styles.profileEmail}>Referral Code: {profile.referral_code}</Text>}
              <Text style={styles.profileEmail}>Referrals: {profile.referral_count || 0}</Text>
              <View style={styles.profileActionRow}>
                <TouchableOpacity style={styles.profileMiniBtn} onPress={() => pickProfileImage('gallery')}>
                  <Text style={styles.profileMiniBtnText}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileMiniBtn} onPress={() => pickProfileImage('camera')}>
                  <Text style={styles.profileMiniBtnText}>Camera</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.avatarPickerRow}>
                {AVATAR_OPTIONS.map((avatarName) => (
                  <TouchableOpacity
                    key={avatarName}
                    style={[styles.avatarBtn, profile.avatar === avatarName && styles.avatarBtnActive]}
                    onPress={() => updateProfileMedia({ avatar: avatarName })}
                    disabled={savingProfileMedia}
                  >
                    <Ionicons name={avatarName as any} size={15} color={profile.avatar === avatarName ? '#fff' : COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <TouchableOpacity style={styles.signOutBtn} onPress={signOut} testID="signout-btn">
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && (
          <View style={styles.adminCard} testID="admin-controls">
            <Text style={styles.adminTitle}>Admin Controls</Text>
            <TouchableOpacity style={styles.adminItem} onPress={() => router.push('/admin/users')} testID="manage-users-btn">
              <Ionicons name="people-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Users</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => router.push('/admin/add-book')} testID="admin-add-book-link">
              <Ionicons name="book-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Add Library Book</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => router.push('/admin/manage-academics')} testID="manage-academics-btn">
              <Ionicons name="school-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Teachers & Courses</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => router.push('/admin/payments')} testID="manage-payments-btn">
              <Ionicons name="card-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Manage Payments</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.adminItem} onPress={() => router.push('/admin/analytics')}>
              <Ionicons name="stats-chart-outline" size={20} color={COLORS.primary} />
              <Text style={styles.adminItemText}>Analytics Dashboard</Text>
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
          <SectionCard title="Payments" icon="wallet-outline">
            <Text style={styles.bodyText}>Use a single guided flow for fees and donations.</Text>
            <Text style={[styles.bodyText, { marginTop: 8 }]}>Current Fees: ₹{Number(settings.fees_amount || 0).toFixed(2)}</Text>
            {myPayments[0] ? (
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Latest Payment Status</Text>
                <Text style={styles.statusValue}>{myPayments[0].status}</Text>
              </View>
            ) : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/payment')} testID="open-unified-payment-btn">
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
              <Text style={styles.statusValue}>{myPayments[0].status}</Text>
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
          <Text style={styles.bodyText}>Support the madrasa through Sadqa, Zakat, or Fitra.</Text>
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
          </View>
          <Text style={[styles.bodyText, { marginTop: 10, fontSize: 12 }]}>
            Need Help? Contact us on WhatsApp
          </Text>
        </SectionCard>
        </>
        )}

        <SectionCard title="Feedback & Testimonials" icon="chatbox-ellipses-outline">
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

        <SectionCard title="Social & Help" icon="globe-outline">
          {isAdmin ? (
            <>
              <Text style={styles.inputLabel}>WhatsApp Channel Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_channel' && styles.inputFocused]} placeholder="WhatsApp Channel Link" placeholderTextColor={COLORS.textMuted} value={settings.whatsapp_channel} onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_channel: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_channel')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>WhatsApp Contact</Text>
              <TextInput style={[styles.input, focusedInput === 'social_contact' && styles.inputFocused]} placeholder="WhatsApp Contact (URL or number)" placeholderTextColor={COLORS.textMuted} value={settings.whatsapp_contact} onChangeText={(v) => setSettings((p) => ({ ...p, whatsapp_contact: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_contact')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>Instagram Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_instagram' && styles.inputFocused]} placeholder="Instagram Link" placeholderTextColor={COLORS.textMuted} value={settings.instagram} onChangeText={(v) => setSettings((p) => ({ ...p, instagram: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_instagram')} onBlur={() => setFocusedInput(null)} />
              <Text style={styles.inputLabel}>YouTube / Telegram Link</Text>
              <TextInput style={[styles.input, focusedInput === 'social_youtube' && styles.inputFocused]} placeholder="YouTube / Telegram Link" placeholderTextColor={COLORS.textMuted} value={settings.youtube_telegram} onChangeText={(v) => setSettings((p) => ({ ...p, youtube_telegram: v }))} keyboardType="url" onFocus={() => setFocusedInput('social_youtube')} onBlur={() => setFocusedInput(null)} />
              {socialError ? <Text style={styles.inputError}>{socialError}</Text> : null}
              <TouchableOpacity style={styles.secondaryBtn} onPress={saveSettings}>
                <Text style={styles.secondaryBtnText}>Save Social Links</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {!!settings.whatsapp_channel && <TouchableOpacity style={styles.linkBtn} onPress={() => openSocial(settings.whatsapp_channel)}><Text style={styles.linkBtnText}>WhatsApp Channel</Text></TouchableOpacity>}
              {!!settings.instagram && <TouchableOpacity style={styles.linkBtn} onPress={() => openSocial(settings.instagram)}><Text style={styles.linkBtnText}>Instagram</Text></TouchableOpacity>}
              {!!settings.youtube_telegram && <TouchableOpacity style={styles.linkBtn} onPress={() => openSocial(settings.youtube_telegram)}><Text style={styles.linkBtnText}>YouTube / Telegram</Text></TouchableOpacity>}
            </>
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

        <View style={styles.bismillahCard} testID="bismillah-section">
          <Text style={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
          <Text style={styles.bismillahTranslation}>
            In the name of Allah, the Most Gracious, the Most Merciful
          </Text>
        </View>

        <SectionCard title="Introduction" icon="sparkles">
          <Text style={styles.bodyText}>
            Madrasa Tus Salikat Lil Banat is dedicated to providing comprehensive Islamic education for women.
          </Text>
          <Text style={styles.bodyText}>
            Our curriculum covers Quran, Hadith, Fiqh, Arabic, and practical Islamic lifestyle learning.
          </Text>
        </SectionCard>
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
  headerTitle: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  headerSubtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 2 },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  moreBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  scrollContent: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.lg },
  sectionCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg,
    borderLeftWidth: 4, borderLeftColor: COLORS.secondary, ...SHADOWS.card,
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  sectionCardTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textMain },
  goldAccent: { height: 2, backgroundColor: COLORS.secondary, width: 40, borderRadius: 1, marginBottom: SPACING.md, marginTop: 8 },
  bodyText: { fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
  subTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  inputLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMain, marginBottom: 2 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: 12,
    paddingVertical: 10, backgroundColor: COLORS.surfaceAlt, color: COLORS.textMain, marginBottom: 8,
  },
  inputFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  inputError: { color: COLORS.error, fontSize: 12, fontWeight: '600', marginTop: -4, marginBottom: 8 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  primaryBtnSmall: { flexGrow: 1, minWidth: 150, backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 12, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryBtn: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center' },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '700' },
  linkBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  linkBtnText: { color: COLORS.textMain, fontWeight: '600' },
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
    backgroundColor: COLORS.primary, borderRadius: RADIUS.xxl, padding: SPACING.lg, alignItems: 'center', ...SHADOWS.card,
  },
  bismillah: { fontSize: 28, color: COLORS.secondary, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  bismillahTranslation: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontStyle: 'italic' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, gap: 12, ...SHADOWS.card,
  },
  profileIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  profilePhoto: { width: 48, height: 48, borderRadius: 24 },
  profileName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  profileEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  profileRole: { fontSize: 11, fontWeight: '700', color: COLORS.secondary, textTransform: 'capitalize', marginTop: 2 },
  profileActionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  profileMiniBtn: { borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.full },
  profileMiniBtnText: { color: COLORS.textMain, fontSize: 11, fontWeight: '600' },
  avatarPickerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  avatarBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  avatarBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  signOutBtn: { padding: 10 },
  adminCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card, gap: 8 },
  adminTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  adminItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  adminItemText: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textMain },
  exportBlock: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12, gap: 8 },
  exportRow: { gap: 8 },
  exportBtn: { paddingHorizontal: 10 },
});
