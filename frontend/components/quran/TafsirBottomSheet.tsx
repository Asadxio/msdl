import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import {
  AyatTafsirResult,
  TAFSIR_EDITIONS,
  fetchAyatTafsir,
  savePreferredTafsirEdition,
} from '@/lib/quranExtrasService';

interface TafsirBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  surahNumber: number;
  surahName: string;
  ayatNumber: number;
  arabicText: string;
  editionSlug: string;
  onChangeEdition: (slug: string) => void;
}

export function TafsirBottomSheet({
  visible,
  onClose,
  surahNumber,
  surahName,
  ayatNumber,
  arabicText,
  editionSlug,
  onChangeEdition,
}: TafsirBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tafsir, setTafsir] = useState<AyatTafsirResult | null>(null);

  useEffect(() => {
    if (!visible || !surahNumber || !ayatNumber) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAyatTafsir(surahNumber, ayatNumber, editionSlug)
      .then((res) => {
        if (!cancelled) {
          setTafsir(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || 'Could not load Tafsir.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visible, surahNumber, ayatNumber, editionSlug]);

  const isRtl = tafsir?.language === 'ur' || tafsir?.language === 'ar';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#0B231D' : colors.surface,
              borderColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                Tafsir • {surahName} ({surahNumber}:{ayatNumber})
              </Text>
              <Text style={[styles.subtitle, { color: colors.gold }]}>
                {tafsir ? `${tafsir.editionName} — ${tafsir.author}` : 'Select Commentary Edition'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#14382F' : '#F1F5F9' }]}
              accessibilityLabel="Close Tafsir"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Edition Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.editionRow}
          >
            {TAFSIR_EDITIONS.map((ed) => {
              const selected = ed.slug === editionSlug;
              return (
                <TouchableOpacity
                  key={ed.slug}
                  style={[
                    styles.editionChip,
                    {
                      backgroundColor: selected
                        ? colors.primary
                        : isDark
                        ? '#14382F'
                        : colors.surfaceAlt,
                      borderColor: selected ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => {
                    onChangeEdition(ed.slug);
                    void savePreferredTafsirEdition(ed.slug);
                  }}
                >
                  <Text
                    style={[
                      styles.editionLang,
                      { color: selected ? '#E5C378' : colors.gold },
                    ]}
                  >
                    {ed.languageLabel}
                  </Text>
                  <Text
                    style={[
                      styles.editionName,
                      { color: selected ? '#FFFFFF' : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {ed.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Body */}
          <ScrollView
            style={styles.bodyScroll}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {!!arabicText && (
              <View
                style={[
                  styles.arabicQuote,
                  {
                    backgroundColor: isDark ? '#12332A' : colors.goldBg,
                    borderColor: colors.goldBorder,
                  },
                ]}
              >
                <Text style={[styles.arabicQuoteText, { color: colors.text }]}>{arabicText}</Text>
              </View>
            )}

            {loading ? (
              <View style={styles.stateBox}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                  Loading Tafsir...
                </Text>
              </View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Ionicons name="cloud-offline-outline" size={38} color={colors.error} />
                <Text style={[styles.stateText, { color: colors.error }]}>{error}</Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                    fetchAyatTafsir(surahNumber, ayatNumber, editionSlug)
                      .then((res) => {
                        setTafsir(res);
                        setLoading(false);
                      })
                      .catch((e) => {
                        setError(e?.message || 'Retry failed');
                        setLoading(false);
                      });
                  }}
                >
                  <Text style={styles.retryText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text
                style={[
                  styles.tafsirBody,
                  {
                    color: colors.text,
                    textAlign: isRtl ? 'right' : 'left',
                    writingDirection: isRtl ? 'rtl' : 'ltr',
                    lineHeight: tafsir?.language === 'ur' ? 30 : 25,
                    fontSize: tafsir?.language === 'ur' ? 16 : 14.5,
                  },
                ]}
              >
                {tafsir?.text || 'No commentary available for this verse in the selected edition.'}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editionRow: { gap: 8, paddingBottom: 10 },
  editionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  editionLang: { fontSize: 11, fontWeight: '800' },
  editionName: { fontSize: 12, fontWeight: '700', maxWidth: 180 },
  bodyScroll: { marginTop: 4 },
  bodyContent: { gap: 12, paddingBottom: 20 },
  arabicQuote: {
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
  },
  arabicQuoteText: {
    fontSize: 20,
    lineHeight: 36,
    textAlign: 'right',
    writingDirection: 'rtl',
    fontWeight: '700',
  },
  stateBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 10 },
  stateText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  retryBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: RADIUS.md },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  tafsirBody: { fontWeight: '500' },
});
