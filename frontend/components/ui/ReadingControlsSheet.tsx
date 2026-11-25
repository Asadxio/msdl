import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/context/ThemeContext';
import { RADIUS, SPACING, SHADOWS } from '@/constants/theme';

interface ReadingControlsSheetProps {
  visible: boolean;
  onClose: () => void;
  showThemeOption?: boolean;
}

export function ReadingControlsSheet({
  visible,
  onClose,
  showThemeOption = true,
}: ReadingControlsSheetProps) {
  const { colors, isDark, themeMode, setThemeMode, readingPreferences, updateReadingPreferences } =
    useTheme();

  const handleAdjustArabicSize = (delta: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    const current = readingPreferences.arabicFontSize || 24;
    const next = Math.max(18, Math.min(38, current + delta));
    updateReadingPreferences({ arabicFontSize: next });
  };

  const handleAdjustTransSize = (delta: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    const current = readingPreferences.translationFontSize || 14;
    const next = Math.max(12, Math.min(22, current + delta));
    updateReadingPreferences({ translationFontSize: next });
  };

  const handleToggle = (key: keyof typeof readingPreferences) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    updateReadingPreferences({ [key]: !readingPreferences[key] });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close reading settings"
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheetContainer, { backgroundColor: colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerLeft}>
              <Ionicons name="text-outline" size={20} color={colors.gold} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Reading & Display Settings</Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Arabic Font Size Control */}
          <View style={styles.controlRow}>
            <View style={styles.controlLabelWrap}>
              <Text style={[styles.controlLabel, { color: colors.text }]}>Arabic Text Size</Text>
              <Text style={[styles.controlSubLabel, { color: colors.textSecondary }]}>
                {readingPreferences.arabicFontSize}sp • سُبْحَانَ اللَّهِ
              </Text>
            </View>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => handleAdjustArabicSize(-2)}
                accessibilityRole="button"
                accessibilityLabel="Decrease Arabic text size"
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => handleAdjustArabicSize(2)}
                accessibilityRole="button"
                accessibilityLabel="Increase Arabic text size"
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Translation Font Size Control */}
          <View style={styles.controlRow}>
            <View style={styles.controlLabelWrap}>
              <Text style={[styles.controlLabel, { color: colors.text }]}>Translation Text Size</Text>
              <Text style={[styles.controlSubLabel, { color: colors.textSecondary }]}>
                {readingPreferences.translationFontSize}sp • Urdu & English
              </Text>
            </View>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => handleAdjustTransSize(-1)}
                accessibilityRole="button"
                accessibilityLabel="Decrease translation text size"
              >
                <Ionicons name="remove" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                onPress={() => handleAdjustTransSize(1)}
                accessibilityRole="button"
                accessibilityLabel="Increase translation text size"
              >
                <Ionicons name="add" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Toggles */}
          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>English Translation</Text>
            <Switch
              value={readingPreferences.showEnglishTranslation}
              onValueChange={() => handleToggle('showEnglishTranslation')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Urdu Translation (اردو ترجمہ)</Text>
            <Switch
              value={readingPreferences.showUrduTranslation}
              onValueChange={() => handleToggle('showUrduTranslation')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: colors.text }]}>Latin Transliteration</Text>
            <Switch
              value={readingPreferences.showTransliteration}
              onValueChange={() => handleToggle('showTransliteration')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {/* Theme Mode Toggle (Light / Dark) */}
          {showThemeOption && (
            <>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.themeSelectorRow}>
                <Text style={[styles.controlLabel, { color: colors.text, marginBottom: SPACING.sm }]}>
                  Theme Appearance
                </Text>
                <View style={styles.themePillsWrap}>
                  {(['System Default', 'Light Mode', 'Dark Mode'] as const).map((mode) => {
                    const isSelected = themeMode === mode;
                    return (
                      <TouchableOpacity
                        key={mode}
                        style={[
                          styles.themePill,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                            borderColor: isSelected ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setThemeMode(mode)}
                        accessibilityRole="button"
                        accessibilityLabel={`${mode} theme`}
                      >
                        <Ionicons
                          name={
                            mode === 'Dark Mode'
                              ? 'moon'
                              : mode === 'Light Mode'
                              ? 'sunny'
                              : 'phone-portrait-outline'
                          }
                          size={14}
                          color={isSelected ? colors.white : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.themePillText,
                            { color: isSelected ? colors.white : colors.textSecondary },
                          ]}
                        >
                          {mode.replace(' Mode', '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
    ...SHADOWS.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  controlLabelWrap: {
    flex: 1,
    marginRight: SPACING.md,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  controlSubLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  stepperWrap: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  themeSelectorRow: {
    paddingTop: SPACING.xs,
  },
  themePillsWrap: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  themePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: 6,
  },
  themePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
