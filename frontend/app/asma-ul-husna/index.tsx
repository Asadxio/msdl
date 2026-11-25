import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Share,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getAllNames,
  getDailyName,
  searchNames,
  getFavoriteNameIds,
  toggleFavoriteName,
} from '@/lib/asmaUlHusnaService';
import { AllahName } from '@/types/islamic';

export default function AsmaUlHusnaIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const isTablet = width >= 600;
  const numColumns = isTablet ? (width >= 900 ? 4 : 3) : 2;
  const gridGap = SPACING.md;
  const horizontalPadding = SPACING.lg * 2;
  const cardWidth = (width - horizontalPadding - gridGap * (numColumns - 1)) / numColumns;

  const [names, setNames] = useState<AllahName[]>([]);
  const [dailyName, setDailyName] = useState<AllahName | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const all = getAllNames();
      setNames(all);
      const daily = getDailyName();
      setDailyName(daily);
      const favs = await getFavoriteNameIds();
      setFavoriteIds(favs);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (id: number) => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
      await toggleFavoriteName(id);
      const updated = await getFavoriteNameIds();
      setFavoriteIds(updated);
    } catch {}
  };

  const filteredNames = useMemo(() => {
    let result = names;
    if (searchQuery.trim()) {
      result = searchNames(searchQuery);
    }
    if (filterMode === 'favorites') {
      result = result.filter((n) => favoriteIds.includes(n.id));
    }
    return result;
  }, [names, searchQuery, filterMode, favoriteIds]);

  const handleShareDaily = async () => {
    if (!dailyName) return;
    try {
      const text = `✨ *Daily Name of Allah: ${dailyName.arabic}*\n*${dailyName.transliteration}* (${dailyName.englishMeaning})\n*اردو معنی:* ${dailyName.urduMeaning}\n\n"${dailyName.explanationEn}"\n\nShared via SUFFAH Islamic Knowledge`;
      await Share.share({ message: text });
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.emerald} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleEn}>Asma-ul-Husna</Text>
          <Text style={styles.headerTitleUr}>اَلاسْمَاءُ الْحُسْنَى • 99 اسماء مبارکہ</Text>
        </View>
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/tasbeeh' as any)}
          accessibilityRole="button"
          accessibilityLabel="Open Tasbeeh"
        >
          <Ionicons name="finger-print-outline" size={24} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, meaning, or number (1-99)..."
            placeholderTextColor={COLORS.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Search Asma-ul-Husna"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, filterMode === 'all' && styles.tabActive]}
          onPress={() => setFilterMode('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filterMode === 'all' }}
        >
          <Text style={[styles.tabText, filterMode === 'all' && styles.tabTextActive]}>
            تمام نام (All 99)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, filterMode === 'favorites' && styles.tabActive]}
          onPress={() => setFilterMode('favorites')}
          accessibilityRole="tab"
          accessibilityState={{ selected: filterMode === 'favorites' }}
        >
          <Ionicons
            name="star"
            size={16}
            color={filterMode === 'favorites' ? COLORS.white : COLORS.gold}
            style={styles.favIcon}
          />
          <Text style={[styles.tabText, filterMode === 'favorites' && styles.tabTextActive]}>
            پسندیدہ (Favorites {favoriteIds.length > 0 ? `• ${favoriteIds.length}` : ''})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.emerald} />
          <Text style={styles.loadingText}>Loading Asma-ul-Husna...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Daily Name of Allah Feature (shown when not searching) */}
          {!searchQuery.trim() && filterMode === 'all' && dailyName && (
            <TouchableOpacity
              style={styles.dailyCard}
              onPress={() => router.push(`/asma-ul-husna/${dailyName.id}` as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Today's Name of Allah: ${dailyName.transliteration}`}
            >
              <View style={styles.dailyHeader}>
                <View style={styles.dailyBadge}>
                  <Ionicons name="sunny-outline" size={14} color={COLORS.gold} />
                  <Text style={styles.dailyBadgeText}>آج کا اسم مبارک • Daily Reflection</Text>
                </View>
                <TouchableOpacity
                  style={styles.dailyShareBtn}
                  onPress={handleShareDaily}
                  accessibilityRole="button"
                  accessibilityLabel="Share Daily Name"
                >
                  <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
                </TouchableOpacity>
              </View>

              <View style={styles.dailyBody}>
                <Text style={styles.dailyArabic}>{dailyName.arabic}</Text>
                <Text style={styles.dailyTransliteration}>
                  #{dailyName.id} {dailyName.transliteration}
                </Text>
                <Text style={styles.dailyUrduMeaning}>{dailyName.urduMeaning}</Text>
                <Text style={styles.dailyEngMeaning}>{dailyName.englishMeaning}</Text>
                <Text style={styles.dailyExplanation} numberOfLines={2}>
                  {dailyName.explanationEn}
                </Text>
              </View>

              <View style={styles.dailyFooter}>
                <Text style={styles.dailyLearnMore}>تفصیل دیکھیں • Tap to read reflection</Text>
                <Ionicons name="arrow-forward" size={16} color={COLORS.gold} />
              </View>
            </TouchableOpacity>
          )}

          {/* Grid Count & Title */}
          <View style={styles.gridHeader}>
            <Text style={styles.gridTitle}>
              {filterMode === 'favorites' ? 'پسندیدہ اسماء' : 'اسماء الحسنیٰ کی فہرست'}
            </Text>
            <Text style={styles.gridCount}>
              {filteredNames.length} {filteredNames.length === 1 ? 'Name' : 'Names'}
            </Text>
          </View>

          {/* 99 Names Responsive Grid */}
          {filteredNames.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>کوئی اسم مبارک نہیں ملا</Text>
              <Text style={styles.emptySubtitle}>No names found matching your filter criteria.</Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {filteredNames.map((item) => {
                const isFav = favoriteIds.includes(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.nameCard, { width: cardWidth }]}
                    onPress={() => router.push(`/asma-ul-husna/${item.id}` as any)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.id}: ${item.transliteration}, ${item.englishMeaning}`}
                  >
                    {/* Top Row with ID & Favorite */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.idCircle}>
                        <Text style={styles.idText}>{item.id}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.cardFavBtn}
                        onPress={() => handleToggleFavorite(item.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Favorite name"
                      >
                        <Ionicons
                          name={isFav ? 'star' : 'star-outline'}
                          size={18}
                          color={isFav ? COLORS.gold : COLORS.textTertiary}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* Arabic Name */}
                    <Text style={styles.cardArabic}>{item.arabic}</Text>

                    {/* Transliteration */}
                    <Text style={styles.cardTranslit} numberOfLines={1}>
                      {item.transliteration}
                    </Text>

                    {/* Urdu Meaning */}
                    <Text style={styles.cardUrdu} numberOfLines={1}>
                      {item.urduMeaning}
                    </Text>

                    {/* English Meaning */}
                    <Text style={styles.cardEng} numberOfLines={2}>
                      {item.englishMeaning}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleEn: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F291E',
  },
  headerTitleUr: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  headerAction: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F6',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
  },
  clearBtn: {
    padding: SPACING.xs,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
    gap: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0F4F6',
  },
  tabActive: {
    backgroundColor: COLORS.emerald,
  },
  favIcon: {
    marginRight: 6,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl * 2,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  dailyCard: {
    backgroundColor: '#0F291E',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.md,
    borderWidth: 1,
    borderColor: '#C8A84E40',
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  dailyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gold,
  },
  dailyShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyBody: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  dailyArabic: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'center',
    marginBottom: 6,
  },
  dailyTransliteration: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 4,
  },
  dailyUrduMeaning: {
    fontSize: 15,
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 2,
  },
  dailyEngMeaning: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  dailyExplanation: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: SPACING.md,
  },
  dailyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    gap: 6,
  },
  dailyLearnMore: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gold,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  gridTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  gridCount: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  nameCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
    alignItems: 'center',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.xs,
  },
  idCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  cardFavBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArabic: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.emerald,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardTranslit: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F291E',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardUrdu: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  cardEng: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
});
