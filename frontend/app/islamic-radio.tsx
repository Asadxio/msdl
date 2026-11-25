import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useGlobalAudio } from '@/context/GlobalAudioContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  CURATED_RADIOS,
  IslamicRadioStation,
  fetchIslamicRadios,
} from '@/lib/quranExtrasService';

const CATEGORIES = ['All', 'Haramain & Tafsir', 'Translation & Urdu', 'Reciters'] as const;

export default function IslamicRadioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentTrack, isPlaying, isBuffering, playTrack, pauseTrack, resumeTrack, stopTrack } =
    useGlobalAudio();

  const [stations, setStations] = useState<IslamicRadioStation[]>(CURATED_RADIOS);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<(typeof CATEGORIES)[number]>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchIslamicRadios()
      .then((list) => setStations(list))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stations.filter((s) => {
      if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.subtitle.toLowerCase().includes(q);
    });
  }, [stations, selectedCategory, search]);

  const handleToggleStation = async (station: IslamicRadioStation) => {
    void Haptics.selectionAsync();
    const isSame = currentTrack?.id === station.id;
    if (isSame) {
      if (isPlaying) {
        await pauseTrack();
      } else {
        await resumeTrack();
      }
      return;
    }

    await playTrack({
      id: station.id,
      titleEn: station.name,
      subtitle: `${station.subtitle} • Live Radio`,
      artistOrSource: 'MP3Quran Live Radio',
      category: 'quran',
      audioUrl: station.url,
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Emerald Header */}
      <View style={[styles.header, { backgroundColor: colors.primaryDeep }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerAr}>إذاعة القرآن الكريم</Text>
          <Text style={styles.headerTitle}>Live Islamic Radio</Text>
        </View>
        {currentTrack?.id?.includes('radio') ? (
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => void stopTrack()}
            accessibilityLabel="Stop live radio"
          >
            <Ionicons name="stop" size={18} color="#FDE047" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="radio" size={18} color={colors.gold} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search Makkah, Urdu, Tafsir or Qari radio..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {loading && <ActivityIndicator size="small" color={colors.gold} />}
        </View>

        <FlatList
          data={CATEGORIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => {
            const active = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surface,
                    borderColor: active ? colors.gold : colors.border,
                  },
                ]}
                onPress={() => setSelectedCategory(item)}
              >
                <Text style={[styles.chipText, { color: active ? '#FFFFFF' : colors.text }]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Stations List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 90 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isCurrent = currentTrack?.id === item.id;
          const isStationPlaying = isCurrent && isPlaying;
          const isStationBuffering = isCurrent && isBuffering;
          return (
            <TouchableOpacity
              style={[
                styles.stationCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isCurrent ? colors.gold : colors.border,
                },
                isCurrent && { borderWidth: 1.5 },
              ]}
              onPress={() => void handleToggleStation(item)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.stationIcon,
                  {
                    backgroundColor: isCurrent
                      ? colors.primary
                      : isDark
                      ? colors.surfaceAlt
                      : '#ECFDF5',
                  },
                ]}
              >
                {isStationBuffering ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name={isStationPlaying ? 'pause' : 'radio-outline'}
                    size={22}
                    color={isCurrent ? '#FFFFFF' : colors.primary}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stationName, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.stationSub, { color: colors.textSecondary }]} numberOfLines={1}>
                  {item.subtitle}
                </Text>
                <View style={styles.metaRow}>
                  <View style={[styles.catBadge, { backgroundColor: colors.goldBg }]}>
                    <Text style={[styles.catBadgeText, { color: colors.goldText }]}>
                      {item.category}
                    </Text>
                  </View>
                  {isStationPlaying && (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>● LIVE</Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons
                name={isStationPlaying ? 'pause-circle' : 'play-circle'}
                size={34}
                color={isCurrent ? colors.gold : colors.primary}
              />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerAr: { fontSize: 12, fontWeight: '700', color: '#E5C378' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: 12, gap: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', paddingVertical: 8 },
  chipsRow: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  listContent: { padding: SPACING.md, gap: 10 },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    ...SHADOWS.card,
  },
  stationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stationName: { fontSize: 14.5, fontWeight: '800' },
  stationSub: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  catBadgeText: { fontSize: 10.5, fontWeight: '700' },
  liveBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
});
