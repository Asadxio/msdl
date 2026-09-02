import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "@/lib/navigation";
import { ScreenRefreshControl } from "@/components/ui";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Share, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "@/constants/theme";
import { QURAN_SURAHS, searchSurahs, TOTAL_AYAT, TOTAL_PARAHS, SurahMeta } from "@/constants/quranSurahs";
import {
  loadLastRead, loadKhatamProgress, loadHifzProgress,
  toggleParahHifz, KhatamProgress, HifzProgress,
} from "@/lib/quranStorage";
import { getDailyAyat } from "@/lib/quranApi";
import type { DailyAyatCache } from "@/lib/quranStorage";

type ActiveTab = 'surahs' | 'reader' | 'khatam' | 'hifz' | 'daily';

export default function QuranScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<ActiveTab>('surahs');
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSurahs, setFilteredSurahs] = useState<SurahMeta[]>(QURAN_SURAHS);
  const [lastRead, setLastRead] = useState<{ surahNumber: number; ayatNumber: number; surahName: string } | null>(null);
  const [khatam, setKhatam] = useState<KhatamProgress | null>(null);
  const [hifz, setHifz] = useState<HifzProgress | null>(null);
  const [dailyAyat, setDailyAyat] = useState<DailyAyatCache | null>(null);
  const [loadingDailyAyat, setLoadingDailyAyat] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [lr, kt, hf] = await Promise.all([loadLastRead(), loadKhatamProgress(), loadHifzProgress()]);
      setLastRead(lr);
      setKhatam(kt);
      setHifz(hf);
    };
    init();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily' && !dailyAyat) {
      setLoadingDailyAyat(true);
      getDailyAyat().then((a) => { setDailyAyat(a); setLoadingDailyAyat(false); }).catch(() => setLoadingDailyAyat(false));
    }
  }, [activeTab, dailyAyat]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setFilteredSurahs(searchSurahs(q));
  }, []);

  const handleToggleParah = async (parahNum: number) => {
    const updated = await toggleParahHifz(parahNum);
    setHifz(updated);
  };

  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    const [lr, kt, hf] = await Promise.all([loadLastRead(), loadKhatamProgress(), loadHifzProgress()]);
    setLastRead(lr); setKhatam(kt); setHifz(hf);
    setDailyAyat(null);
  });

  const khatamPercent = khatam ? Math.min(100, Math.round(((khatam.ayatsRead % TOTAL_AYAT) / TOTAL_AYAT) * 100)) : 0;
  const hifzPercent = hifz ? Math.round((hifz.completedParahs.length / TOTAL_PARAHS) * 100) : 0;

  const renderSurahItem = ({ item }: { item: SurahMeta }) => (
    <TouchableOpacity
      style={styles.surahRow}
      onPress={() => router.push(('/quran-reader?surah=' + item.number) as any)}
      activeOpacity={0.7}
    >
      <View style={styles.surahNumCircle}>
        <Text style={styles.surahNumText}>{item.number}</Text>
      </View>
      <View style={styles.surahDetailsCol}>
        <View style={styles.surahTitleRow}>
          <Text style={styles.surahEnglishName}>{item.englishName}</Text>
          <Text style={styles.surahArabicName}>{item.arabicName}</Text>
        </View>
        <View style={styles.surahMetaRow}>
          <Text style={styles.surahAyatCount}>{item.totalAyat} Verses • Para {item.parah}</Text>
          <View style={[styles.typeBadge, item.type === 'Makki' ? styles.makkiBadge : styles.madaniBadge]}>
            <Text style={[styles.typeBadgeText, item.type === 'Makki' ? styles.makkiBadgeText : styles.madaniBadgeText]}>
              {item.type}
            </Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => goBackOrReplace(router, '/more')}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>القرآن الكريم</Text>
          <Text style={styles.headerSubtitle}>Holy Quran with Roman Urdu & Audio</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { id: 'surahs', label: 'Surahs', icon: 'list-outline' },
          { id: 'reader', label: 'Reader', icon: 'book-outline' },
          { id: 'khatam', label: 'Khatam', icon: 'checkmark-circle-outline' },
          { id: 'hifz',   label: 'Hifz',  icon: 'star-outline' },
          { id: 'daily',  label: 'Daily Ayat',   icon: 'sunny-outline' },
        ] as const).map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, isSelected && styles.tabBtnSelected]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={tab.icon as any} size={14} color={isSelected ? '#002E23' : '#94A3B8'} />
              <Text style={[styles.tabBtnText, isSelected && styles.tabBtnTextSelected]} numberOfLines={1}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      {activeTab === 'surahs' && (
        <View style={{ flex: 1 }}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search Surah (e.g. Yaseen, Baqarah, 36)..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={filteredSurahs}
            keyExtractor={(item) => item.number.toString()}
            renderItem={renderSurahItem}
            contentContainerStyle={{ paddingHorizontal: SPACING.md, paddingBottom: insets.bottom + 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<ScreenRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Ionicons name="search-outline" size={40} color="#94A3B8" />
                <Text style={styles.emptyText}>No Surah found</Text>
              </View>
            }
          />
        </View>
      )}

      {activeTab === 'reader' && (
        <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}>
          {lastRead ? (
            <View style={styles.lastReadCard}>
              <View style={styles.lastReadIcon}><Ionicons name="bookmark" size={24} color="#C8A84E" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lastReadLabel}>Last Read Position:</Text>
                <Text style={styles.lastReadSurah}>{lastRead.surahName}</Text>
                <Text style={styles.lastReadAyat}>Ayat #{lastRead.ayatNumber}</Text>
              </View>
              <TouchableOpacity
                style={styles.resumeBtn}
                onPress={() => router.push(('/quran-reader?surah=' + lastRead.surahNumber + '&ayat=' + lastRead.ayatNumber) as any)}
              >
                <Text style={styles.resumeBtnText}>Resume ▶</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.noLastReadCard}>
              <Ionicons name="book-outline" size={48} color="#C8A84E" />
              <Text style={styles.noLastReadTitle}>Start Reciting Quran</Text>
              <Text style={styles.noLastReadSubtitle}>Select a Surah from the Surahs tab to start reading</Text>
            </View>
          )}
          <Text style={styles.sectionLabel}>Frequently Read Surahs</Text>
          {[1, 36, 55, 67, 112, 113, 114].map((num) => {
            const s = QURAN_SURAHS[num - 1];
            return (
              <TouchableOpacity
                key={num}
                style={styles.quickSurahRow}
                onPress={() => router.push(('/quran-reader?surah=' + num) as any)}
              >
                <Text style={styles.quickSurahNum}>{num}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.quickSurahArabic}>{s.arabicName}</Text>
                  <Text style={styles.quickSurahEn}>{s.englishName} • {s.totalAyat} Verses</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {activeTab === 'khatam' && khatam && (
        <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.khatamHeroCard}>
            <View style={styles.progressRingOuter}>
              <View style={styles.progressRingInner}>
                <Text style={styles.progressPercent}>{khatamPercent}%</Text>
                <Text style={styles.progressLabel}>Done</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.khatamTitle}>Quran Khatam Tracker</Text>
              <Text style={styles.khatamStat}>{khatam.ayatsRead % TOTAL_AYAT} / {TOTAL_AYAT} Verses Read</Text>
              <Text style={styles.khatamStat}>Completed Khatams: {khatam.completions}x</Text>
            </View>
          </View>
          <View style={styles.khatamInfoRow}>
            <View style={styles.khatamInfoCard}>
              <Ionicons name="flame-outline" size={20} color="#EA580C" />
              <Text style={styles.khatamInfoNum}>{Math.floor((Date.now() - khatam.startedAt) / 86400000)}</Text>
              <Text style={styles.khatamInfoLabel}>Days Active</Text>
            </View>
            <View style={styles.khatamInfoCard}>
              <Ionicons name="trophy-outline" size={20} color="#C8A84E" />
              <Text style={styles.khatamInfoNum}>{khatam.completions}</Text>
              <Text style={styles.khatamInfoLabel}>Khatams</Text>
            </View>
            <View style={styles.khatamInfoCard}>
              <Ionicons name="book-outline" size={20} color="#005F46" />
              <Text style={styles.khatamInfoNum}>{khatam.ayatsRead}</Text>
              <Text style={styles.khatamInfoLabel}>Total Verses</Text>
            </View>
          </View>
          <Text style={styles.khatamTip}>💡 Reading ayats in the Quran Reader automatically increases this tracker.</Text>
        </ScrollView>
      )}

      {activeTab === 'hifz' && hifz && (
        <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.hifzHeader}>
            <Text style={styles.hifzTitle}>Hifz Tracker — {hifz.completedParahs.length}/{TOTAL_PARAHS} Paras Memorized</Text>
            <View style={styles.hifzProgressBar}>
              <View style={[styles.hifzProgressFill, { width: (hifzPercent + '%') as any }]} />
            </View>
            <Text style={styles.hifzPercent}>{hifzPercent}% Completed</Text>
          </View>
          {Array.from({ length: 30 }, (_, i) => i + 1).map((paraNum) => {
            const done = hifz.completedParahs.includes(paraNum);
            return (
              <TouchableOpacity
                key={paraNum}
                style={[styles.paraRow, done && styles.paraRowDone]}
                onPress={() => handleToggleParah(paraNum)}
                activeOpacity={0.8}
              >
                <View style={[styles.paraNumCircle, done && styles.paraNumCircleDone]}>
                  <Text style={[styles.paraNumText, done && { color: '#FFFFFF' }]}>{paraNum}</Text>
                </View>
                <Text style={[styles.paraLabel, done && { color: '#005F46', fontWeight: '800' }]}>
                  Para {paraNum} (پارہ {paraNum})
                </Text>
                <Ionicons
                  name={done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={done ? '#005F46' : '#CBD5E1'}
                />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {activeTab === 'daily' && (
        <ScrollView contentContainerStyle={[styles.tabContent, { paddingBottom: insets.bottom + 20 }]}>
          {loadingDailyAyat ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#C8A84E" />
              <Text style={styles.loadingText}>Loading Daily Ayat...</Text>
            </View>
          ) : dailyAyat ? (
            <>
              <View style={styles.dailyBadge}>
                <Ionicons name="sunny" size={16} color="#C8A84E" />
                <Text style={styles.dailyBadgeText}>Daily Ayat — {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={styles.dailyAyatCard}>
                <Text style={styles.dailyArabic}>{dailyAyat.arabic}</Text>
                <View style={styles.divider} />
                <Text style={styles.dailyRoman}>{dailyAyat.roman}</Text>
                <View style={styles.divider} />
                <Text style={styles.dailyUrdu}>{dailyAyat.urduMeaning}</Text>
                <Text style={styles.dailySurahRef}>— {dailyAyat.surahName}, Ayat #{dailyAyat.ayatNumber}</Text>
              </View>
              <TouchableOpacity
                style={styles.shareBtn}
                onPress={() => Share.share({ message: dailyAyat.arabic + '\n\n' + dailyAyat.roman + '\n\n' + dailyAyat.urduMeaning + '\n\n— ' + dailyAyat.surahName + ' (' + dailyAyat.ayatNumber + ')\n\nMSDL App' })}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share on WhatsApp / Social</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.readFullBtn}
                onPress={() => router.push(('/quran-reader?surah=' + dailyAyat.surahNumber + '&ayat=' + dailyAyat.ayatNumber) as any)}
              >
                <Ionicons name="book-outline" size={18} color="#005F46" />
                <Text style={styles.readFullBtnText}>Read Full Surah</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.loadingBox}>
              <Ionicons name="wifi-outline" size={40} color="#94A3B8" />
              <Text style={styles.loadingText}>Could not load daily ayat</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#002E23' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 10, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#C8A84E' },
  headerSubtitle: { fontSize: 11, color: '#FFFFFF', fontWeight: '500', marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.2)', marginHorizontal: SPACING.md, marginBottom: 12, borderRadius: RADIUS.lg, padding: 4, gap: 4 },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderRadius: RADIUS.md, gap: 4 },
  tabBtnSelected: { backgroundColor: '#C8A84E' },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  tabBtnTextSelected: { color: '#002E23', fontWeight: '900' },
  tabContent: { padding: SPACING.md, gap: 14 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: SPACING.md, marginBottom: 12, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F172A' },
  surahRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 16, marginBottom: 10, gap: 14, borderWidth: 1, borderColor: '#F1F5F9' },
  surahNumCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  surahNumText: { fontSize: 14, fontWeight: '900', color: '#005F46' },
  surahDetailsCol: { flex: 1, gap: 4 },
  surahTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  surahEnglishName: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  surahArabicName: { fontSize: 18, fontWeight: '800', color: '#005F46' },
  surahMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  surahAyatCount: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  makkiBadge: { backgroundColor: '#FEF3C7' },
  madaniBadge: { backgroundColor: '#EEF2FF' },
  typeBadgeText: { fontSize: 10, fontWeight: '800' },
  makkiBadgeText: { color: '#B45309' },
  madaniBadgeText: { color: '#4338CA' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#94A3B8', fontSize: 14 },
  lastReadCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.md, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5, borderColor: '#C8A84E' },
  lastReadIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(200,168,78,0.15)', alignItems: 'center', justifyContent: 'center' },
  lastReadLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  lastReadSurah: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  lastReadAyat: { fontSize: 12, color: '#C8A84E', fontWeight: '700' },
  resumeBtn: { backgroundColor: '#C8A84E', borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 10 },
  resumeBtnText: { fontSize: 12, fontWeight: '800', color: '#002E23' },
  noLastReadCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.xl, alignItems: 'center', gap: 12 },
  noLastReadTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  noLastReadSubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center' },
  sectionLabel: { fontSize: 12, fontWeight: '900', color: '#C8A84E', textTransform: 'uppercase', letterSpacing: 0.5 },
  quickSurahRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: SPACING.md, gap: 12 },
  quickSurahNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#003D2E', textAlign: 'center', lineHeight: 32, color: '#C8A84E', fontWeight: '900', fontSize: 12 },
  quickSurahArabic: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  quickSurahEn: { fontSize: 11, color: '#64748B', marginTop: 2 },
  khatamHeroCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: 20, borderWidth: 1.5, borderColor: '#C8A84E' },
  progressRingOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: '#C8A84E', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(200,168,78,0.1)' },
  progressRingInner: { alignItems: 'center' },
  progressPercent: { fontSize: 18, fontWeight: '900', color: '#C8A84E' },
  progressLabel: { fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
  khatamTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  khatamStat: { fontSize: 12, color: '#C8A84E', fontWeight: '700', marginTop: 4 },
  khatamInfoRow: { flexDirection: 'row', gap: 10 },
  khatamInfoCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, padding: 12, alignItems: 'center', gap: 4 },
  khatamInfoNum: { fontSize: 22, fontWeight: '900', color: '#005F46' },
  khatamInfoLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textAlign: 'center' },
  khatamTip: { backgroundColor: 'rgba(200,168,78,0.1)', borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: 11, color: '#C8A84E', borderWidth: 1, borderColor: 'rgba(200,168,78,0.3)' },
  hifzHeader: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 8, borderWidth: 1, borderColor: '#C8A84E', alignItems: 'center' },
  hifzTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  hifzProgressBar: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' },
  hifzProgressFill: { height: '100%', backgroundColor: '#C8A84E', borderRadius: 4 },
  hifzPercent: { fontSize: 12, color: '#C8A84E', fontWeight: '700' },
  paraRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 12, gap: 14 },
  paraRowDone: { backgroundColor: '#E8F5EE' },
  paraNumCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  paraNumCircleDone: { backgroundColor: '#005F46' },
  paraNumText: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  paraLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#334155' },
  dailyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(200,168,78,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(200,168,78,0.3)' },
  dailyBadgeText: { fontSize: 12, fontWeight: '700', color: '#C8A84E' },
  dailyAyatCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: SPACING.lg, gap: 12 },
  dailyArabic: { fontSize: 26, fontWeight: '700', color: '#0F172A', textAlign: 'right', lineHeight: 44 },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  dailyRoman: { fontSize: 15, fontStyle: 'italic', color: '#4F46E5', lineHeight: 24 },
  dailyUrdu: { fontSize: 16, color: '#334155', textAlign: 'right', lineHeight: 28 },
  dailySurahRef: { fontSize: 12, color: '#64748B', fontWeight: '600', textAlign: 'right' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#25D366', borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  shareBtnText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  readFullBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#E8F5EE', borderRadius: RADIUS.lg, padding: 14, gap: 8, borderWidth: 1, borderColor: '#005F46' },
  readFullBtnText: { fontSize: 14, fontWeight: '800', color: '#005F46' },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 14 },
  loadingText: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
});
