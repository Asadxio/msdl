import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SPACING } from '@/constants/theme';
import { fetchSurah, QuranAyat, SurahData } from '@/lib/quranApi';
import {
  addBookmark, incrementKhatamAyats,
  isBookmarked, loadFontSize, loadShowRoman,
  removeBookmark, saveFontSize, saveLastRead, saveShowRoman,
} from '@/lib/quranStorage';
import { getSurahByNumber, QURAN_SURAHS } from '@/constants/quranSurahs';

export default function QuranReaderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ surah: string; ayat?: string }>();
  const surahNum = parseInt(params.surah || '1', 10);
  const initialAyat = parseInt(params.ayat || '1', 10);

  const surahMeta = getSurahByNumber(surahNum);
  const [surahData, setSurahData] = useState<SurahData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isOffline, setIsOffline] = useState(false);
  const [showRoman, setShowRoman] = useState(true);
  const [fontSize, setFontSize] = useState(22);
  const [bookmarkedAyats, setBookmarkedAyats] = useState<Set<number>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const ayatHeights = useRef<Record<number, number>>({});
  const scrolledToInitial = useRef(false);

  useEffect(() => {
    Promise.all([loadShowRoman(), loadFontSize()]).then(([roman, size]) => {
      setShowRoman(roman);
      setFontSize(size);
    });
  }, []);

  const loadSurah = useCallback(async () => {
    setStatus('loading');
    try {
      if (!surahMeta) throw new Error('Invalid surah number');
      const data = await fetchSurah(surahNum, surahMeta.blogSlug, surahMeta.englishName);
      setSurahData(data);
      // Check if data was from cache (fetchedAt matches cache)
      setIsOffline(Date.now() - data.fetchedAt > 60000);
      setStatus('ready');
      // Save last read
      await saveLastRead({ surahNumber: surahNum, ayatNumber: initialAyat, surahName: surahMeta.englishName, timestamp: Date.now() });
      // Increment khatam
      await incrementKhatamAyats(1);
    } catch (err) {
      console.error('loadSurah error:', err);
      setStatus('error');
    }
  }, [surahNum, surahMeta, initialAyat]);

  useEffect(() => { loadSurah(); }, [loadSurah]);

  useEffect(() => {
    if (status !== 'ready' || !surahData || scrolledToInitial.current) return;
    if (initialAyat > 1) {
      setTimeout(() => {
        let yOffset = 0;
        for (let i = 1; i < initialAyat; i++) {
          yOffset += (ayatHeights.current[i] || 120);
        }
        scrollRef.current?.scrollTo({ y: yOffset - 60, animated: true });
        scrolledToInitial.current = true;
      }, 400);
    }
  }, [status, surahData, initialAyat]);

  const handleBookmarkToggle = async (ayat: QuranAyat) => {
    const key = ayat.number;
    const already = bookmarkedAyats.has(key);
    if (already) {
      await removeBookmark(surahNum, ayat.number);
      setBookmarkedAyats((prev) => { const next = new Set(prev); next.delete(key); return next; });
    } else {
      await addBookmark({ surahNumber: surahNum, ayatNumber: ayat.number, surahName: surahMeta?.englishName || '', arabicText: ayat.arabic, savedAt: Date.now() });
      setBookmarkedAyats((prev) => new Set([...prev, key]));
    }
  };

  const handleShare = (ayat: QuranAyat) => {
    const text = ayat.arabic + (showRoman && ayat.roman ? '\n\n' + ayat.roman : '') + '\n\n' + ayat.urduMeaning + '\n\n— ' + (surahMeta?.englishName || '') + ', Ayat ' + ayat.number + '\n\nMSDL App';
    Share.share({ message: text });
  };

  const navigateSurah = (direction: -1 | 1) => {
    const next = surahNum + direction;
    if (next >= 1 && next <= 114) {
      scrolledToInitial.current = false;
      router.replace(('/quran-reader?surah=' + next) as any);
    }
  };

  const showBismillah = surahNum !== 1 && surahNum !== 9;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerArabic}>{surahMeta?.arabicName || ''}</Text>
          <Text style={styles.headerEn}>{surahMeta?.englishName} ({surahNum})</Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(true)}>
          <Ionicons name="options-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Status bar */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={() => navigateSurah(-1)} disabled={surahNum <= 1}>
          <Ionicons name="chevron-back" size={18} color={surahNum > 1 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>
        <Text style={styles.statusText}>
          {surahMeta?.totalAyat} آیات • پارہ {surahMeta?.parah} • {surahMeta?.type}
          {isOffline ? '  📴 Cache' : '  🌐 Live'}
        </Text>
        <TouchableOpacity onPress={() => navigateSurah(1)} disabled={surahNum >= 114}>
          <Ionicons name="chevron-forward" size={18} color={surahNum < 114 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {status === 'loading' ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#C8A84E" />
          <Text style={styles.loadingText}>سورہ لوڈ ہو رہی ہے...</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.centerBox}>
          <Ionicons name="wifi-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>انٹرنیٹ کنیکشن چیک کریں</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSurah}>
            <Text style={styles.retryBtnText}>دوبارہ کوشش کریں</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Bismillah */}
          {showBismillah && (
            <View style={styles.bismillahCard}>
              <Text style={styles.bismillahText}>بِسۡمِ اللّٰہِ الرَّحۡمٰنِ الرَّحِیۡمِ</Text>
              {showRoman && <Text style={styles.bismillahRoman}>Bismillāhi r-raḥmāni r-raḥīm</Text>}
            </View>
          )}

          {/* Ayats */}
          {(surahData?.ayats || []).map((ayat) => {
            const isBookmark = bookmarkedAyats.has(ayat.number);
            return (
              <View
                key={ayat.number}
                style={styles.ayatCard}
                onLayout={(e) => { ayatHeights.current[ayat.number] = e.nativeEvent.layout.height; }}
              >
                <View style={styles.ayatHeader}>
                  <View style={styles.ayatNumBadge}>
                    <Text style={styles.ayatNumText}>{ayat.number}</Text>
                  </View>
                  <View style={styles.ayatActions}>
                    <TouchableOpacity onPress={() => handleBookmarkToggle(ayat)} style={styles.actionBtn}>
                      <Ionicons name={isBookmark ? 'bookmark' : 'bookmark-outline'} size={18} color={isBookmark ? '#C8A84E' : '#94A3B8'} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(ayat)} style={styles.actionBtn}>
                      <Ionicons name="share-outline" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Arabic */}
                <Text style={[styles.arabicText, { fontSize }]}>{ayat.arabic}</Text>
                {/* Roman */}
                {showRoman && ayat.roman ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.romanText}>{ayat.roman}</Text>
                  </>
                ) : null}
                {/* Urdu */}
                {ayat.urduMeaning ? (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.urduText}>{ayat.urduMeaning}</Text>
                  </>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <View style={styles.settingsOverlay}>
          <TouchableOpacity style={styles.settingsDismiss} onPress={() => setShowSettings(false)} />
          <View style={styles.settingsPanel}>
            <View style={styles.settingsHandle} />
            <Text style={styles.settingsTitle}>Reader ترتیب</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Roman Urdu دکھائیں</Text>
              <TouchableOpacity
                style={[styles.toggle, showRoman && styles.toggleOn]}
                onPress={async () => { const v = !showRoman; setShowRoman(v); await saveShowRoman(v); }}
              >
                <View style={[styles.toggleThumb, showRoman && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>عربی فونٹ سائز: {fontSize}px</Text>
            </View>
            <View style={styles.fontSizeRow}>
              {[16, 18, 20, 22, 26, 30].map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.fontBtn, fontSize === size && styles.fontBtnActive]}
                  onPress={async () => { setFontSize(size); await saveFontSize(size); }}
                >
                  <Text style={[styles.fontBtnText, fontSize === size && { color: '#FFFFFF' }]}>A{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#002E23' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 8, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerArabic: { fontSize: 18, fontWeight: '900', color: '#C8A84E' },
  headerEn: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: 8 },
  statusText: { fontSize: 11, color: '#94A3B8', fontWeight: '600', flex: 1, textAlign: 'center' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#C8A84E', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  retryBtn: { backgroundColor: '#005F46', paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 12, paddingTop: 8 },
  bismillahCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: 'rgba(200,168,78,0.4)' },
  bismillahText: { fontSize: 22, fontWeight: '700', color: '#C8A84E', textAlign: 'center' },
  bismillahRoman: { fontSize: 13, fontStyle: 'italic', color: '#94A3B8', textAlign: 'center' },
  ayatCard: { backgroundColor: '#FFFFFF', borderRadius: RADIUS.xl, padding: SPACING.md, gap: 10 },
  ayatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ayatNumBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#003D2E', alignItems: 'center', justifyContent: 'center' },
  ayatNumText: { fontSize: 12, fontWeight: '900', color: '#C8A84E' },
  ayatActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#F8FAFC' },
  arabicText: { color: '#0F172A', textAlign: 'right', lineHeight: 48, fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  romanText: { fontSize: 13, fontStyle: 'italic', color: '#4F46E5', lineHeight: 22 },
  urduText: { fontSize: 14, color: '#334155', textAlign: 'right', lineHeight: 26 },
  settingsOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  settingsDismiss: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  settingsPanel: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACING.lg, gap: 16 },
  settingsHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  settingsTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingsLabel: { fontSize: 14, color: '#334155', fontWeight: '600' },
  toggle: { width: 48, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', padding: 2 },
  toggleOn: { backgroundColor: '#005F46' },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' },
  toggleThumbOn: { transform: [{ translateX: 22 }] },
  fontSizeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  fontBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.md, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  fontBtnActive: { backgroundColor: '#005F46', borderColor: '#005F46' },
  fontBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
});
