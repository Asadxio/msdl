import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Share, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import {
  fetchSurah, QuranAyat, SurahData,
  getAyatAudioUrl, getFullSurahUrduAudioUrl,
} from '@/lib/quranApi';
import {
  AyahTiming,
  CURATED_QARIS,
  DEFAULT_TAFSIR_EDITION_SLUG,
  QuranReciter,
  fetchAyahTimings,
  findActiveAyatFromPosition,
  getPreferredQariId,
  getPreferredTafsirEdition,
  getQariAyatAudioUrl,
  getQariFullSurahAudioUrl,
  getReciterById,
} from '@/lib/quranExtrasService';
import { TafsirBottomSheet } from '@/components/quran/TafsirBottomSheet';
import { QariPickerModal } from '@/components/quran/QariPickerModal';
import {
  isSurahAudioDownloaded,
  getPlayableSurahAudioUri,
  getSurahAudioSizeMb,
  downloadSurahAudio,
  deleteDownloadedSurahAudio,
} from '@/lib/quranAudioDownloader';
import {
  showMediaPlaybackNotification,
  dismissMediaPlaybackNotification,
} from '@/lib/mediaNotificationManager';
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

  // Multi-Qari, Ayah-Timing Sync & Tafsir State
  const [selectedQari, setSelectedQari] = useState<QuranReciter>(CURATED_QARIS[0]);
  const selectedQariRef = useRef<QuranReciter>(CURATED_QARIS[0]);
  const [showQariModal, setShowQariModal] = useState(false);
  const [ayahTimings, setAyahTimings] = useState<AyahTiming[]>([]);
  const ayahTimingsRef = useRef<AyahTiming[]>([]);
  const lastSyncedAyatRef = useRef<number | null>(null);
  const [tafsirEditionSlug, setTafsirEditionSlug] = useState<string>(DEFAULT_TAFSIR_EDITION_SLUG);
  const [tafsirTargetAyat, setTafsirTargetAyat] = useState<QuranAyat | null>(null);
  // Madrasa Hifz Loop, Self-Test & Quick Jump State
  const [hifzLoopCount, setHifzLoopCount] = useState<number>(1); // 1, 3, 5, 7, 0 (Infinity loop)
  const hifzLoopCountRef = useRef<number>(1);
  const hifzRepeatDoneRef = useRef<number>(0);
  const [hifzSelfTestMode, setHifzSelfTestMode] = useState(false);
  const [revealedTranslations, setRevealedTranslations] = useState<Set<number>>(new Set());
  const [jumpAyatInput, setJumpAyatInput] = useState('');

  useEffect(() => {
    hifzLoopCountRef.current = hifzLoopCount;
    hifzRepeatDoneRef.current = 0;
  }, [hifzLoopCount]);

  // Offline Audio Download State
  const [isAudioDownloaded, setIsAudioDownloaded] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadedSizeMb, setDownloadedSizeMb] = useState<number>(0);

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
  const activePlayRequestId = useRef(0);
  const isStoppingOrPausingRef = useRef(false);
  const hasShownNotificationForSurahRef = useRef(false);

  useEffect(() => {
    surahDataRef.current = surahData;
  }, [surahData]);

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);

  useEffect(() => {
    selectedQariRef.current = selectedQari;
  }, [selectedQari]);

  useEffect(() => {
    ayahTimingsRef.current = ayahTimings;
  }, [ayahTimings]);

  useEffect(() => {
    hifzRepeatDoneRef.current = 0;
  }, [playingAyatNum]);

  const handleCycleHifzLoop = () => {
    const cycle = [1, 3, 5, 7, 0];
    const idx = cycle.indexOf(hifzLoopCount);
    const next = cycle[(idx + 1) % cycle.length];
    setHifzLoopCount(next);
    setToastMessage(
      next === 0
        ? 'Hifz Loop: Continuous (∞)'
        : next === 1
        ? 'Hifz Repeat: Single (1x)'
        : `Hifz Repeat: ${next}x per Ayat`
    );
    setTimeout(() => setToastMessage(null), 1800);
  };

  useEffect(() => {
    getPreferredQariId().then((id) => setSelectedQari(getReciterById(id)));
    getPreferredTafsirEdition().then((slug) => setTafsirEditionSlug(slug));
  }, []);

  useEffect(() => {
    if (!selectedQari.mp3QuranReadId) {
      setAyahTimings([]);
      return;
    }
    let cancelled = false;
    fetchAyahTimings(surahNum, selectedQari.mp3QuranReadId).then((list) => {
      if (!cancelled) setAyahTimings(list);
    });
    return () => {
      cancelled = true;
    };
  }, [surahNum, selectedQari]);

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

    // Check offline audio status
    void checkOfflineAudioStatus();

    return () => {
      activePlayRequestId.current++;
      if (soundRef.current) {
        const s = soundRef.current;
        soundRef.current = null;
        try {
          s.setOnPlaybackStatusUpdate(null);
          s.stopAsync().catch(() => {});
          s.unloadAsync().catch(() => {});
        } catch (e) {}
      }
      void dismissMediaPlaybackNotification();
    };
  }, [surahNum, initialAyat]);

  const checkOfflineAudioStatus = async () => {
    try {
      const downloaded = await isSurahAudioDownloaded(surahNum);
      setIsAudioDownloaded(downloaded);
      if (downloaded) {
        const size = await getSurahAudioSizeMb(surahNum);
        setDownloadedSizeMb(size);
      }
    } catch {
      // best-effort check
    }
  };

  const handleDownloadAudio = async () => {
    if (downloadProgress !== null || !surahMeta) return;
    try {
      setDownloadProgress(1);
      const meta = await downloadSurahAudio(surahNum, surahMeta.englishName, (pct) => {
        setDownloadProgress(pct);
      });
      setIsAudioDownloaded(true);
      setDownloadedSizeMb(meta.sizeMb);
      setToastMessage(`Downloaded ${surahMeta.englishName} audio (${meta.sizeMb} MB) for offline use`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      setToastMessage(err?.message || 'Download failed');
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setDownloadProgress(null);
    }
  };

  const handleDeleteAudio = async () => {
    try {
      await deleteDownloadedSurahAudio(surahNum);
      setIsAudioDownloaded(false);
      setDownloadedSizeMb(0);
      setToastMessage('Offline audio deleted to free storage');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      // best-effort
    }
  };

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

  // Clean Unload Helper: Detaches listener FIRST to avoid triggering false didJustFinish
  const unloadActiveSound = async () => {
    isStoppingOrPausingRef.current = true;
    if (soundRef.current) {
      const s = soundRef.current;
      soundRef.current = null;
      try {
        s.setOnPlaybackStatusUpdate(null);
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      } catch (e) {
        // ignore
      }
    }
    setSound(null);
  };

  // Full Stop Audio & dismiss media notification
  const stopCurrentAudio = async () => {
    activePlayRequestId.current++;
    await unloadActiveSound();
    setIsPlayingAudio(false);
    setPlayingAyatNum(null);
    setIsFullSurahPlaying(false);
    hasShownNotificationForSurahRef.current = false;
    void dismissMediaPlaybackNotification();
    isStoppingOrPausingRef.current = false;
  };

  // Pause Audio: Keeps sound loaded, pauses audio, preserves active verse
  const pauseCurrentAudio = async () => {
    isStoppingOrPausingRef.current = true;
    if (soundRef.current) {
      try {
        await soundRef.current.pauseAsync();
      } catch (e) {
        console.warn('pauseAsync error:', e);
      }
    }
    setIsPlayingAudio(false);
    isStoppingOrPausingRef.current = false;
  };

  // Resume Audio: Continues playing loaded verse without reloading
  const resumeCurrentAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.playAsync();
        setIsPlayingAudio(true);
        return;
      } catch (e) {
        console.warn('resumeAsync error:', e);
      }
    }
    if (playingAyatNum !== null) {
      void playAyatAudio(playingAyatNum);
    } else if (isFullSurahPlaying) {
      void playFullSurahAudio();
    }
  };

  // 1-Tap Toggle Play/Pause
  const togglePlayPause = async () => {
    if (isPlayingAudio) {
      await pauseCurrentAudio();
    } else {
      await resumeCurrentAudio();
    }
  };

  const playAyatAudio = async (ayatNum: number) => {
    const thisRequestId = ++activePlayRequestId.current;

    try {
      setAudioLoading(true);

      // If user tapped the currently active verse, toggle between pause and play
      if (soundRef.current && playingAyatNum === ayatNum) {
        if (isPlayingAudio) {
          await pauseCurrentAudio();
          setAudioLoading(false);
          return;
        } else {
          await resumeCurrentAudio();
          setAudioLoading(false);
          return;
        }
      }

      // Concurrency protection: safely unload previous audio with listener detached
      await unloadActiveSound();

      if (activePlayRequestId.current !== thisRequestId) {
        return; // A newer request has already started
      }

      // Immediately highlight and smooth-shift viewport to this verse
      setPlayingAyatNum(ayatNum);
      setIsPlayingAudio(true);
      setIsFullSurahPlaying(false);
      scrollToAyat(ayatNum);

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const qari = selectedQariRef.current;
      const audioUrl = getQariAyatAudioUrl(qari, surahNum, ayatNum);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      // If a newer request arrived while loading, cancel this instance immediately
      if (activePlayRequestId.current !== thisRequestId) {
        newSound.setOnPlaybackStatusUpdate(null);
        await newSound.stopAsync().catch(() => {});
        await newSound.unloadAsync().catch(() => {});
        return;
      }

      await newSound.setRateAsync(playbackSpeedRef.current, true).catch(() => {});

      soundRef.current = newSound;
      setSound(newSound);

      // Single Notification Policy: Show ONCE per Surah session, never beep on every verse!
      if (!hasShownNotificationForSurahRef.current) {
        hasShownNotificationForSurahRef.current = true;
        void showMediaPlaybackNotification({
          title: `Surah ${surahMeta?.englishName || 'Surah ' + surahNum}`,
          subtitle: `Recitation: ${qari.nameEn}`,
          isPlaying: true,
          playbackRate: playbackSpeedRef.current,
          surahNumber: surahNum,
          ayatNumber: ayatNum,
        });
      }

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        // Discard callbacks from aborted or in-flight cancelled tracks
        if (activePlayRequestId.current !== thisRequestId || isStoppingOrPausingRef.current) {
          return;
        }

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
          const targetRepeats = hifzLoopCountRef.current;
          if (targetRepeats === 0 || hifzRepeatDoneRef.current + 1 < targetRepeats) {
            hifzRepeatDoneRef.current += 1;
            void newSound.replayAsync().catch(() => {});
            return;
          }
          hifzRepeatDoneRef.current = 0;
          const currentData = surahDataRef.current;
          const total = currentData?.totalAyat || surahMeta?.totalAyat || 0;
          if (autoAdvanceRef.current && ayatNum < total) {
            // Automatically advance to the next verse safely without overlapping audio
            void playAyatAudio(ayatNum + 1);
          } else {
            setIsPlayingAudio(false);
            setPlayingAyatNum(null);
            hasShownNotificationForSurahRef.current = false;
            void dismissMediaPlaybackNotification();
          }
        }
      });
    } catch (error) {
      console.warn('Audio play error:', error);
      setIsPlayingAudio(false);
      setPlayingAyatNum(null);
      hasShownNotificationForSurahRef.current = false;
      void dismissMediaPlaybackNotification();
    } finally {
      if (activePlayRequestId.current === thisRequestId) {
        setAudioLoading(false);
      }
    }
  };

  const playFullSurahAudio = async () => {
    const thisRequestId = ++activePlayRequestId.current;
    try {
      setAudioLoading(true);
      if (soundRef.current && isFullSurahPlaying) {
        if (isPlayingAudio) {
          await pauseCurrentAudio();
          setAudioLoading(false);
          return;
        } else {
          await resumeCurrentAudio();
          setAudioLoading(false);
          return;
        }
      }
      await unloadActiveSound();
      if (activePlayRequestId.current !== thisRequestId) return;

      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const qari = selectedQariRef.current;
      let streamUri: string | null = null;
      let usingUrduTranslation = false;

      if (!qari.isUrduTranslationMode) {
        streamUri = getQariFullSurahAudioUrl(qari, surahNum);
      }
      if (!streamUri) {
        const playable = await getPlayableSurahAudioUri(surahNum);
        streamUri = playable.uri;
        usingUrduTranslation = true;
      }

      if (qari.mp3QuranReadId && ayahTimingsRef.current.length === 0) {
        const loadedTimings = await fetchAyahTimings(surahNum, qari.mp3QuranReadId);
        if (loadedTimings.length > 0) {
          setAyahTimings(loadedTimings);
          ayahTimingsRef.current = loadedTimings;
        }
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: streamUri },
        { shouldPlay: true }
      );
      if (activePlayRequestId.current !== thisRequestId) {
        newSound.setOnPlaybackStatusUpdate(null);
        await newSound.stopAsync().catch(() => {});
        await newSound.unloadAsync().catch(() => {});
        return;
      }
      await newSound.setRateAsync(playbackSpeedRef.current, true).catch(() => {});

      soundRef.current = newSound;
      setSound(newSound);
      setIsPlayingAudio(true);
      setIsFullSurahPlaying(true);
      lastSyncedAyatRef.current = null;
      setPlayingAyatNum(ayahTimingsRef.current.length > 0 ? 1 : null);

      // Display Lock-Screen & Notification shade controls for full surah
      void showMediaPlaybackNotification({
        title: `Surah ${surahMeta?.englishName || surahNum} (Full Audio)`,
        subtitle: usingUrduTranslation ? 'Arabic Recitation with Urdu Translation' : `Recitation: ${qari.nameEn}`,
        isPlaying: true,
        playbackRate: playbackSpeedRef.current,
        surahNumber: surahNum,
      });

      newSound.setOnPlaybackStatusUpdate((playbackStatus) => {
        if (activePlayRequestId.current !== thisRequestId || isStoppingOrPausingRef.current) {
          return;
        }
        if (!playbackStatus.isLoaded) return;
        const posMs = playbackStatus.positionMillis || 0;
        if (ayahTimingsRef.current.length > 0) {
          const syncedAyat = findActiveAyatFromPosition(ayahTimingsRef.current, posMs);
          if (syncedAyat && syncedAyat !== lastSyncedAyatRef.current) {
            lastSyncedAyatRef.current = syncedAyat;
            setPlayingAyatNum(syncedAyat);
            scrollToAyat(syncedAyat);
          }
        }
        if (posMs > 2000) {
          void saveQuranAudioPlayback({
            surahNumber: surahNum,
            ayatNumber: lastSyncedAyatRef.current || 1,
            positionMillis: posMs,
            durationMillis: playbackStatus.durationMillis || 0,
            playbackRate: playbackSpeedRef.current,
            timestamp: Date.now(),
          });
        }
        if (playbackStatus.didJustFinish) {
          setIsPlayingAudio(false);
          setIsFullSurahPlaying(false);
          setPlayingAyatNum(null);
          lastSyncedAyatRef.current = null;
          void dismissMediaPlaybackNotification();
        }
      });
    } catch (error) {
      console.warn('Full surah audio error:', error);
      void dismissMediaPlaybackNotification();
    } finally {
      if (activePlayRequestId.current === thisRequestId) {
        setAudioLoading(false);
      }
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
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            stopCurrentAudio().catch(() => {});
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/quran');
            }
          }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerArabic}>{surahMeta?.arabicName || ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Text style={styles.headerEn}>{surahMeta?.englishName} ({surahNum})</Text>
            {(isAudioDownloaded || isOffline) && (
              <View style={styles.isOfflineBadge}>
                <Ionicons name="cloud-done" size={10} color="#6EE7B7" />
                <Text style={styles.isOfflineBadgeText}>Offline Ready • آف لائن دستیاب</Text>
              </View>
            )}
          </View>
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

        {/* 1-Tap Offline Audio Download Manager Button */}
        <TouchableOpacity
          style={[
            styles.downloadPillBtn,
            isAudioDownloaded && styles.downloadPillBtnDownloaded,
            downloadProgress !== null && styles.downloadPillBtnDownloading,
          ]}
          onPress={isAudioDownloaded ? handleDeleteAudio : handleDownloadAudio}
          activeOpacity={0.8}
          accessibilityLabel={isAudioDownloaded ? `Offline ready ${downloadedSizeMb}MB. Tap to delete.` : 'Download audio for offline listening'}
        >
          {downloadProgress !== null ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ActivityIndicator size="small" color="#C8A84E" />
              <Text style={styles.downloadPillText}>{downloadProgress}%</Text>
            </View>
          ) : isAudioDownloaded ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="cloud-done" size={13} color="#059669" />
              <Text style={[styles.downloadPillText, { color: '#059669' }]}>{downloadedSizeMb}MB</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="arrow-down-circle-outline" size={14} color="#C8A84E" />
              <Text style={styles.downloadPillText}>Offline</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigateSurah(1)} disabled={surahNum >= 114}>
          <Ionicons name="chevron-forward" size={18} color={surahNum < 114 ? '#C8A84E' : '#334155'} />
        </TouchableOpacity>
      </View>

      {/* Multi-Qari & Live Radio Control Bar */}
      <View style={styles.qariStrip}>
        <TouchableOpacity
          style={styles.qariStripBtn}
          onPress={() => setShowQariModal(true)}
          accessibilityRole="button"
          accessibilityLabel={`Current reciter ${selectedQari.nameEn}. Tap to switch Qari`}
        >
          <Ionicons name="mic-outline" size={14} color="#C8A84E" />
          <Text style={styles.qariStripText} numberOfLines={1}>
            Qari: {selectedQari.nameEn}
          </Text>
          {ayahTimings.length > 0 && !selectedQari.isUrduTranslationMode && (
            <View style={styles.syncChip}>
              <Text style={styles.syncChipText}>SYNC</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={13} color="#C8A84E" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.radioShortcutBtn}
          onPress={() => {
            void stopCurrentAudio();
            router.push('/islamic-radio' as any);
          }}
          accessibilityRole="button"
          accessibilityLabel="Open 24/7 Islamic Radio"
        >
          <Ionicons name="radio-outline" size={14} color="#6EE7B7" />
          <Text style={styles.radioShortcutText}>Live Radio</Text>
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
          <Ionicons name="cloud-offline-outline" size={54} color="#EF4444" />
          <Text style={styles.errorText}>Unable to load Surah</Text>
          <Text style={[styles.loadingText, { marginTop: 4, marginBottom: 16, fontSize: 13, color: '#94A3B8' }]}>
            Please check internet connection & tap Try Again
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadSurah} activeOpacity={0.8}>
            <Ionicons name="reload" size={16} color="#002E23" style={{ marginRight: 6 }} />
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
                    {/* Tafsir Button */}
                    <TouchableOpacity
                      onPress={() => setTafsirTargetAyat(ayat)}
                      style={styles.tafsirPillBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Read Tafsir for verse ${ayat.number}`}
                    >
                      <Ionicons name="book-outline" size={13} color="#005F46" />
                      <Text style={styles.tafsirPillText}>Tafsir</Text>
                    </TouchableOpacity>

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

                {hifzSelfTestMode && !revealedTranslations.has(ayat.number) ? (
                  <TouchableOpacity
                    style={[styles.romanContainer, { alignItems: 'center', borderLeftColor: '#C8A84E' }]}
                    onPress={() =>
                      setRevealedTranslations((prev) => new Set([...prev, ayat.number]))
                    }
                  >
                    <Text style={[styles.romanText, { fontWeight: '700', color: '#005F46' }]}>
                      Hifz Self-Test Mode • Tap to Peek Translation
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <>
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
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Floating Bottom Audio Player Bar with Auto-Shift, Hifz Loop & Verse Navigation */}
      {playingAyatNum !== null && (
        <View style={[styles.floatingPlayer, { bottom: insets.bottom + 12 }]}>
          <View style={styles.floatingInfo}>
            <View style={styles.playingIndicatorDot}>
              {audioLoading ? (
                <ActivityIndicator size="small" color="#C8A84E" />
              ) : (
                <Ionicons
                  name={isPlayingAudio ? "volume-medium" : "pause-circle"}
                  size={18}
                  color="#C8A84E"
                />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.floatingTitle} numberOfLines={1}>
                {surahMeta?.englishName || 'Surah'} • Verse {playingAyatNum} of {surahData?.totalAyat || surahMeta?.totalAyat || 7}
              </Text>
              <Text style={styles.floatingSubtitle}>
                {!isPlayingAudio
                  ? 'Paused • Tap to resume'
                  : hifzLoopCount !== 1
                  ? `Hifz Loop (${hifzLoopCount === 0 ? '∞' : hifzLoopCount + 'x'})`
                  : autoAdvance
                  ? 'Auto-Shifting to Next Verses'
                  : 'Single Verse Mode'}
              </Text>
            </View>
          </View>

          <View style={styles.floatingControls}>
            {/* Prev Verse */}
            <TouchableOpacity
              style={[styles.floatingBtn, (playingAyatNum || 1) <= 1 && styles.floatingBtnDisabled]}
              onPress={() => {
                const cur = playingAyatNum || 1;
                if (cur > 1) {
                  const targetTiming = isFullSurahPlaying
                    ? ayahTimingsRef.current.find((t) => t.ayah === cur - 1)
                    : undefined;
                  if (targetTiming && soundRef.current) {
                    void soundRef.current.setPositionAsync(targetTiming.startTimeMs);
                    setPlayingAyatNum(cur - 1);
                    scrollToAyat(cur - 1);
                  } else {
                    void playAyatAudio(cur - 1);
                  }
                }
              }}
              disabled={(playingAyatNum || 1) <= 1}
              accessibilityLabel="Previous Verse"
            >
              <Ionicons name="play-skip-back" size={16} color={(playingAyatNum || 1) <= 1 ? '#64748B' : '#FFFFFF'} />
            </TouchableOpacity>

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.floatingPlayBtn}
              onPress={togglePlayPause}
              accessibilityLabel={isPlayingAudio ? "Pause Audio" : "Play Audio"}
            >
              <Ionicons name={isPlayingAudio ? "pause" : "play"} size={18} color="#002E23" />
            </TouchableOpacity>

            {/* Next Verse */}
            <TouchableOpacity
              style={[
                styles.floatingBtn,
                (playingAyatNum || 1) >= (surahData?.totalAyat || surahMeta?.totalAyat || 999) && styles.floatingBtnDisabled,
              ]}
              onPress={() => {
                const cur = playingAyatNum || 1;
                const total = surahData?.totalAyat || surahMeta?.totalAyat || 999;
                if (cur < total) {
                  const targetTiming = isFullSurahPlaying
                    ? ayahTimingsRef.current.find((t) => t.ayah === cur + 1)
                    : undefined;
                  if (targetTiming && soundRef.current) {
                    void soundRef.current.setPositionAsync(targetTiming.startTimeMs);
                    setPlayingAyatNum(cur + 1);
                    scrollToAyat(cur + 1);
                  } else {
                    void playAyatAudio(cur + 1);
                  }
                }
              }}
              disabled={(playingAyatNum || 1) >= (surahData?.totalAyat || surahMeta?.totalAyat || 999)}
              accessibilityLabel="Next Verse"
            >
              <Ionicons
                name="play-skip-forward"
                size={16}
                color={(playingAyatNum || 1) >= (surahData?.totalAyat || surahMeta?.totalAyat || 999) ? '#64748B' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* Hifz Loop Repeat Button (1x / 3x / 5x / 7x / Infinity) */}
            <TouchableOpacity
              style={[
                styles.floatingSpeedBtn,
                hifzLoopCount !== 1 && { backgroundColor: '#C8A84E' },
              ]}
              onPress={handleCycleHifzLoop}
              accessibilityLabel={`Hifz verse repeat ${hifzLoopCount === 0 ? 'infinite' : hifzLoopCount + 'x'}`}
            >
              <Text
                style={[
                  styles.floatingSpeedText,
                  hifzLoopCount !== 1 && { color: '#002E23' },
                ]}
              >
                {hifzLoopCount === 0 ? '∞' : `${hifzLoopCount}x↺`}
              </Text>
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

            {/* Dismiss Player Button */}
            <TouchableOpacity
              style={styles.floatingAutoBtn}
              onPress={stopCurrentAudio}
              accessibilityLabel="Dismiss Player"
            >
              <Ionicons name="close" size={15} color="#94A3B8" />
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
            <Text style={styles.settingsTitle}>Reader ترتیب & Madrasa Hifz Tools</Text>
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
              <Text style={styles.settingsLabel}>Hifz Self-Test (Hide Translations)</Text>
              <TouchableOpacity
                style={[styles.toggle, hifzSelfTestMode && styles.toggleOn]}
                onPress={() => {
                  setRevealedTranslations(new Set());
                  setHifzSelfTestMode((v) => !v);
                }}
              >
                <View style={[styles.toggleThumb, hifzSelfTestMode && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Verse Repeat (Hifz Loop)</Text>
            </View>
            <View style={styles.fontSizeRow}>
              {[1, 3, 5, 7, 0].map((cnt) => (
                <TouchableOpacity
                  key={cnt}
                  style={[styles.fontBtn, hifzLoopCount === cnt && styles.fontBtnActive]}
                  onPress={() => setHifzLoopCount(cnt)}
                >
                  <Text style={[styles.fontBtnText, hifzLoopCount === cnt && { color: '#FFFFFF' }]}>
                    {cnt === 0 ? 'Infinite ∞' : cnt === 1 ? 'Off (1x)' : `${cnt}x`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>Jump to Ayat (1–{surahData?.totalAyat || surahMeta?.totalAyat || 1})</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                    borderRadius: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    minWidth: 64,
                    textAlign: 'center',
                    color: '#0F172A',
                  }}
                  keyboardType="number-pad"
                  placeholder="#"
                  value={jumpAyatInput}
                  onChangeText={setJumpAyatInput}
                />
                <TouchableOpacity
                  style={[styles.fontBtn, styles.fontBtnActive]}
                  onPress={() => {
                    const target = parseInt(jumpAyatInput.trim(), 10);
                    const maxAyat = surahData?.totalAyat || surahMeta?.totalAyat || 286;
                    if (target >= 1 && target <= maxAyat) {
                      scrollToAyat(target);
                      setShowSettings(false);
                      setJumpAyatInput('');
                    }
                  }}
                >
                  <Text style={[styles.fontBtnText, { color: '#FFFFFF' }]}>Go</Text>
                </TouchableOpacity>
              </View>
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

      {/* Tafsir Bottom Sheet Modal */}
      <TafsirBottomSheet
        visible={tafsirTargetAyat !== null}
        onClose={() => setTafsirTargetAyat(null)}
        surahNumber={surahNum}
        surahName={surahMeta?.englishName || `Surah ${surahNum}`}
        ayatNumber={tafsirTargetAyat?.number || 1}
        arabicText={tafsirTargetAyat?.arabic || ''}
        editionSlug={tafsirEditionSlug}
        onChangeEdition={setTafsirEditionSlug}
      />

      {/* Qari Switcher Modal */}
      <QariPickerModal
        visible={showQariModal}
        onClose={() => setShowQariModal(false)}
        selectedQariId={selectedQari.id}
        onSelectQari={(qari) => {
          void stopCurrentAudio();
          setSelectedQari(qari);
          setToastMessage(`Reciter: ${qari.nameEn}`);
          setTimeout(() => setToastMessage(null), 2000);
        }}
      />
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
  downloadPillBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(200,168,78,0.4)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.full, gap: 4 },
  downloadPillBtnDownloaded: { backgroundColor: 'rgba(5, 150, 105, 0.15)', borderColor: '#059669' },
  downloadPillBtnDownloading: { backgroundColor: 'rgba(200, 168, 78, 0.15)', borderColor: '#C8A84E' },
  downloadPillText: { fontSize: 11, fontWeight: '700', color: '#C8A84E' },
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
  isOfflineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: RADIUS.full,
    borderWidth: 0.5,
    borderColor: '#6EE7B7',
  },
  isOfflineBadgeText: {
    color: '#A7F3D0',
    fontSize: 9.5,
    fontWeight: '700',
  },
  qariStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 8,
    gap: 8,
  },
  qariStripBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(200,168,78,0.35)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qariStripText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  syncChip: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  syncChipText: {
    color: '#6EE7B7',
    fontSize: 9,
    fontWeight: '900',
  },
  radioShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.4)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  radioShortcutText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '800',
  },
  tafsirPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E8F5EE',
  },
  tafsirPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#005F46',
  },
});
