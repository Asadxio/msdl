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
  addBookmark, removeBookmark, loadBookmarks, incrementKhatamAyats,
  loadFontSize, loadShowRoman,
  saveFontSize, saveLastRead, saveShowRoman,
  saveQuranAudioPlayback, loadQuranAudioPlayback,
  savePreferredAudioSpeed, loadPreferredAudioSpeed,
  type QuranAudioPlaybackState,
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Audio Player & Speed / Resume State
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingAyatNum, setPlayingAyatNum] = useState<number | null>(null); // null = full surah or none
  const [isFullSurahPlaying, setIsFullSurahPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [resumeCandidate, setResumeCandidate] = useState<QuranAudioPlaybackState | null>(null);
  const [dismissResumeBanner, setDismissResumeBanner] = useState(false);
  const playbackSpeedRef = useRef(1.0);

  const scrollRef = useRef<ScrollView>(null);
  const ayatHeights = useRef<Record<number, number>>({});
  const ayatOffsets = useRef<Record<number, number>>({});
  const scrolledToInitial = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const surahDataRef = useRef<SurahData | null>(null);
  const autoAdvanceRef = useRef(true);
  const [autoAdvance, setAutoAdvance] = useState(true);

  useEffect(() => {
    surahDataRef.current = surahData;
  }, [surahData]);

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);

  const scrollToAyat = useCallback((ayatNum: number) => {
    const y = ayatOffsets.current[ayatNum];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 24), animated: true });
    } else {
      let approxY = 0;
      for (let i = 1; i < ayatNum; i++) {
        approxY += (ayatHeights.current[i] || 150);
      }
      scrollRef.current?.scrollTo({ y: Math.max(0, approxY - 24), animated: true });
    }
  }, []);

  useEffect(() => {
    Promise.all([
      loadShowRoman(),
      loadFontSize(),
      loadPreferredAudioSpeed(),
      loadQuranAudioPlayback(surahNum),
      loadBookmarks(),
    ]).then(([roman, size, speed, savedPos, bms]) => {
      setShowRoman(roman);
      setFontSize(size);
      if (speed) {
        setPlaybackSpeed(speed);
        playbackSpeedRef.current = speed;
      }
      if (savedPos && (savedPos.ayatNumber > 1 || savedPos.positionMillis > 2000)) {
        setResumeCandidate(savedPos);
      }
      const thisSurahBookmarks = new Set(
        bms.filter((b) => b.surahNumber === surahNum).map((b) => b.ayatNumber)
      );
      setBookmarkedAyats(thisSurahBookmarks);
      if (initialAyat > 1) {
        setToastMessage(`Resumed at Ayat #${initialAyat}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    });
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, [surahNum]);

  const handleCycleSpeed = async () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    playbackSpeedRef.current = nextSpeed;
    await savePreferredAudioSpeed(nextSpeed);
    if (soundRef.current) {
      await soundRef.current.setRateAsync(nextSpeed, true).catch(() => {});
    }
  };

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
        scrollToAyat(initialAyat);
        scrolledToInitial.current = true;
      }, 400);
    }
  }, [status, surahData, initialAyat, scrollToAyat]);

  // Audio Playback Handlers
  const stopCurrentAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {
        // ignore
      }
      soundRef.current = null;
    }
    setSound(null);
    setIsPlayingAudio(false);
    setPlayingAyatNum(null);
    setIsFullSurahPlaying(false);
  };

  const playAyatAudio = async (ayatNum: number) => {
    try {
      setAudioLoading(true);
      if (soundRef.current && isPlayingAudio && playingAyatNum === ayatNum) {
        await stopCurrentAudio();
        setAudioLoading(false);
        return;
      }
      await stopCurrentAudio();

      // Immediately highlight and smooth-shift viewport to this verse
      setPlayingAyatNum(ayatNum);
      setIsPlayingAudio(true);
      setIsFullSurahPlaying(false);
      scrollToAyat(ayatNum);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const audioUrl = getAyatAudioUrl(surahNum, ayatNum);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      await newSound.setRateAsync(playbackSpeedRef.current, true).catch(() => {});

      soundRef.current = newSound;
      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) return;
        if (playbackStatus.positionMillis && playbackStatus.positionMillis > 1000) {
          void saveQuranAudioPlayback({
            surahNumber: surahNum,
            ayatNumber: ayatNum,
            positionMillis: playbackStatus.positionMillis,
            durationMillis: playbackStatus.durationMillis || 0,
            playbackRate: playbackSpeedRef.current,
            timestamp: Date.now(),
          });
        }
        if (playbackStatus.didJustFinish) {
          const currentData = surahDataRef.current;
          const total = currentData?.totalAyat || surahMeta?.totalAyat || 0;
          if (autoAdvanceRef.current && ayatNum < total) {
            // Automatically advance, shift viewport, and play next verse
            void playAyatAudio(ayatNum + 1);
          } else {
            setIsPlayingAudio(false);
            setPlayingAyatNum(null);
          }
        }
      });
    } catch (error) {
      console.warn('Audio play error:', error);
      setIsPlayingAudio(false);
      setPlayingAyatNum(null);
    } finally {
      setAudioLoading(false);
    }
  };

  const playFullSurahAudio = async () => {
    try {
      setAudioLoading(true);
      if (soundRef.current && isFullSurahPlaying) {
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
      await newSound.setRateAsync(playbackSpeedRef.current, true).catch(() => {});

      soundRef.current = newSound;
      setSound(newSound);
      setIsPlayingAudio(true);
      setIsFullSurahPlaying(true);
      setPlayingAyatNum(null);

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (!playbackStatus.isLoaded) return;
        if (playbackStatus.positionMillis && playbackStatus.positionMillis > 2000) {
          void saveQuranAudioPlayback({
            surahNumber: surahNum,
            ayatNumber: 1,
            positionMillis: playbackStatus.positionMillis,
            durationMillis: playbackStatus.durationMillis || 0,
            playbackRate: playbackSpeedRef.current,
            timestamp: Date.now(),
          });
        }
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
      setToastMessage(`Ayat #${ayat.number} bookmark removed`);
      setTimeout(() => setToastMessage(null), 2500);
    } else {
      await addBookmark({ surahNumber: surahNum, ayatNumber: ayat.number, surahName: surahMeta?.englishName || '', arabicText: ayat.arabic, savedAt: Date.now() });
      setBookmarkedAyats((prev) => new Set([...prev, key]));
      setToastMessage(`Ayat #${ayat.number} bookmarked!`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const changeFontSize = async (delta: number) => {
    const nextSize = Math.max(16, Math.min(36, fontSize + delta));
    setFontSize(nextSize);
    await saveFontSize(nextSize);
    setToastMessage(`Font Size: ${nextSize}px`);
    setTimeout(() => setToastMessage(null), 1500);
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

      {/* Resume Playback Banner ("Jahan chora tha wahan se shuru") */}
      {resumeCandidate && !dismissResumeBanner && !isPlayingAudio && (
        <View style={styles.resumeBanner}>
          <View style={styles.resumeInfo}>
            <View style={styles.resumeIconWrap}>
              <Ionicons name="play" size={14} color="#002E23" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.resumeTitle}>جہاں سے چھوڑا تھا وہیں سے سنیں</Text>
              <Text style={styles.resumeSubtitle}>
                Resume: Verse {resumeCandidate.ayatNumber} of {surahMeta?.englishName || 'Surah'}
              </Text>
            </View>
          </View>
          <View style={styles.resumeActions}>
            <TouchableOpacity
              style={styles.resumeBtn}
              onPress={() => {
                setDismissResumeBanner(true);
                void playAyatAudio(resumeCandidate.ayatNumber);
              }}
            >
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={styles.resumeBtnText}>سنیں (Play)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resumeDismissBtn}
              onPress={() => setDismissResumeBanner(true)}
            >
              <Ionicons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Top Controls Bar */}
      <View style={styles.statusBar}>
        <TouchableOpacity onPress={() => navigateSurah(-1)} disabled={surahNum <= 1}>
          <Ionicons name="chevron-back" size={18} color={surahNum > 1 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>

        {/* Quick Font Size Controls (2.3) */}
        <View style={styles.quickFontControls}>
          <TouchableOpacity
            style={styles.quickFontBtn}
            onPress={() => void changeFontSize(-2)}
            disabled={fontSize <= 16}
            accessibilityLabel="Decrease Font Size"
          >
            <Text style={[styles.quickFontBtnText, fontSize <= 16 && styles.quickFontBtnTextDisabled]}>A-</Text>
          </TouchableOpacity>
          <Text style={styles.quickFontSizeDisplay}>{fontSize}</Text>
          <TouchableOpacity
            style={styles.quickFontBtn}
            onPress={() => void changeFontSize(2)}
            disabled={fontSize >= 36}
            accessibilityLabel="Increase Font Size"
          >
            <Text style={[styles.quickFontBtnText, fontSize >= 36 && styles.quickFontBtnTextDisabled]}>A+</Text>
          </TouchableOpacity>
        </View>

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
            {isFullSurahPlaying ? 'Playing' : 'Audio'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigateSurah(1)} disabled={surahNum >= 114}>
          <Ionicons name="chevron-forward" size={18} color={surahNum < 114 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>
      </View>

      {/* Floating Reader Toast Message (2.1 & 2.2) */}
      {toastMessage && (
        <View style={styles.toastWrap}>
          <View style={styles.toastCard}>
            <Ionicons name="information-circle" size={16} color="#C8A84E" />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        </View>
      )}

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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + (playingAyatNum !== null ? 100 : 30) }]}
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
                onLayout={(e) => {
                  ayatOffsets.current[ayat.number] = e.nativeEvent.layout.y;
                  ayatHeights.current[ayat.number] = e.nativeEvent.layout.height;
                }}
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

      {/* Floating Bottom Audio Player Bar with Auto-Shift & Verse Navigation */}
      {playingAyatNum !== null && isPlayingAudio && (
        <View style={[styles.floatingPlayer, { bottom: insets.bottom + 12 }]}>
          <View style={styles.floatingInfo}>
            <View style={styles.playingIndicatorDot}>
              {audioLoading ? (
                <ActivityIndicator size="small" color="#C8A84E" />
              ) : (
                <Ionicons name="volume-medium" size={18} color="#C8A84E" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.floatingTitle} numberOfLines={1}>
                {surahMeta?.englishName || 'Surah'} • Verse {playingAyatNum} of {surahData?.totalAyat || surahMeta?.totalAyat || 7}
              </Text>
              <Text style={styles.floatingSubtitle}>
                {autoAdvance ? 'Auto-Shifting to Next Verses' : 'Single Verse Mode'}
              </Text>
            </View>
          </View>

          <View style={styles.floatingControls}>
            {/* Prev Verse */}
            <TouchableOpacity
              style={[styles.floatingBtn, playingAyatNum <= 1 && styles.floatingBtnDisabled]}
              onPress={() => {
                if (playingAyatNum > 1) {
                  void playAyatAudio(playingAyatNum - 1);
                }
              }}
              disabled={playingAyatNum <= 1}
              accessibilityLabel="Previous Verse"
            >
              <Ionicons name="play-skip-back" size={16} color={playingAyatNum <= 1 ? '#64748B' : '#FFFFFF'} />
            </TouchableOpacity>

            {/* Play/Pause/Stop */}
            <TouchableOpacity
              style={styles.floatingPlayBtn}
              onPress={stopCurrentAudio}
              accessibilityLabel="Pause Audio"
            >
              <Ionicons name="pause" size={18} color="#002E23" />
            </TouchableOpacity>

            {/* Next Verse */}
            <TouchableOpacity
              style={[
                styles.floatingBtn,
                playingAyatNum >= (surahData?.totalAyat || surahMeta?.totalAyat || 999) && styles.floatingBtnDisabled,
              ]}
              onPress={() => {
                const total = surahData?.totalAyat || surahMeta?.totalAyat || 999;
                if (playingAyatNum < total) {
                  void playAyatAudio(playingAyatNum + 1);
                }
              }}
              disabled={playingAyatNum >= (surahData?.totalAyat || surahMeta?.totalAyat || 999)}
              accessibilityLabel="Next Verse"
            >
              <Ionicons
                name="play-skip-forward"
                size={16}
                color={playingAyatNum >= (surahData?.totalAyat || surahMeta?.totalAyat || 999) ? '#64748B' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* Speed Selector Button */}
            <TouchableOpacity
              style={styles.floatingSpeedBtn}
              onPress={handleCycleSpeed}
              accessibilityLabel={`Playback speed ${playbackSpeed}x. Tap to change.`}
            >
              <Text style={styles.floatingSpeedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>

            {/* 1-Click Bookmark Active Verse */}
            {playingAyatNum !== null && (
              <TouchableOpacity
                style={[
                  styles.floatingAutoBtn,
                  bookmarkedAyats.has(playingAyatNum) && styles.floatingAutoBtnActive,
                ]}
                onPress={async () => {
                  const targetAyat = surahData?.ayats.find((a) => a.number === playingAyatNum);
                  if (targetAyat) {
                    await handleBookmarkToggle(targetAyat);
                  }
                }}
                accessibilityLabel="Bookmark currently playing verse"
              >
                <Ionicons
                  name={bookmarkedAyats.has(playingAyatNum) ? "bookmark" : "bookmark-outline"}
                  size={14}
                  color={bookmarkedAyats.has(playingAyatNum) ? '#002E23' : '#FFFFFF'}
                />
              </TouchableOpacity>
            )}

            {/* Auto Advance Toggle */}
            <TouchableOpacity
              style={[styles.floatingAutoBtn, autoAdvance && styles.floatingAutoBtnActive]}
              onPress={() => setAutoAdvance((prev) => !prev)}
              accessibilityLabel="Toggle Continuous Auto-Play"
            >
              <Ionicons name="repeat" size={14} color={autoAdvance ? '#002E23' : '#94A3B8'} />
            </TouchableOpacity>
          </View>
        </View>
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
  floatingPlayer: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: '#002E23',
    borderRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#C8A84E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 90,
  },
  floatingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  playingIndicatorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C8A84E',
  },
  floatingSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  floatingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floatingBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBtnDisabled: {
    opacity: 0.4,
  },
  floatingPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#C8A84E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingAutoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingAutoBtnActive: {
    backgroundColor: '#C8A84E',
  },
  floatingSpeedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(200, 168, 78, 0.25)',
    borderWidth: 1,
    borderColor: '#C8A84E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingSpeedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C8A84E',
  },
  resumeBanner: {
    marginHorizontal: SPACING.md,
    marginBottom: 8,
    backgroundColor: '#003D2E',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#C8A84E',
    gap: 8,
  },
  resumeInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resumeIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#C8A84E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C8A84E',
  },
  resumeSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#005F46',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#C8A84E',
    gap: 4,
  },
  resumeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resumeDismissBtn: {
    padding: 4,
  },
  quickFontControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  quickFontBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  quickFontBtnText: {
    color: '#C8A84E',
    fontSize: 13,
    fontWeight: '800',
  },
  quickFontBtnTextDisabled: {
    color: '#64748B',
  },
  quickFontSizeDisplay: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
  },
  toastWrap: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    zIndex: 99,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#003D2E',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#C8A84E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
