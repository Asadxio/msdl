import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useLanguage, LANGUAGE_OPTIONS, Language } from '@/context/LanguageContext';

interface LanguageSwitcherSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const LanguageSwitcherSheet: React.FC<LanguageSwitcherSheetProps> = ({
  visible,
  onClose,
}) => {
  const { language, setLanguage, t } = useLanguage();

  const handleSelect = async (code: Language) => {
    await setLanguage(code);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="globe-outline" size={20} color="#005F46" />
              </View>
              <View>
                <Text style={styles.title}>ایپ کی زبان منتخب فرمائیں</Text>
                <Text style={styles.subTitle}>Select App Language</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Language Options List */}
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {LANGUAGE_OPTIONS.map((opt) => {
              const isSelected = language === opt.code;
              return (
                <TouchableOpacity
                  key={opt.code}
                  style={[styles.langCard, isSelected && styles.langCardSelected]}
                  onPress={() => handleSelect(opt.code)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.flag}>{opt.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.nativeName, isSelected && styles.nativeNameSelected]}>
                        {opt.nativeName}
                      </Text>
                      <Text style={styles.englishName}>({opt.name})</Text>
                    </View>
                    <Text style={styles.subtitle}>{opt.subtitle}</Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Footer Close Button */}
          <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.dismissBtnText}>{t('common.close', 'بند کریں')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.lg,
    maxHeight: '80%',
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8F5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  subTitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  list: {
    gap: 10,
    paddingVertical: 6,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 12,
  },
  langCardSelected: {
    borderColor: '#005F46',
    backgroundColor: '#E8F5EE',
  },
  flag: {
    fontSize: 26,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nativeName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  nativeNameSelected: {
    color: '#005F46',
  },
  englishName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#005F46',
    backgroundColor: '#005F46',
  },
  dismissBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
});
