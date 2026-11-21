import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { DEFAULT_ORGANIZATION_NAME } from '@/lib/tenantContext';

interface StudentFeeDueCardProps {
  organizationId?: string;
  organizationName?: string;
  monthlyFee?: number;
}

export function StudentFeeDueCard({
  organizationId,
  organizationName,
  monthlyFee = 500,
}: StudentFeeDueCardProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isFeePaid, setIsFeePaid] = useState<boolean>(false);
  const [paidPaymentDate, setPaidPaymentDate] = useState<string | null>(null);

  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  useEffect(() => {
    let isMounted = true;

    async function checkCurrentMonthPayment() {
      if (!user?.uid) {
        if (isMounted) setLoading(false);
        return;
      }

      // Check if user has permanent scholarship or concession
      if ((profile as any)?.fee_status === 'exempt' || (profile as any)?.scholarship === true) {
        if (isMounted) {
          setIsFeePaid(true);
          setLoading(false);
        }
        return;
      }

      try {
        const paymentsRef = collection(db, 'payments');
        const q = query(
          paymentsRef,
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(10)
        );

        const snap = await getDocs(q);
        let foundPaidThisMonth = false;
        let lastDate: string | null = null;

        snap.forEach((docSnap) => {
          const data = docSnap.data();
          const status = String(data.state || data.status || '').toLowerCase();
          const isSuccess = ['succeeded', 'approved', 'completed'].includes(status);

          let paymentDate: Date | null = null;
          if (data.created_at?.toDate) {
            paymentDate = data.created_at.toDate();
          } else if (data.created_at) {
            paymentDate = new Date(data.created_at);
          }

          if (isSuccess && paymentDate && paymentDate >= startOfMonth) {
            foundPaidThisMonth = true;
            lastDate = paymentDate.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
          }
        });

        if (isMounted) {
          setIsFeePaid(foundPaidThisMonth);
          setPaidPaymentDate(lastDate);
          setLoading(false);
        }
      } catch (err) {
        // Fallback: check profile payment_status
        if (isMounted) {
          if ((profile as any)?.payment_status === 'received' || (profile as any)?.payment_status === 'approved') {
            setIsFeePaid(true);
          } else {
            setIsFeePaid(false);
          }
          setLoading(false);
        }
      }
    }

    checkCurrentMonthPayment();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, (profile as any)?.payment_status, (profile as any)?.fee_status]);

  if (!user || (profile?.role && profile.role !== 'student')) {
    return null;
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#059669" />
      </View>
    );
  }

  const madrasaName = organizationName || DEFAULT_ORGANIZATION_NAME;

  if (isFeePaid) {
    return (
      <View style={styles.paidContainer}>
        <View style={styles.paidIconWrap}>
          <Ionicons name="checkmark-circle" size={24} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.paidBadgeRow}>
            <Text style={styles.paidBadgeText}>✓ {monthName} Fee Paid (ادا شدہ)</Text>
          </View>
          <Text style={styles.paidSubtitle}>
            {madrasaName} • Monthly fee is cleared{paidPaymentDate ? ` on ${paidPaymentDate}` : ''}.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.paidHistoryBtn}
          onPress={() => router.push('/payment')}
          accessibilityRole="button"
          accessibilityLabel="View payment history"
        >
          <Text style={styles.paidHistoryBtnText}>Receipts</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.dueContainer}>
      {/* Decorative Gold Header Bar */}
      <View style={styles.dueHeaderRow}>
        <View style={styles.dueTagWrap}>
          <Ionicons name="card-outline" size={15} color="#B45309" />
          <Text style={styles.dueTagText}>MONTHLY FEE DUE • ماہانہ فیس</Text>
        </View>
        <View style={styles.monthBadge}>
          <Text style={styles.monthBadgeText}>{monthName}</Text>
        </View>
      </View>

      <View style={styles.bodyRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.amountText}>₹{monthlyFee} <Text style={styles.amountSub}>/ Month</Text></Text>
          <Text style={styles.dueTitle}>Academic Fee • {madrasaName}</Text>
          <Text style={styles.dueDescription}>
            Support your madrasa education. Pay securely in 1-tap using Google Pay, PhonePe, Paytm, or BHIM UPI.
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.payNowBtn}
          onPress={() => router.push('/payment')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Pay Monthly Fee via Direct UPI"
        >
          <Ionicons name="flash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.payNowBtnText}>Pay via Direct UPI (GPay/PhonePe)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.concessionBtn}
          onPress={() => router.push('/payment')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Apply for Fee Concession"
        >
          <Text style={styles.concessionBtnText}>Concession (امداد)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  paidIconWrap: {
    marginRight: 10,
  },
  paidBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paidBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  paidSubtitle: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  paidHistoryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  paidHistoryBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  dueContainer: {
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
    padding: SPACING.md,
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    ...SHADOWS.card,
  },
  dueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dueTagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  monthBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  monthBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#B45309',
  },
  bodyRow: {
    marginBottom: 10,
  },
  amountText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#064E3B',
  },
  amountSub: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  dueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 2,
  },
  dueDescription: {
    fontSize: 11.5,
    color: '#4B5563',
    marginTop: 2,
    lineHeight: 16,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  payNowBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    ...SHADOWS.card,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  concessionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  concessionBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6B7280',
  },
});
