import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, orderBy, query, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { db } from '@/lib/firebase';
import { normalizeFirebaseError } from '@/lib/errors';
import { isValidHttpsUrl, prepareExternalUrl } from '@/lib/links';
import { apiUrl } from '@/lib/api';

type PaymentType = 'fees' | 'sadqa' | 'zakat' | 'fitra' | 'langar';
const DEV_RAZORPAY_TEST_LINK = 'https://rzp.io/l/test123';

const PAYMENT_REF_PATTERN = /^[a-zA-Z0-9_./# -]{4,80}$/;

function sanitizeTransactionRef(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}


export default function PaymentFlowScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ courseId?: string }>();
  const { user, profile } = useAuth();
  const { courses } = useData();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [verificationState, setVerificationState] = useState<'idle' | 'verifying' | 'awaiting_confirmation' | 'reconciling' | 'recovery_pending'>('idle');
  const [currentPaymentId, setCurrentPaymentId] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType>('fees');
  const [selectedCourseId, setSelectedCourseId] = useState(String(params.courseId || '').trim());
  const [feesAmount, setFeesAmount] = useState(0);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [razorpayLink, setRazorpayLink] = useState('');
  const [statusText, setStatusText] = useState('No payment record yet.');
  const [error, setError] = useState('');
  const [openingPayment, setOpeningPayment] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const getPaymentSettings = async () => {
    const globalSnap = await getDoc(doc(db, 'app_settings', 'global'));
    const platformSnap = await getDoc(doc(db, 'app_settings', 'platform'));
    const merged = {
      ...(platformSnap.exists() ? (platformSnap.data() as Record<string, unknown>) : {}),
      ...(globalSnap.exists() ? (globalSnap.data() as Record<string, unknown>) : {}),
    };
    const fee = Number(merged.fees_amount || 0);
    const link = String(merged.razorpay_link || '');
    return { fee, link: link || (__DEV__ ? DEV_RAZORPAY_TEST_LINK : '') };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { fee, link: effectiveLink } = await getPaymentSettings();
        setFeesAmount(fee);
        setRazorpayLink(effectiveLink);
        setAmount(String(fee || ''));

        if (!user?.uid) return;
        const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('user_id', '==', user.uid), orderBy('created_at', 'desc')));
        if (!paymentsSnap.empty) {
          const latest = paymentsSnap.docs[0].data() as { status?: string; type?: string; amount?: number };
          setStatusText(`${latest.status || (latest as any).state || 'pending'} • ${latest.type || 'fees'} • ₹${Number(latest.amount || 0).toFixed(2)}`);
        }
      } catch (err) {
        setError(normalizeFirebaseError(err, 'Could not load payment settings.'));
      }
    };
    load().catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (paymentType === 'fees') {
      setAmount(String(feesAmount || ''));
    }
  }, [feesAmount, paymentType]);

  const parsedAmount = useMemo(() => Number(amount || 0), [amount]);
  const selectedCourse = useMemo(() => courses.find((course) => course.id === selectedCourseId) || null, [courses, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseId || !params.courseId) return;
    setSelectedCourseId(String(params.courseId || '').trim());
  }, [params.courseId, selectedCourseId]);

  const onContinueFromAmount = () => {
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }
    if (paymentType === 'fees' && !selectedCourseId) {
      setError('Please select the course this fee payment is for.');
      return;
    }
    setError('');
    setStep(2);
  };

  const onPayNow = async () => {
    if (!razorpayLink.trim()) {
      setError('Payment link is not configured yet. Please contact admin or use manual payment confirmation.');
      Alert.alert('Payment Link Missing', 'Razorpay link is not configured. Please contact admin for a manual payment method.');
      return;
    }
    if (!isValidHttpsUrl(razorpayLink.trim())) {
      setError('Configured payment link is invalid. Please contact admin.');
      Alert.alert('Invalid Payment Link', 'Configured Razorpay link is invalid. Please contact admin.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setError('');
    setOpeningPayment(true);
    try {
      const safePaymentUrl = prepareExternalUrl(razorpayLink);
      if (!safePaymentUrl) {
        Alert.alert('Invalid Payment Link', 'Configured Razorpay link is invalid. Please contact admin.');
        return;
      }
      let opened = true;
      await Linking.openURL(safePaymentUrl).catch(() => {
        opened = false;
        Alert.alert('Payment Link Unavailable', 'Unable to open payment link. Please contact admin for manual payment support.');
      });
      if (opened) setStep(3);
    } finally {
      setOpeningPayment(false);
    }
  };


  useEffect(() => {
    if (!user?.uid || !currentPaymentId || verificationState !== 'reconciling') return;
    const timer = setInterval(async () => {
      try {
        const snap = await getDoc(doc(db, 'payments', currentPaymentId));
        if (!snap.exists()) return;
        const data = snap.data() as any;
        const st = String(data.state || data.status || 'processing');
        setStatusText(`${st} • ${String(data.type || paymentType)} • ₹${Number(data.amount || parsedAmount).toFixed(2)}`);
        if (['succeeded', 'failed', 'rejected', 'refunded', 'disputed', 'expired', 'cancelled'].includes(st)) {
          setVerificationState('idle');
          clearInterval(timer);
        }
      } catch {
        setVerificationState('recovery_pending');
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [user?.uid, currentPaymentId, verificationState, paymentType, parsedAmount]);

  const onConfirmPayment = async () => {
    if (!user?.uid || !profile) return;
    const safeReference = sanitizeTransactionRef(reference);
    if (!safeReference) {
      setError('Please enter transaction reference / note.');
      return;
    }
    if (!PAYMENT_REF_PATTERN.test(safeReference)) {
      setError('Reference must be 4-80 chars and only include letters, numbers, spaces, . / # _ -');
      return;
    }
    if (paymentType === 'fees' && !selectedCourseId) {
      setError('Please select the course this fee payment is for.');
      return;
    }
    setError('');
    try {
      setSubmittingPayment(true);
      const operationId = `pay_${paymentType}_${Math.round(parsedAmount*100)}_${Date.now()}`;
      setVerificationState('verifying');
      const initRes = await fetch(apiUrl('/payments/initiate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          operation_id: operationId,
          payment_type: paymentType,
          amount: parsedAmount,
          currency: 'INR',
          ...(paymentType === 'fees' ? { course_id: selectedCourseId } : {}),
        }),
      });
      if (!initRes.ok) throw new Error('Payment initiation failed');
      const initJson = await initRes.json();

      setVerificationState('awaiting_confirmation');
      const confirmRes = await fetch(apiUrl('/payments/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ payment_id: initJson.payment_id, transaction_ref: safeReference }),
      });
      if (!confirmRes.ok) throw new Error('Payment confirmation failed');
      setCurrentPaymentId(initJson.payment_id);
      setVerificationState('reconciling');
      setStatusText(`processing • ${paymentType}${selectedCourse ? ` • ${selectedCourse.name}` : ''} • awaiting admin verification`);
      setStep(4);
    } catch (err) {
      setVerificationState('recovery_pending');
      setError(normalizeFirebaseError(err, 'Failed to save payment confirmation.'));
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={18} color={COLORS.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Payment Flow</Text>
        <Text style={styles.subtitle}>Select → Pay → Confirm → Status</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.stepRow}>
          {[1, 2, 3, 4].map((item) => (
            <View key={item} style={[styles.stepDot, step >= (item as 1 | 2 | 3 | 4) && styles.stepDotActive]} />
          ))}
        </View>

        {step === 1 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1) Select Payment Type</Text>
            <View style={styles.paymentCategory}>
              <View style={styles.paymentCategoryHeader}>
                <Ionicons name="school-outline" size={18} color={COLORS.primary} />
                <Text style={styles.paymentCategoryTitle}>Fees</Text>
              </View>
              <View style={styles.choiceRow}>
                <TouchableOpacity style={[styles.choiceChip, paymentType === 'fees' && styles.choiceChipActive]} onPress={() => setPaymentType('fees')}>
                  <Text style={[styles.choiceText, paymentType === 'fees' && styles.choiceTextActive]}>FEES</Text>
                </TouchableOpacity>
              </View>
            </View>
            {paymentType === 'fees' ? (
              <View style={styles.paymentCategory}>
                <View style={styles.paymentCategoryHeader}>
                  <Ionicons name="book-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.paymentCategoryTitle}>Course for enrollment</Text>
                </View>
                <View style={styles.choiceRow}>
                  {courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={[styles.choiceChip, selectedCourseId === course.id && styles.choiceChipActive]}
                      onPress={() => setSelectedCourseId(course.id)}
                    >
                      <Text style={[styles.choiceText, selectedCourseId === course.id && styles.choiceTextActive]}>{course.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={styles.paymentCategory}>
              <View style={styles.paymentCategoryHeader}>
                <Ionicons name="heart-outline" size={18} color={COLORS.primary} />
                <Text style={styles.paymentCategoryTitle}>Donations</Text>
              </View>
              <View style={styles.choiceRow}>
                {(['sadqa', 'zakat', 'fitra', 'langar'] as PaymentType[]).map((type) => (
                  <TouchableOpacity key={type} style={[styles.choiceChip, paymentType === type && styles.choiceChipActive]} onPress={() => setPaymentType(type)}>
                    <Text style={[styles.choiceText, paymentType === type && styles.choiceTextActive]}>{type.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter amount"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={onContinueFromAmount}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2) Pay</Text>
            <Text style={styles.bodyText}>Type: {paymentType.toUpperCase()}</Text>
            {paymentType === 'fees' ? <Text style={styles.bodyText}>Course: {selectedCourse?.name || selectedCourseId}</Text> : null}
            <Text style={styles.bodyText}>Amount: ₹{parsedAmount.toFixed(2)}</Text>
            <TouchableOpacity style={[styles.primaryBtn, openingPayment && styles.primaryBtnDisabled]} onPress={onPayNow} disabled={openingPayment}>
              {openingPayment ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Open Razorpay</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3) Confirm</Text>
            <Text style={styles.label}>Transaction Reference / Note</Text>
            <TextInput
              style={styles.input}
              value={reference}
              onChangeText={setReference}
              placeholder="Enter UPI ref / transaction id"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={[styles.primaryBtn, submittingPayment && styles.primaryBtnDisabled]} onPress={onConfirmPayment} disabled={submittingPayment}>
              {submittingPayment ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Submit Confirmation</Text>}
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>4) Status</Text>
            <Text style={styles.bodyText}>{statusText}</Text>
            <Text style={styles.bodyText}>Verification: {verificationState.replace('_', ' ')}</Text>
            <Text style={[styles.bodyText, { marginTop: SPACING.xs }]}>Admin will verify and update your status shortly.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(1)}>
              <Text style={styles.primaryBtnText}>New Payment</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.xs },
  backText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  title: { ...TYPOGRAPHY.title, color: COLORS.text },
  subtitle: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  body: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg, gap: SPACING.sm },
  stepRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.sm },
  stepDot: { height: 6, flex: 1, backgroundColor: COLORS.border, borderRadius: 3 },
  stepDotActive: { backgroundColor: COLORS.primary },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOWS.card, gap: SPACING.sm },
  cardTitle: { ...TYPOGRAPHY.heading, fontSize: 18, color: COLORS.text },
  paymentCategory: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.sm, gap: SPACING.xs, backgroundColor: COLORS.surfaceAlt },
  paymentCategoryHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  paymentCategoryTitle: { ...TYPOGRAPHY.label, color: COLORS.text, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  choiceChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
  choiceChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  choiceText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  choiceTextActive: { color: COLORS.primary },
  label: { ...TYPOGRAPHY.label, color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.background },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.xs },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bodyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  error: { color: COLORS.error, ...TYPOGRAPHY.body },
});
