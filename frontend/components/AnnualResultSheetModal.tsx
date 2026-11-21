import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { DEFAULT_ORGANIZATION_NAME } from '@/lib/tenantContext';

export interface SubjectResult {
  code: string;
  name: string;
  nameUrdu: string;
  totalMarks: number;
  obtainedMarks: number;
  grade: string;
}

export interface AnnualResultData {
  studentName: string;
  rollNumber: string;
  academicYear: string;
  hijriYear: string;
  programName: string;
  institutionName?: string;
  institutionNameArabic?: string;
  subjects: SubjectResult[];
  attendancePercent: number;
  examDate: string;
  overallGrade: string;
  overallGradeUrdu: string;
  resultStatus: 'Passed' | 'Distinction' | 'Promoted';
}

interface AnnualResultSheetModalProps {
  visible: boolean;
  onClose: () => void;
  resultData: AnnualResultData;
}

export function AnnualResultSheetModal({
  visible,
  onClose,
  resultData,
}: AnnualResultSheetModalProps) {
  const insets = useSafeAreaInsets();

  const totalMarksSum = resultData.subjects.reduce((sum, s) => sum + s.totalMarks, 0);
  const obtainedMarksSum = resultData.subjects.reduce((sum, s) => sum + s.obtainedMarks, 0);
  const percentage = totalMarksSum > 0 ? Math.round((obtainedMarksSum / totalMarksSum) * 100) : 0;

  const handleShareResult = async () => {
    const institution = resultData.institutionName || DEFAULT_ORGANIZATION_NAME;
    const arabicTitle = resultData.institutionNameArabic || 'مدرسۃ السالکات للبنات';

    const textLines = [
      `📜 *ANNUAL RESULT SHEET / سالانہ تعلیمی کارکردگی رپورٹ*`,
      `🏛️ ${institution} (${arabicTitle})`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Talibah Name:* ${resultData.studentName}`,
      `🆔 *Roll Number:* ${resultData.rollNumber}`,
      `📖 *Program:* ${resultData.programName}`,
      `📅 *Session:* ${resultData.hijriYear} / ${resultData.academicYear}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📊 *ACADEMIC MARKS:*`,
      ...resultData.subjects.map(
        (s) => `• ${s.name} (${s.nameUrdu}): ${s.obtainedMarks}/${s.totalMarks} [Grade: ${s.grade}]`
      ),
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `🏆 *Grand Total:* ${obtainedMarksSum} / ${totalMarksSum} (${percentage}%)`,
      `🎖️ *Distinction Grade:* ${resultData.overallGrade} (${resultData.overallGradeUrdu})`,
      `📅 *Attendance:* ${resultData.attendancePercent}%`,
      `✅ *Final Result:* ${resultData.resultStatus.toUpperCase()} (کامیاب)`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `Official Report issued by ${institution} Digital Portal.`,
    ];

    const message = textLines.join('\n');

    try {
      await Share.share({
        title: `Annual Result — ${resultData.studentName}`,
        message,
      });
    } catch {
      const encoded = encodeURIComponent(message);
      Linking.openURL(`whatsapp://send?text=${encoded}`).catch(() =>
        Linking.openURL(`https://wa.me/?text=${encoded}`)
      );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close Marksheet"
          >
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>

          <Text style={styles.topBarTitle}>کارکردگی رپورٹ (Annual Result)</Text>

          <TouchableOpacity
            style={styles.shareTopBtn}
            onPress={handleShareResult}
            accessibilityRole="button"
            accessibilityLabel="Share Result via WhatsApp"
          >
            <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.shareTopBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Official Marksheet Frame with Double Islamic Border */}
          <View style={styles.sheetFrame}>
            {/* Header Section */}
            <View style={styles.sheetHeader}>
              <Text style={styles.bismillahText}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</Text>
              <Text style={styles.institutionArabic}>
                {resultData.institutionNameArabic || 'مدرسۃ السالکات للبنات'}
              </Text>
              <Text style={styles.institutionEnglish}>
                {resultData.institutionName || DEFAULT_ORGANIZATION_NAME}
              </Text>
              <View style={styles.goldDivider} />
              <Text style={styles.sheetMainTitle}>ANNUAL ACADEMIC RESULT SHEET</Text>
              <Text style={styles.sheetUrduTitle}>سالانہ تعلیمی کارکردگی رپورٹ</Text>
              <Text style={styles.sessionText}>
                Session: {resultData.hijriYear} H • {resultData.academicYear} CE
              </Text>
            </View>

            {/* Student Info Grid */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>TALİBAH NAME (اسم طالبہ):</Text>
                  <Text style={styles.infoValue}>{resultData.studentName}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>ROLL NUMBER (رول نمبر):</Text>
                  <Text style={styles.infoValue}>{resultData.rollNumber}</Text>
                </View>
              </View>
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>PROGRAM (شعبہ):</Text>
                  <Text style={styles.infoValue}>{resultData.programName}</Text>
                </View>
                <View style={styles.infoCol}>
                  <Text style={styles.infoLabel}>EXAM DATE (تاریخ امتحان):</Text>
                  <Text style={styles.infoValue}>{resultData.examDate}</Text>
                </View>
              </View>
            </View>

            {/* Academic Subjects Table */}
            <View style={styles.tableCard}>
              <View style={styles.tableHeader}>
                <Text style={[styles.thText, { flex: 2 }]}>Subject (مضمون)</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>Max</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'center' }]}>Marks</Text>
                <Text style={[styles.thText, { flex: 1, textAlign: 'right' }]}>Grade</Text>
              </View>

              {resultData.subjects.map((sub, idx) => (
                <View
                  key={sub.code || idx}
                  style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                >
                  <View style={{ flex: 2 }}>
                    <Text style={styles.tdSubjectName}>{sub.name}</Text>
                    <Text style={styles.tdSubjectUrdu}>{sub.nameUrdu}</Text>
                  </View>
                  <Text style={[styles.tdValue, { flex: 1, textAlign: 'center' }]}>
                    {sub.totalMarks}
                  </Text>
                  <Text
                    style={[
                      styles.tdValue,
                      { flex: 1, textAlign: 'center', fontWeight: '800', color: '#064E3B' },
                    ]}
                  >
                    {sub.obtainedMarks}
                  </Text>
                  <View style={[styles.gradePillWrap, { flex: 1, alignItems: 'flex-end' }]}>
                    <View style={styles.gradePill}>
                      <Text style={styles.gradePillText}>{sub.grade}</Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Table Total Summary Row */}
              <View style={styles.tableTotalRow}>
                <Text style={[styles.totalLabel, { flex: 2 }]}>GRAND TOTAL (مجموعی نمبرات)</Text>
                <Text style={[styles.totalValue, { flex: 1, textAlign: 'center' }]}>
                  {totalMarksSum}
                </Text>
                <Text
                  style={[
                    styles.totalValue,
                    { flex: 1, textAlign: 'center', color: '#065F46', fontWeight: '900' },
                  ]}
                >
                  {obtainedMarksSum}
                </Text>
                <Text style={[styles.totalPercentText, { flex: 1, textAlign: 'right' }]}>
                  {percentage}%
                </Text>
              </View>
            </View>

            {/* Performance Summary Badges */}
            <View style={styles.performanceRow}>
              <View style={styles.perfCard}>
                <Text style={styles.perfLabel}>DISTINCTION GRADE</Text>
                <Text style={styles.perfValue}>{resultData.overallGrade}</Text>
                <Text style={styles.perfUrdu}>{resultData.overallGradeUrdu}</Text>
              </View>

              <View style={styles.perfCard}>
                <Text style={styles.perfLabel}>ATTENDANCE</Text>
                <Text style={styles.perfValue}>{resultData.attendancePercent}%</Text>
                <Text style={styles.perfUrdu}>حاضری کا تناسب</Text>
              </View>

              <View style={[styles.perfCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                <Text style={[styles.perfLabel, { color: '#065F46' }]}>FINAL RESULT</Text>
                <Text style={[styles.perfValue, { color: '#047857' }]}>PASSED</Text>
                <Text style={[styles.perfUrdu, { color: '#059669' }]}>کامیاب</Text>
              </View>
            </View>

            {/* Official Academic Seal & Signature Lines */}
            <View style={styles.sealSection}>
              <View style={styles.sealCol}>
                <View style={styles.sealBox}>
                  <Ionicons name="ribbon" size={26} color="#D4AF37" />
                  <Text style={styles.sealText}>OFFICIAL ACADEMIC SEAL</Text>
                  <Text style={styles.sealSubtext}>مہر مدرسہ</Text>
                </View>
              </View>

              <View style={styles.sigCol}>
                <View style={styles.sigLine} />
                <Text style={styles.sigTitle}>ناظمِ تعلیمات / صدر مدرس</Text>
                <Text style={styles.sigSubtitle}>Head of Academic Examinations</Text>
              </View>
            </View>

            {/* Verification Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerNote}>
                This official mark sheet is digitally certified by {resultData.institutionName || DEFAULT_ORGANIZATION_NAME}.
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  shareTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  shareTopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: SPACING.md,
  },
  sheetFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    borderColor: '#D4AF37',
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  bismillahText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#064E3B',
    marginBottom: 4,
  },
  institutionArabic: {
    fontSize: 20,
    fontWeight: '800',
    color: '#064E3B',
    letterSpacing: 0.5,
  },
  institutionEnglish: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  goldDivider: {
    width: 120,
    height: 2,
    backgroundColor: '#D4AF37',
    marginVertical: 8,
  },
  sheetMainTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  sheetUrduTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 2,
  },
  sessionText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tableCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064E3B',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  tableRowAlt: {
    backgroundColor: '#F8FAFC',
  },
  tdSubjectName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  tdSubjectUrdu: {
    fontSize: 11,
    color: '#059669',
    marginTop: 1,
  },
  tdValue: {
    fontSize: 12,
    color: '#334155',
  },
  gradePillWrap: {
    justifyContent: 'center',
  },
  gradePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  tableTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#F59E0B',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  totalValue: {
    fontSize: 12,
    color: '#92400E',
  },
  totalPercentText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#065F46',
  },
  performanceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.md,
  },
  perfCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  perfLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  perfValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#064E3B',
    marginTop: 2,
  },
  perfUrdu: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  sealSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 6,
  },
  sealCol: {
    alignItems: 'center',
  },
  sealBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#D4AF37',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF5',
  },
  sealText: {
    fontSize: 6.5,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
    marginTop: 2,
  },
  sealSubtext: {
    fontSize: 9,
    fontWeight: '700',
    color: '#065F46',
  },
  sigCol: {
    flex: 1,
    alignItems: 'center',
    paddingLeft: SPACING.lg,
  },
  sigLine: {
    width: '80%',
    height: 1.5,
    backgroundColor: '#064E3B',
    marginBottom: 4,
  },
  sigTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064E3B',
  },
  sigSubtitle: {
    fontSize: 9.5,
    color: '#64748B',
  },
  footerRow: {
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    marginTop: 4,
  },
  footerNote: {
    fontSize: 9,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
