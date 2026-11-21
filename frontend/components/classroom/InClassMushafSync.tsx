import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { QURAN_SURAHS, type SurahMeta } from '@/constants/quranSurahs';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';

export interface SyncedQuranPage {
  surah: number;
  ayah: number;
  englishName: string;
  arabicName: string;
}

interface InClassMushafSyncProps {
  isTeacher: boolean;
  currentAyahOrPage?: string | number;
  onSyncPage?: (page: SyncedQuranPage) => Promise<void> | void;
}

export function parseQuranPageSync(raw?: string | number): SyncedQuranPage | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.surah === 'number') {
        return {
          surah: parsed.surah,
          ayah: Number(parsed.ayah) || 1,
          englishName: parsed.englishName || parsed.name || `Surah ${parsed.surah}`,
          arabicName: parsed.arabicName || parsed.arabic || '',
        };
      }
    } catch {
      // String format: e.g. "Surah 1: Al-Fatihah, Ayah 1"
      const match = raw.match(/Surah\s*(\d+)[:\s-]*([^,]+)?,?\s*(?:Ayah\s*(\d+))?/i);
      if (match) {
        const surahNum = parseInt(match[1], 10);
        const meta = QURAN_SURAHS.find((s) => s.number === surahNum);
        return {
          surah: surahNum,
          ayah: match[3] ? parseInt(match[3], 10) : 1,
          englishName: meta?.englishName || match[2]?.trim() || `Surah ${surahNum}`,
          arabicName: meta?.arabicName || '',
        };
      }
    }
  }

  if (typeof raw === 'number') {
    return {
      surah: 1,
      ayah: raw,
      englishName: 'Al-Fatihah',
      arabicName: 'الفاتحة',
    };
  }

  return null;
}

export function InClassMushafSync({
  isTeacher,
  currentAyahOrPage,
  onSyncPage,
}: InClassMushafSyncProps) {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta>(QURAN_SURAHS[0]);
  const [selectedAyah, setSelectedAyah] = useState<number>(1);
  const [syncing, setSyncing] = useState(false);

  const syncedData = useMemo(() => {
    return parseQuranPageSync(currentAyahOrPage);
  }, [currentAyahOrPage]);

  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return QURAN_SURAHS;
    const q = searchQuery.toLowerCase().trim();
    return QURAN_SURAHS.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.arabicName.includes(q) ||
        s.urduName.includes(q) ||
        String(s.number).includes(q)
    );
  }, [searchQuery]);

  const handleOpenReader = (surah: number, ayah: number) => {
    try {
      router.push((`/quran-reader?surah=${surah}&ayat=${ayah}`) as any);
    } catch (e) {
      console.warn('Navigation error to quran-reader:', e);
    }
  };

  const handleBroadcast = async () => {
    if (!onSyncPage) return;
    try {
      setSyncing(true);
      await onSyncPage({
        surah: selectedSurah.number,
        ayah: selectedAyah,
        englishName: selectedSurah.englishName,
        arabicName: selectedSurah.arabicName,
      });
      setModalVisible(false);
    } catch (err) {
      console.warn('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Active Synced Quran Banner */}
      {syncedData ? (
        <View style={styles.syncBanner}>
          <View style={styles.syncIconWrap}>
            <Ionicons name="book" size={18} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.syncHeaderRow}>
              <Text style={styles.syncBadge}>LIVE MUSHAF SYNC</Text>
              <Text style={styles.arabicNameText}>{syncedData.arabicName}</Text>
            </View>
            <Text style={styles.surahInfoText}>
              Surah {syncedData.surah}: {syncedData.englishName} • Ayah {syncedData.ayah}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.openMushafBtn}
            onPress={() => handleOpenReader(syncedData.surah, syncedData.ayah)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open in Quran Reader"
          >
            <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.openMushafBtnText}>Open Mushaf</Text>
          </TouchableOpacity>

          {isTeacher && (
            <TouchableOpacity
              style={styles.teacherEditSyncBtn}
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Change Synced Quran Page"
            >
              <Ionicons name="swap-horizontal" size={16} color="#059669" />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        isTeacher && (
          <TouchableOpacity
            style={styles.teacherInitSyncBtn}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sync Quran Page with Students"
          >
            <Ionicons name="book-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
            <Text style={styles.teacherInitSyncText}>
              📖 Sync Quran Page with Class (طلبہ کے لیے قرآن سنک کریں)
            </Text>
          </TouchableOpacity>
        )
      )}

      {/* Teacher Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Sync Quran Page to Class</Text>
                <Text style={styles.modalSubtitle}>
                  Choose Surah & Ayah to instantly synchronize all students&apos; screens.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close sync modal"
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Quick Surah Shortcuts */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shortcutsRow}
            >
              {[1, 2, 36, 67, 78, 112, 114].map((num) => {
                const s = QURAN_SURAHS.find((item) => item.number === num);
                if (!s) return null;
                const isSelected = selectedSurah.number === s.number;
                return (
                  <TouchableOpacity
                    key={s.number}
                    style={[styles.shortcutChip, isSelected && styles.shortcutChipActive]}
                    onPress={() => {
                      setSelectedSurah(s);
                      setSelectedAyah(1);
                    }}
                  >
                    <Text style={[styles.shortcutText, isSelected && styles.shortcutTextActive]}>
                      {s.number}. {s.englishName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Search Bar */}
            <View style={styles.searchBarWrap}>
              <Ionicons name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search 114 Surahs by name or number..."
                placeholderTextColor="#94A3B8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            {/* Surah List */}
            <FlatList
              data={filteredSurahs}
              keyExtractor={(item) => String(item.number)}
              style={styles.surahList}
              renderItem={({ item }) => {
                const isSelected = selectedSurah.number === item.number;
                return (
                  <TouchableOpacity
                    style={[styles.surahItem, isSelected && styles.surahItemActive]}
                    onPress={() => {
                      setSelectedSurah(item);
                      setSelectedAyah(1);
                    }}
                  >
                    <View style={[styles.surahNumBadge, isSelected && styles.surahNumBadgeActive]}>
                      <Text style={[styles.surahNumText, isSelected && styles.surahNumTextActive]}>
                        {item.number}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.surahItemName, isSelected && styles.surahItemNameActive]}>
                        {item.englishName}
                      </Text>
                      <Text style={styles.surahItemSub}>
                        {item.totalAyat} Ayahs • {item.type} • Parah {item.parah}
                      </Text>
                    </View>
                    <Text style={[styles.surahItemArabic, isSelected && styles.surahItemArabicActive]}>
                      {item.arabicName}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Selected Surah Ayah Selector */}
            <View style={styles.selectedSurahBar}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedLabel}>Selected for Broadcast:</Text>
                <Text style={styles.selectedValueText}>
                  Surah {selectedSurah.number}: {selectedSurah.englishName} ({selectedSurah.arabicName})
                </Text>
              </View>

              {/* Ayah Stepper */}
              <View style={styles.ayahStepper}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setSelectedAyah((prev) => Math.max(1, prev - 1))}
                >
                  <Ionicons name="remove" size={16} color="#059669" />
                </TouchableOpacity>
                <Text style={styles.ayahStepValue}>Ayah {selectedAyah}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setSelectedAyah((prev) => Math.min(selectedSurah.totalAyat, prev + 1))}
                >
                  <Ionicons name="add" size={16} color="#059669" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Broadcast Action Button */}
            <TouchableOpacity
              style={[styles.broadcastBtn, syncing && { opacity: 0.7 }]}
              onPress={handleBroadcast}
              disabled={syncing}
            >
              <Ionicons name="radio" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.broadcastBtnText}>
                {syncing ? 'Broadcasting...' : `Sync Surah ${selectedSurah.number}, Ayah ${selectedAyah} to Class`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    gap: 8,
    ...SHADOWS.card,
  },
  syncIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    letterSpacing: 0.4,
  },
  arabicNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  surahInfoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#064E3B',
    marginTop: 1,
  },
  openMushafBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
  },
  openMushafBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  teacherEditSyncBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherInitSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderStyle: 'dashed',
  },
  teacherInitSyncText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalSubtitle: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 6,
  },
  shortcutChip: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  shortcutTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    padding: 0,
  },
  surahList: {
    maxHeight: 220,
    marginBottom: 8,
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    gap: 10,
  },
  surahItemActive: {
    backgroundColor: '#ECFDF5',
  },
  surahNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surahNumBadgeActive: {
    backgroundColor: '#059669',
  },
  surahNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  surahNumTextActive: {
    color: '#FFFFFF',
  },
  surahItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  surahItemNameActive: {
    color: '#065F46',
  },
  surahItemSub: {
    fontSize: 10.5,
    color: '#64748B',
  },
  surahItemArabic: {
    fontSize: 15,
    fontWeight: '700',
    color: '#064E3B',
  },
  surahItemArabicActive: {
    color: '#059669',
  },
  selectedSurahBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  selectedValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 1,
  },
  ayahStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 4,
  },
  stepBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ayahStepValue: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1F2937',
    paddingHorizontal: 6,
  },
  broadcastBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    ...SHADOWS.card,
  },
  broadcastBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
