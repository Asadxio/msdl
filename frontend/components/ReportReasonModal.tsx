import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { REPORT_REASONS, type ReportReason } from '@/lib/ugcReports';

export function ReportReasonModal({
  visible,
  title = 'Report content',
  onClose,
  onSelectReason,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onSelectReason: (reason: ReportReason) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close report options">
              <Ionicons name="close" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Choose the reason that best describes the issue.</Text>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity key={reason} style={styles.reasonBtn} onPress={() => onSelectReason(reason)}>
              <Text style={styles.reasonText}>{reason}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  dismissArea: { flex: 1 },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, gap: 10, ...SHADOWS.card },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 999, backgroundColor: COLORS.border, marginBottom: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: COLORS.textMain, fontSize: 18, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surfaceAlt },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 12, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt },
  reasonText: { color: COLORS.textMain, fontSize: 14, fontWeight: '700' },
});
