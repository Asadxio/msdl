import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  CURRICULUM_TEMPLATES,
  importCurriculumTemplateToOrg,
  CurriculumTemplate,
} from '@/lib/curriculumTemplates';

interface CurriculumTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  organizationId: string;
  organizationName?: string;
  onImportSuccess?: () => void;
}

export const CurriculumTemplateModal: React.FC<CurriculumTemplateModalProps> = ({
  visible,
  onClose,
  organizationId,
  organizationName,
  onImportSuccess,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<CurriculumTemplate | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async (template: CurriculumTemplate) => {
    Alert.alert(
      'Import Curriculum Template',
      `Import "${template.title}" into ${organizationName || 'your madrasa'}? This will add ${template.courses.length} courses with full subject breakdowns.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import Now',
          style: 'default',
          onPress: async () => {
            setImporting(true);
            try {
              const res = await importCurriculumTemplateToOrg(
                organizationId,
                template.id,
                organizationName
              );
              Alert.alert('Curriculum Imported! 🎉', res.message);
              onImportSuccess?.();
              onClose();
            } catch (err: any) {
              Alert.alert('Import Failed', err?.message || 'Could not import curriculum.');
            } finally {
              setImporting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.arabicHeader}>نِصَابُ التَّعْلِيمِ الإِسْلَامِيّ</Text>
              <Text style={styles.headerTitle}>1-Click Curriculum Templates</Text>
              <Text style={styles.headerSub}>
                Import standard accredited syllabi into {organizationName || 'your madrasa'} in 1 tap.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          {/* Body List */}
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {CURRICULUM_TEMPLATES.map((tmpl) => (
              <View key={tmpl.id} style={styles.templateCard}>
                <View style={styles.badgeRow}>
                  <span style={styles.badgeText}>{tmpl.badge}</span>
                </View>

                <Text style={styles.tmplArabicTitle}>{tmpl.titleArabic}</Text>
                <Text style={styles.tmplTitle}>{tmpl.title}</Text>
                <Text style={styles.tmplDesc}>{tmpl.description}</Text>

                <View style={styles.coursesListHeader}>
                  <Ionicons name="book-outline" size={16} color={COLORS.primary} />
                  <Text style={styles.coursesCountText}>
                    {tmpl.courses.length} Structured Courses & Levels Included:
                  </Text>
                </View>

                <View style={styles.coursePillsWrap}>
                  {tmpl.courses.map((c, idx) => (
                    <View key={idx} style={styles.coursePill}>
                      <Text style={styles.coursePillText}>
                        {idx + 1}. {c.name}
                      </Text>
                      <Text style={styles.courseFeeText}>₹{c.course_fee}/mo</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.importBtn}
                  onPress={() => handleImport(tmpl)}
                  disabled={importing}
                  activeOpacity={0.8}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.importBtnText}>1-Click Import This Curriculum</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleWrap: {
    flex: 1,
  },
  arabicHeader: {
    fontFamily: 'Amiri',
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: '700',
    direction: 'rtl',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#064E3B',
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: 20,
    gap: 20,
  },
  templateCard: {
    backgroundColor: '#FAF8F4',
    borderWidth: 1.5,
    borderColor: '#E8E1D3',
    borderRadius: 20,
    padding: 18,
    ...SHADOWS.card,
  },
  badgeRow: {
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  tmplArabicTitle: {
    fontFamily: 'Amiri',
    fontSize: 20,
    color: '#005F46',
    fontWeight: '700',
    direction: 'rtl',
    marginBottom: 4,
  },
  tmplTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  tmplDesc: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 14,
  },
  coursesListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  coursesCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  coursePillsWrap: {
    gap: 6,
    marginBottom: 16,
  },
  coursePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  coursePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  courseFeeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  importBtn: {
    backgroundColor: '#005F46',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...SHADOWS.card,
  },
  importBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
