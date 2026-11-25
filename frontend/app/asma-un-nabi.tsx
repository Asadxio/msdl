import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import type { ProphetName } from '@/constants/asmaUnNabiData';
import {
  getAllProphetNames,
  getDailyProphetName,
  getProphetFavoriteIds,
  getSeerahTimeline,
  searchProphetNames,
  toggleProphetFavoriteId,
} from '@/lib/asmaUnNabiService';

type MainTab = 'names' | 'seerah';
type NameFilter = 'all' | 'favorites';
type SeerahFilter = 'All' | 'Makki' | 'Madani';

export default function AsmaUnNabiScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const isTablet = width >= 600;
  const numColumns = isTablet ? (width >= 900 ? 4 : 3) : 2;
  const gridGap = SPACING.sm;
  const horizontalPad = SPACING.md * 2;
  const cardWidth = Math.floor((width - horizontalPad - gridGap * (numColumns - 1)) / numColumns);

  const [mainTab, setMainTab] = useState<MainTab>('names');
  const [nameFilter, setNameFilter] = useState<NameFilter>('all');
  const [seerahFilter, setSeerahFilter] = useState<SeerahFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [selectedName, setSelectedName] = useState<ProphetName | null>(null);

  const allNames = useMemo(() => getAllProphetNames(), []);
  const dailyName = useMemo(() => getDailyProphetName(), []);
  const seerahEvents = useMemo(() => getSeerahTimeline(seerahFilter), [seerahFilter]);

  useEffect(() => {
    getProphetFavoriteIds().then(setFavoriteIds);
  }, []);

  const filteredNames = useMemo(() => {
    let list = searchQuery.trim() ? searchProphetNames(searchQuery) : allNames;
    if (nameFilter === 'favorites') {
      list = list.filter((n) => favoriteIds.includes(n.id));
    }
    return list;
  }, [allNames, searchQuery, nameFilter, favoriteIds]);

  const handleToggleFav = async (id: number) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const updated = await toggleProphetFavoriteId(id);
    setFavoriteIds(updated);
  };

  const handleShareName = async (item: ProphetName) => {
    try {
      await Share.share({
        message: `ﷺ ${item.arabic} (${item.transliteration})\nEnglish: ${item.englishMeaning}\nاردو: ${item.urduMeaning}\n\n${item.significance}\n\nاللّٰهُمَّ صَلِّ عَلٰى مُحَمَّدٍ وَعَلٰى آلِ مُحَمَّد\n— SUFFAH Islamic Education`,
      });
    } catch {}
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
          <Text style={styles.headerAr}>أَسْمَاءُ النَّبِيِّ ﷺ وَالسِّيرَة</Text>
          <Text style={styles.headerTitle}>Asma-un-Nabi & Seerah</Text>
        </View>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push('/tasbeeh' as any)}
          accessibilityLabel="Open Durood Tasbeeh"
        >
          <Ionicons name="sparkles-outline" size={20} color="#E5C378" />
        </TouchableOpacity>
      </View>

      {/* Main Switch Tabs */}
      <View style={[styles.topSwitchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.topSwitchBtn, mainTab === 'names' && { backgroundColor: colors.primary }]}
          onPress={() => setMainTab('names')}
          accessibilityRole="tab"
        >
          <Ionicons name="star-outline" size={15} color={mainTab === 'names' ? '#FFFFFF' : colors.text} />
          <Text style={[styles.topSwitchTxt, { color: mainTab === 'names' ? '#FFFFFF' : colors.text }]}>
            99 Names (ﷺ)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.topSwitchBtn, mainTab === 'seerah' && { backgroundColor: colors.primary }]}
          onPress={() => setMainTab('seerah')}
          accessibilityRole="tab"
        >
          <Ionicons name="time-outline" size={15} color={mainTab === 'seerah' ? '#FFFFFF' : colors.text} />
          <Text style={[styles.topSwitchTxt, { color: mainTab === 'seerah' ? '#FFFFFF' : colors.text }]}>
            Seerah Timeline
          </Text>
        </TouchableOpacity>
      </View>

      {mainTab === 'names' ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Search & Favorites Row */}
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.gold} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search blessed names (#, Arabic, Urdu, English)..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filterPillsRow}>
            {(['all', 'favorites'] as const).map((f) => {
              const active = nameFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setNameFilter(f)}
                >
                  <Text style={[styles.filterPillText, { color: active ? '#FFFFFF' : colors.text }]}>
                    {f === 'all' ? 'All 99 Names' : `Favorites (${favoriteIds.length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Daily Salawat & Name Spotlight */}
          {!searchQuery.trim() && nameFilter === 'all' && (
            <TouchableOpacity
              style={[styles.dailyHero, { backgroundColor: isDark ? '#064E3B' : '#045E44' }]}
              onPress={() => setSelectedName(dailyName)}
              activeOpacity={0.85}
            >
              <View style={styles.dailyTopRow}>
                <View style={styles.dailyBadge}>
                  <Ionicons name="heart" size={12} color="#E5C378" />
                  <Text style={styles.dailyBadgeText}>Daily Blessed Name • صلوا عليه</Text>
                </View>
                <TouchableOpacity onPress={() => void handleShareName(dailyName)}>
                  <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.dailyAr}>{dailyName.arabic}</Text>
              <Text style={styles.dailyTrans}>
                #{dailyName.id} {dailyName.transliteration} — {dailyName.englishMeaning}
              </Text>
              <Text style={styles.dailyUr}>{dailyName.urduMeaning}</Text>
            </TouchableOpacity>
          )}

          {/* Grid */}
          <View style={styles.gridWrap}>
            {filteredNames.map((item) => {
              const isFav = favoriteIds.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.nameCard,
                    {
                      width: cardWidth,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => setSelectedName(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardTop}>
                    <View style={[styles.idBadge, { backgroundColor: colors.goldBg }]}>
                      <Text style={[styles.idBadgeText, { color: colors.goldText }]}>{item.id}</Text>
                    </View>
                    <TouchableOpacity onPress={() => void handleToggleFav(item.id)}>
                      <Ionicons
                        name={isFav ? 'star' : 'star-outline'}
                        size={18}
                        color={isFav ? colors.gold : colors.textMuted}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.cardAr, { color: colors.text }]}>{item.arabic}</Text>
                  <Text style={[styles.cardTrans, { color: colors.primary }]} numberOfLines={1}>
                    {item.transliteration}
                  </Text>
                  <Text style={[styles.cardUr, { color: colors.goldText }]} numberOfLines={1}>
                    {item.urduMeaning}
                  </Text>
                  <Text style={[styles.cardEn, { color: colors.textSecondary }]} numberOfLines={2}>
                    {item.englishMeaning}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Era Filter */}
          <View style={styles.filterPillsRow}>
            {(['All', 'Makki', 'Madani'] as const).map((era) => {
              const active = seerahFilter === era;
              return (
                <TouchableOpacity
                  key={era}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.gold : colors.border,
                    },
                  ]}
                  onPress={() => setSeerahFilter(era)}
                >
                  <Text style={[styles.filterPillText, { color: active ? '#FFFFFF' : colors.text }]}>
                    {era === 'All' ? 'Complete Seerah' : `${era} Era`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {seerahEvents.map((ev) => (
            <View
              key={ev.id}
              style={[
                styles.timelineCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.timelineTopRow}>
                <View
                  style={[
                    styles.eraBadge,
                    {
                      backgroundColor:
                        ev.era === 'Makki' ? colors.goldBg : isDark ? '#0D3829' : '#ECFDF5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.eraBadgeText,
                      { color: ev.era === 'Makki' ? colors.goldText : colors.primary },
                    ]}
                  >
                    {ev.era} Era • {ev.yearLabel}
                  </Text>
                </View>
                <Text style={[styles.stepNum, { color: colors.textMuted }]}>#{ev.order}</Text>
              </View>

              <Text style={[styles.timelineAr, { color: colors.gold }]}>{ev.titleAr}</Text>
              <Text style={[styles.timelineEn, { color: colors.text }]}>{ev.titleEn}</Text>
              <Text style={[styles.timelineUr, { color: colors.primary }]}>{ev.titleUr}</Text>
              <Text style={[styles.timelineSummary, { color: colors.textSecondary }]}>
                {ev.summary}
              </Text>

              <View
                style={[
                  styles.lessonBox,
                  { backgroundColor: isDark ? colors.surfaceAlt : colors.background },
                ]}
              >
                <Text style={[styles.lessonLabel, { color: colors.goldText }]}>Reflection & Lesson</Text>
                <Text style={[styles.lessonBody, { color: colors.text }]}>{ev.lesson}</Text>
                <Text style={[styles.refText, { color: colors.textMuted }]}>Ref: {ev.reference}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Detail Modal for Name */}
      <Modal
        visible={!!selectedName}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedName(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedName(null)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
            onPress={() => {}}
          >
            {selectedName && (
              <>
                <Text style={[styles.modalNum, { color: colors.gold }]}>
                  Name #{selectedName.id} of 99
                </Text>
                <Text style={[styles.modalAr, { color: colors.text }]}>{selectedName.arabic}</Text>
                <Text style={[styles.modalTrans, { color: colors.primary }]}>
                  {selectedName.transliteration}
                </Text>
                <Text style={[styles.modalUr, { color: colors.goldText }]}>
                  {selectedName.urduMeaning}
                </Text>
                <Text style={[styles.modalEn, { color: colors.text }]}>
                  {selectedName.englishMeaning}
                </Text>
                <Text style={[styles.modalSig, { color: colors.textSecondary }]}>
                  {selectedName.significance}
                </Text>
                <Text style={[styles.salawatNote, { color: colors.primary }]}>
                  صَلَّى اللّٰهُ عَلَيْهِ وَسَلَّمَ — Recite Durood Shareef upon reading
                </Text>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={() => void handleShareName(selectedName)}
                >
                  <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.modalBtnTxt}>Share with Durood</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  topSwitchWrap: {
    flexDirection: 'row',
    margin: SPACING.md,
    marginBottom: 8,
    padding: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  topSwitchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  topSwitchTxt: { fontSize: 13, fontWeight: '800' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 12 },
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
  filterPillsRow: { flexDirection: 'row', gap: 8 },
  filterPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignItems: 'center',
  },
  filterPillText: { fontSize: 12, fontWeight: '800' },
  dailyHero: { borderRadius: 22, padding: 16, gap: 6 },
  dailyTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dailyBadge: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dailyBadgeText: { color: '#FDE047', fontSize: 11, fontWeight: '800' },
  dailyAr: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  dailyTrans: { color: '#D1FAE5', fontSize: 15, fontWeight: '800' },
  dailyUr: { color: '#FDE047', fontSize: 14, fontWeight: '700', textAlign: 'right' },
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  nameCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 4,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  idBadgeText: { fontSize: 11, fontWeight: '800' },
  cardAr: { fontSize: 20, fontWeight: '800', textAlign: 'right', marginTop: 4 },
  cardTrans: { fontSize: 13.5, fontWeight: '800' },
  cardUr: { fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  cardEn: { fontSize: 11.5, lineHeight: 16 },
  timelineCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    ...SHADOWS.card,
  },
  timelineTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eraBadge: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  eraBadgeText: { fontSize: 11, fontWeight: '800' },
  stepNum: { fontSize: 12, fontWeight: '800' },
  timelineAr: { fontSize: 16, fontWeight: '800', textAlign: 'right', marginTop: 2 },
  timelineEn: { fontSize: 16, fontWeight: '900' },
  timelineUr: { fontSize: 13.5, fontWeight: '700', textAlign: 'right' },
  timelineSummary: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  lessonBox: { borderRadius: 12, padding: 10, marginTop: 6, gap: 3 },
  lessonLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  lessonBody: { fontSize: 12.5, lineHeight: 18, fontWeight: '500' },
  refText: { fontSize: 10.5, fontStyle: 'italic', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, gap: 8 },
  modalNum: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  modalAr: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  modalTrans: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  modalUr: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  modalEn: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  modalSig: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  salawatNote: { fontSize: 12.5, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: RADIUS.md,
    marginTop: 10,
  },
  modalBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
