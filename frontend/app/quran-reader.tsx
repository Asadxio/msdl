import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Share, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  fetchSurah, QuranAyat, SurahData,
  getAyatAudioUrl, getFullSurahUrduAudioUrl,
} from '@/lib/quranApi';
import {
  addBookmark, incrementKhatamAyats,
  loadFontSize, loadShowRoman,
  removeBookmark, saveFontSize, saveLastRead, saveShowRoman,
} from '@/lib/quranStorage';
import { getSurahByNumber } from '@/constants/quranSurahs';

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

  // Audio Player State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAyatNum, setPlayingAyatNum] = useState<number | null>(null); // null = full surah or none
  const [isFullSurahPlaying, setIsFullSurahPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const ayatHeights = useRef<Record<number, number>>({});
  const scrolledToInitial = useRef(false);

  useEffect(() => {
    Promise.all([loadShowRoman(), loadFontSize()]).then(([roman, size]) => {
      setShowRoman(roman);
      setFontSize(size);
    });
    return () => {
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [sound]);

  const loadSurah = useCallback(async () => {
    setStatus('loading');
    try {
      if (!surahMeta) throw new Error('Invalid surah number');
      const data = await fetchSurah(surahNum, surahMeta.blogSlug, surahMeta.englishName);
      setSurahData(data);
      setIsOffline(Date.now() - data.fetchedAt > 60000);
      setStatus('ready');
      await saveLastRead({ surahNumber: surahNum, ayatNumber: initialAyat, surahName: surahMeta.englishName, timestamp: Date.now() });
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

  // Audio Playback Handlers
  const stopCurrentAudio = async () => {
    if (sound) {
      try {
        await sound.stopAsync();
        await sound.unloadAsync();
      } catch (e) {
        // ignore
      }
      setSound(null);
    }
    setIsPlayingAudio(false);
    setPlayingAyatNum(null);
    setIsFullSurahPlaying(false);
  };

  const playAyatAudio = async (ayatNum: number) => {
    try {
      setAudioLoading(true);
      if (sound && isPlayingAudio && playingAyatNum === ayatNum) {
        await stopCurrentAudio();
        setAudioLoading(false);
        return;
      }
      await stopCurrentAudio();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const audioUrl = getAyatAudioUrl(surahNum, ayatNum);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlayingAudio(true);
      setPlayingAyatNum(ayatNum);
      setIsFullSurahPlaying(false);

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) return;
        if (playbackStatus.didJustFinish) {
          setIsPlayingAudio(false);
          setPlayingAyatNum(null);
          // Auto-play next ayat if available
          if (surahData && ayatNum < surahData.totalAyat) {
            playAyatAudio(ayatNum + 1);
          }
        }
      });
    } catch (error) {
      console.warn('Audio play error:', error);
    } finally {
      setAudioLoading(false);
    }
  };

  const playFullSurahAudio = async () => {
    try {
      setAudioLoading(true);
      if (sound && isFullSurahPlaying) {
        await stopCurrentAudio();
        setAudioLoading(false);
        return;
      }
      await stopCurrentAudio();

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const audioUrl = getFullSurahUrduAudioUrl(surahNum);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlayingAudio(true);
      setIsFullSurahPlaying(true);
      setPlayingAyatNum(null);

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) return;
        if (playbackStatus.didJustFinish) {
          setIsPlayingAudio(false);
          setIsFullSurahPlaying(false);
        }
      });
    } catch (error) {
      console.warn('Full surah audio error:', error);
    } finally {
      setAudioLoading(false);
    }
  };

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

  const navigateSurah = async (direction: -1 | 1) => {
    await stopCurrentAudio();
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
        <TouchableOpacity style={styles.headerBtn} onPress={async () => { await stopCurrentAudio(); goBackOrReplace(router, '/quran'); }}>
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

      {/* Top Controls Bar */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={() => navigateSurah(-1)} disabled={surahNum <= 1}>
          <Ionicons name="chevron-back" size={18} color={surahNum > 1 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>

        {/* Full Surah Audio Button (From user website collection) */}
        <TouchableOpacity
          style={[styles.audioPillBtn, isFullSurahPlaying && styles.audioPillBtnActive]}
          onPress={playFullSurahAudio}
          activeOpacity={0.8}
        >
          {audioLoading && isFullSurahPlaying ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name={isFullSurahPlaying ? 'pause' : 'play'} size={14} color={isFullSurahPlaying ? '#FFFFFF' : '#002E23'} />
          )}
          <Text style={[styles.audioPillText, isFullSurahPlaying && styles.audioPillTextActive]}>
            {isFullSurahPlaying ? 'Recitation Playing' : 'Full Surah Audio Recitation'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigateSurah(1)} disabled={surahNum >= 114}>
          <Ionicons name="chevron-forward" size={18} color={surahNum < 114 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {status === 'loading' ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#C8A84E" />
          <Text style={styles.loadingText}>Loading Surah...</Text>
        </View>
      ) : status === 'error' ? (
        <View style={styles.centerBox}>
          <Ionicons name="wifi-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Please check internet connection</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSurah}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 30 }]}
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
            const isThisAyatPlaying = isPlayingAudio && playingAyatNum === ayat.number;

            return (
              <View
                key={ayat.number}
                style={[styles.ayatCard, isThisAyatPlaying && styles.ayatCardPlaying]}
                onLayout={(e) => { ayatHeights.current[ayat.number] = e.nativeEvent.layout.height; }}
              >
                <View style={styles.ayatHeader}>
                  <View style={styles.ayatNumBadge}>
                    <Text style={styles.ayatNumText}>{ayat.number}</Text>
                  </View>

                  <View style={styles.ayatActions}>
                    {/* Audio Tilawat Play Button for this Ayat */}
                    <TouchableOpacity
                      onPress={() => playAyatAudio(ayat.number)}
                      style={[styles.actionBtn, isThisAyatPlaying && styles.actionBtnActive]}
                    >
                      <Ionicons
                        name={isThisAyatPlaying ? 'volume-high' : 'play-outline'}
                        size={16}
                        color={isThisAyatPlaying ? '#005F46' : '#64748B'}
                      />
                    </TouchableOpacity>

                    {/* Bookmark Button */}
                    <TouchableOpacity onPress={() => handleBookmarkToggle(ayat)} style={styles.actionBtn}>
                      <Ionicons
                        name={isBookmark ? 'bookmark' : 'bookmark-outline'}
                        size={16}
                        color={isBookmark ? '#C8A84E' : '#64748B'}
                      />
                    </TouchableOpacity>

                    {/* Share Button */}
                    <TouchableOpacity onPress={() => handleShare(ayat)} style={styles.actionBtn}>
                      <Ionicons name="share-outline" size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Arabic Text */}
                <Text style={[styles.arabicText, { fontSize, lineHeight: fontSize * 2 }]}>{ayat.arabic}</Text>

                {/* Roman Urdu Transliteration Section */}
                {showRoman && ayat.roman ? (
                  <View style={styles.romanContainer}>
                    <View style={styles.sectionHeaderBadge}>
                      <Ionicons name="text-outline" size={12} color="#4F46E5" />
                      <Text style={styles.sectionBadgeLabel}>Roman</Text>
                    </View>
                    <Text style={styles.romanText}>{ayat.roman}</Text>
                  </View>
                ) : null}

                {/* Urdu Tarjuma Section */}
                {ayat.urduMeaning ? (
                  <View style={styles.urduContainer}>
                    <View style={styles.sectionHeaderBadge}>
                      <Ionicons name="book-outline" size={12} color="#005F46" />
                      <Text style={[styles.sectionBadgeLabel, { color: '#005F46' }]}>اردو ترجمہ</Text>
                    </View>
                    <Text style={styles.urduText}>{ayat.urduMeaning}</Text>
                  </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, paddingBottom: 6, gap: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerArabic: { fontSize: 18, fontWeight: '900', color: '#C8A84E' },
  headerEn: { fontSize: 11, color: '#FFFFFF', fontWeight: '600' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingBottom: 8, gap: 8 },
  audioPillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#C8A84E', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, gap: 6 },
  audioPillBtnActive: { backgroundColor: '#005F46', borderWidth: 1, borderColor: '#C8A84E' },
  audioPillText: { fontSize: 11, fontWeight: '800', color: '#002E23' },
  audioPillTextActive: { color: '#FFFFFF' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingText: { color: '#C8A84E', fontSize: 15, fontWeight: '700' },
  errorText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
  retryBtn: { backgroundColor: '#005F46', paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.lg },
  retryBtnText: { color: '#FFFFFF', fontWeight: '700' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 12, paddingTop: 4 },
  bismillahCard: { backgroundColor: '#003D2E', borderRadius: RADIUS.xl, padding: SPACING.lg, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(200,168,78,0.4)' },
  bismillahText: { fontSize: 22, fontWeight: '700', color: '#C8A84E', textAlign: 'center' },
  bismillahRoman: { fontSize: 13, fontStyle: 'italic', color: '#94A3B8', textAlign: 'center' },
  ayatCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, gap: 14, borderWidth: 1, borderColor: '#F1F5F9', ...SHADOWS.card, shadowOpacity: 0.05 },
  ayatCardPlaying: { borderColor: '#C8A84E', backgroundColor: '#FFFDF5', borderWidth: 1.5 },
  ayatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F8FAFC', paddingBottom: 10 },
  ayatNumBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  ayatNumText: { fontSize: 13, fontWeight: '900', color: '#005F46' },
  ayatActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: '#F1F5F9' },
  actionBtnActive: { backgroundColor: '#C8A84E' },
  arabicText: { color: '#0F172A', textAlign: 'right', fontWeight: '700', paddingVertical: 4 },
  romanContainer: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: '#4F46E5', gap: 6 },
  urduContainer: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderRightWidth: 3, borderRightColor: '#005F46', gap: 6 },
  sectionHeaderBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionBadgeLabel: { fontSize: 11, fontWeight: '800', color: '#4F46E5', textTransform: 'uppercase' },
  romanText: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '500' },
  urduText: { fontSize: 15, color: '#064E3B', textAlign: 'right', lineHeight: 28, fontWeight: '600' },
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
