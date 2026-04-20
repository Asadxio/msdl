import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { normalizeFirebaseError } from '@/lib/errors';

type PaymentType = 'fees' | 'sadqa' | 'zakat' | 'fitra';

export default function PaymentFlowScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [paymentType, setPaymentType] = useState<PaymentType>('fees');
  const [feesAmount, setFeesAmount] = useState(0);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [razorpayLink, setRazorpayLink] = useState('');
  const [statusText, setStatusText] = useState('No payment record yet.');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'app_settings', 'global'));
        const settingsData = settingsSnap.exists() ? (settingsSnap.data() as any) : {};
        const fee = Number(settingsData.fees_amount || 0);
        const link = String(settingsData.razorpay_link || '');
        setFeesAmount(fee);
        setRazorpayLink(link);
        setAmount(String(fee || ''));

        if (!user?.uid) return;
        const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('user_id', '==', user.uid), orderBy('created_at', 'desc')));
        if (!paymentsSnap.empty) {
          const latest = paymentsSnap.docs[0].data() as any;
          setStatusText(`${latest.status || 'pending'} • ${latest.type || 'fees'} • ₹${Number(latest.amount || 0).toFixed(2)}`);
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

  const onPayNow = async () => {
    if (!razorpayLink.trim()) {
      setError('Payment link is not configured yet. Please contact admin.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setError('');
    await Linking.openURL(razorpayLink).catch(() => {
      Alert.alert('Error', 'Unable to open payment link');
    });
    setStep(3);
  };

  const onConfirmPayment = async () => {
    if (!user?.uid || !profile) return;
    if (!reference.trim()) {
      setError('Please enter transaction reference / note.');
      return;
    }
    setError('');
    try {
      await addDoc(collection(db, 'payments'), {
        user_id: user.uid,
        user_name: profile.name,
        amount: parsedAmount,
        status: 'pending',
        provider: 'razorpay',
        type: paymentType,
        transaction_ref: reference.trim(),
        created_at: serverTimestamp(),
      });
      setStatusText('pending • awaiting admin confirmation');
      setStep(4);
    } catch (err) {
      setError(normalizeFirebaseError(err, 'Failed to save payment confirmation.'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}> 
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
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
            <View style={styles.choiceRow}>
              {(['fees', 'sadqa', 'zakat', 'fitra'] as PaymentType[]).map((type) => (
                <TouchableOpacity key={type} style={[styles.choiceChip, paymentType === type && styles.choiceChipActive]} onPress={() => setPaymentType(type)}>
                  <Text style={[styles.choiceText, paymentType === type && styles.choiceTextActive]}>{type.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              editable={paymentType !== 'fees'}
              placeholder="Enter amount"
              placeholderTextColor={COLORS.textMuted}
            />
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2) Pay</Text>
            <Text style={styles.bodyText}>Type: {paymentType.toUpperCase()}</Text>
            <Text style={styles.bodyText}>Amount: ₹{parsedAmount.toFixed(2)}</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onPayNow}>
              <Text style={styles.primaryBtnText}>Open Razorpay</Text>
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
            <TouchableOpacity style={styles.primaryBtn} onPress={onConfirmPayment}>
              <Text style={styles.primaryBtnText}>Submit Confirmation</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>4) Status</Text>
            <Text style={styles.bodyText}>{statusText}</Text>
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
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  choiceChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 8 },
  choiceChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  choiceText: { ...TYPOGRAPHY.label, color: COLORS.textMuted },
  choiceTextActive: { color: COLORS.primary },
  label: { ...TYPOGRAPHY.label, color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.text, backgroundColor: COLORS.background },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.xs },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  bodyText: { ...TYPOGRAPHY.body, color: COLORS.textMuted },
  error: { color: COLORS.error, ...TYPOGRAPHY.body },
});
