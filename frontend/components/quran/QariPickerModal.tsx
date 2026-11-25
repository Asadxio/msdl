import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import {
  CURATED_QARIS,
  QuranReciter,
  fetchAllQaris,
  savePreferredQariId,
} from '@/lib/quranExtrasService';

interface QariPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedQariId: string;
  onSelectQari: (qari: QuranReciter) => void;
}

export function QariPickerModal({
  visible,
  onClose,
  selectedQariId,
  onSelectQari,
}: QariPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [qaris, setQaris] = useState<QuranReciter[]>(CURATED_QARIS);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchAllQaris()
      .then((list) => setQaris(list))
      .finally(() => setLoading(false));
  }, [visible]);

  const filtered = qaris.filter((q) => {
    const s = query.trim().toLowerCase();
    if (!s) return true;
    return (
      q.nameEn.toLowerCase().includes(s) ||
      q.nameAr.toLowerCase().includes(s) ||
      q.style.toLowerCase().includes(s)
    );
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#0B231D' : colors.surface,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>Select Qari (قاری منتخب کریں)</Text>
              <Text style={[styles.subtitle, { color: colors.gold }]}>
                Choose synced reciter or Urdu translation audio
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: isDark ? '#14382F' : '#F1F5F9' }]}
              accessibilityLabel="Close Qari picker"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBox,
              { backgroundColor: isDark ? '#14382F' : colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={16} color={colors.gold} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search Qari (e.g. Alafasy, Sudais, Husary)..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
            />
            {loading && <ActivityIndicator size="small" color={colors.gold} />}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const selected = item.id === selectedQariId;
              return (
                <TouchableOpacity
                  style={[
                    styles.itemCard,
                    {
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(16,185,129,0.18)'
                          : '#ECFDF5'
                        : isDark
                        ? '#102F26'
                        : colors.background,
                      borderColor: selected ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => {
                    void savePreferredQariId(item.id);
                    onSelectQari(item);
                    onClose();
                  }}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      { backgroundColor: selected ? colors.primary : isDark ? '#14382F' : '#E8F5EE' },
                    ]}
                  >
                    <Ionicons
                      name={item.isUrduTranslationMode ? 'language' : 'mic'}
                      size={18}
                      color={selected ? '#FFFFFF' : colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{item.nameEn}</Text>
                    <Text style={[styles.itemAr, { color: colors.gold }]}>{item.nameAr}</Text>
                    <Text style={[styles.itemStyle, { color: colors.textSecondary }]}>
                      {item.style}
                    </Text>
                  </View>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.gold} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
  },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    minHeight: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  listContent: { gap: 8, paddingBottom: 18 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemAr: { fontSize: 12, fontWeight: '700', marginTop: 1 },
  itemStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
