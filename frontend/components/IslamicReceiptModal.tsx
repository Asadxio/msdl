import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  exportAndShareReceipt,
  shareReceiptToWhatsApp,
  formatCategoryLabel,
  type FeeReceiptData,
} from '@/lib/receiptGenerator';

interface IslamicReceiptModalProps {
  visible: boolean;
  receipt: FeeReceiptData | null;
  onClose: () => void;
}

export const IslamicReceiptModal: React.FC<IslamicReceiptModalProps> = ({
  visible,
  receipt,
  onClose,
}) => {
  const [exporting, setExporting] = useState(false);

  if (!receipt) return null;

  const handleExportShare = async () => {
    setExporting(true);
    try {
      await exportAndShareReceipt(receipt);
    } catch (err: any) {
      Alert.alert('Export Error', err?.message || 'Failed to export receipt.');
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      await shareReceiptToWhatsApp(receipt);
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err?.message || 'Failed to open WhatsApp.');
    }
  };

  const categoryLabel = formatCategoryLabel(receipt.category);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.receiptIconCircle}>
                <Ionicons name="receipt" size={18} color={COLORS.secondary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Official Fee Receipt</Text>
                <Text style={styles.headerSub}>Madrasatu-s-Salikat Lil Banat</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Parchment Receipt Body */}
            <View style={styles.receiptPaper}>
              {/* Islamic Calligraphy Top */}
              <View style={styles.paperHeader}>
                <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
                <Text style={styles.madrasaNameText}>مدرسۃ السالکات للبنات</Text>
                <Text style={styles.voucherBadgeText}>VERIFIED ELECTRONIC RECEIPT</Text>
              </View>

              {/* Receipt Metadata Row */}
              <View style={styles.metaRow}>
                <View>
                  <Text style={styles.metaLabel}>RECEIPT NO.</Text>
                  <Text style={styles.metaSerial}>{receipt.receiptId}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.metaLabel}>DATE</Text>
                  <Text style={styles.metaVal}>{receipt.issueDateGregorian}</Text>
                  {receipt.issueDateHijri ? (
                    <Text style={styles.metaHijri}>{receipt.issueDateHijri}</Text>
                  ) : null}
                </View>
              </View>

              {/* Student Name Card */}
              <View style={styles.studentCard}>
                <Text style={styles.metaLabel}>RECEIVED FROM</Text>
                <Text style={styles.studentName}>{receipt.studentName}</Text>
                {receipt.studentEmail ? (
                  <Text style={styles.studentEmail}>{receipt.studentEmail}</Text>
                ) : null}
                {receipt.studentId ? (
                  <Text style={styles.studentId}>Roll / UID: {receipt.studentId}</Text>
                ) : null}
              </View>

              {/* Purpose & Breakdown Table */}
              <View style={styles.tableCard}>
                <View style={styles.tableRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.purposeTitle}>{categoryLabel}</Text>
                    {receipt.courseName ? (
                      <Text style={styles.courseSubtitle}>{receipt.courseName}</Text>
                    ) : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.methodVal}>{receipt.paymentMethod}</Text>
                    {receipt.transactionId ? (
                      <Text style={styles.txId} numberOfLines={1}>
                        Ref: {receipt.transactionId.slice(-8)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {/* Amount Paid Box */}
              <View style={styles.amountBox}>
                <View>
                  <Text style={styles.amountLabel}>TOTAL PAID</Text>
                  <View style={styles.statusPill}>
                    <Ionicons name="checkmark-circle" size={12} color="#FFF" />
                    <Text style={styles.statusPillText}>{receipt.status || 'Verified'}</Text>
                  </View>
                </View>
                <Text style={styles.amountTotal}>₹{receipt.amount.toLocaleString()}</Text>
              </View>

              {/* Seal Footer */}
              <View style={styles.paperFooter}>
                <View>
                  <Text style={styles.footerBrand}>Madrasatu-s-Salikat</Text>
                  <Text style={styles.footerNote}>Authorized Electronic Voucher</Text>
                </View>
                <View style={styles.sealCircle}>
                  <Text style={styles.sealText}>MSLB{'\n'}SEAL</Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.whatsappBtn}
              onPress={handleWhatsAppShare}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
              <Text style={styles.whatsappBtnText}>Send to Parent WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shareBtn}
              onPress={handleExportShare}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#005F46" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#005F46" />
                  <Text style={styles.shareBtnText}>HTML Receipt</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingBottom: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  receiptIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#005F46',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  receiptPaper: {
    backgroundColor: '#FDFBF7',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  paperHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200, 168, 78, 0.3)',
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md,
  },
  bismillahText: {
    fontSize: 16,
    color: '#005F46',
    fontWeight: '700',
  },
  madrasaNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#C8A84E',
    marginTop: 2,
  },
  voucherBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#005F46',
    marginTop: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
  },
  metaSerial: {
    fontSize: 13,
    fontWeight: '800',
    color: '#005F46',
    marginTop: 2,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 2,
  },
  metaHijri: {
    fontSize: 10,
    color: '#C8A84E',
    fontWeight: '600',
  },
  studentCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: SPACING.md,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
    marginTop: 2,
  },
  studentEmail: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  studentId: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: SPACING.md,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  purposeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  courseSubtitle: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  methodVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  txId: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  amountBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#10B981',
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#047857',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    gap: 4,
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFF',
  },
  amountTotal: {
    fontSize: 24,
    fontWeight: '900',
    color: '#065F46',
  },
  paperFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 168, 78, 0.3)',
    paddingTop: SPACING.sm,
  },
  footerBrand: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  footerNote: {
    fontSize: 9,
    color: COLORS.textSecondary,
  },
  sealCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#C8A84E',
    textAlign: 'center',
    lineHeight: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: 8,
    gap: 10,
  },
  whatsappBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: RADIUS.full,
    paddingVertical: 13,
    gap: 8,
    ...SHADOWS.card,
  },
  whatsappBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    gap: 6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#005F46',
  },
});
