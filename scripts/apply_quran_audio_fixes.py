# -*- coding: utf-8 -*-
import os

reader_path = r'C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\app\quran-reader.tsx'
with open(reader_path, 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('\r\n', '\n')

# 1. Add refs for concurrency, pause state, and single-notification tracking
old_refs = """  const scrollRef = useRef<ScrollView>(null);
  const scrolledToInitial = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const surahDataRef = useRef<SurahData | null>(null);"""

new_refs = """  const scrollRef = useRef<ScrollView>(null);
  const scrolledToInitial = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const surahDataRef = useRef<SurahData | null>(null);
  const activePlayRequestId = useRef(0);
  const isStoppingOrPausingRef = useRef(false);
  const hasShownNotificationForSurahRef = useRef(false);"""

if old_refs in code:
    code = code.replace(old_refs, new_refs)
    print("1. Audio concurrency refs added.")
else:
    print("1. Audio refs not found!")

# 2. Replace stopCurrentAudio and playAyatAudio with concurrency-safe, non-overlapping implementations
old_audio_handlers = """  // Audio Playback Handlers
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
    void dismissMediaPlaybackNotification();
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

      // Display Lock-Screen & Status Bar Media Controls
      void showMediaPlaybackNotification({
        title: `${surahMeta?.englishName || 'Surah ' + surahNum} (Ayat ${ayatNum})`,
        subtitle: `Mishary Rashid Alafasy • Verse ${ayatNum} of ${surahDataRef.current?.totalAyat || surahMeta?.totalAyat || ''}`,
        isPlaying: true,
        playbackRate: playbackSpeedRef.current,
        surahNumber: surahNum,
        ayatNumber: ayatNum,
      });

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
            void dismissMediaPlaybackNotification();
          }
        }
      });
    } catch (error) {
      console.warn('Audio play error:', error);
      setIsPlayingAudio(false);
      setPlayingAyatNum(null);
      void dismissMediaPlaybackNotification();
    } finally {
      setAudioLoading(false);
    }
  };"""

new_audio_handlers = """  // Clean Unload Helper: Detaches listener FIRST to avoid triggering false didJustFinish
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

      const audioUrl = getAyatAudioUrl(surahNum, ayatNum);
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
          subtitle: `Recitation: Mishary Rashid Alafasy`,
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
  };"""

if old_audio_handlers in code:
    code = code.replace(old_audio_handlers, new_audio_handlers)
    print("2. Concurrency-safe audio handlers installed.")
else:
    print("2. old_audio_handlers not found!")

# 3. Update playFullSurahAudio to also unload cleanly
old_full_surah = """  const playFullSurahAudio = async () => {
    try {
      setAudioLoading(true);
      if (soundRef.current && isFullSurahPlaying) {
        await stopCurrentAudio();
        setAudioLoading(false);
        return;
      }
      await stopCurrentAudio();"""

new_full_surah = """  const playFullSurahAudio = async () => {
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
      if (activePlayRequestId.current !== thisRequestId) return;"""

if old_full_surah in code:
    code = code.replace(old_full_surah, new_full_surah)
    print("3. playFullSurahAudio updated.")
else:
    print("3. old_full_surah not found!")

# 4. Update Floating Player to stay visible when paused, toggle play/pause, and have close button
old_floating_player = """      {/* Floating Bottom Audio Player Bar with Auto-Shift & Verse Navigation */}
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
            </TouchableOpacity>"""

new_floating_player = """      {/* Floating Bottom Audio Player Bar with Auto-Shift & Verse Navigation */}
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
                {!isPlayingAudio ? 'Paused • Tap to resume' : autoAdvance ? 'Auto-Shifting to Next Verses' : 'Single Verse Mode'}
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

            {/* Play/Pause Button */}
            <TouchableOpacity
              style={styles.floatingPlayBtn}
              onPress={togglePlayPause}
              accessibilityLabel={isPlayingAudio ? "Pause Audio" : "Play Audio"}
            >
              <Ionicons name={isPlayingAudio ? "pause" : "play"} size={18} color="#002E23" />
            </TouchableOpacity>"""

if old_floating_player in code:
    code = code.replace(old_floating_player, new_floating_player)
    print("4. Floating player updated with Play/Pause and visibility.")
else:
    print("4. old_floating_player not found!")

# Add close button to floating controls
old_floating_end = """            {/* Auto Advance Toggle */}
            <TouchableOpacity
              style={[styles.floatingAutoBtn, autoAdvance && styles.floatingAutoBtnActive]}
              onPress={() => setAutoAdvance((prev) => !prev)}
              accessibilityLabel="Toggle Continuous Auto-Play"
            >
              <Ionicons name="repeat" size={14} color={autoAdvance ? '#002E23' : '#94A3B8'} />
            </TouchableOpacity>
          </View>
        </View>"""

new_floating_end = """            {/* Auto Advance Toggle */}
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
        </View>"""

if old_floating_end in code:
    code = code.replace(old_floating_end, new_floating_end)
    print("5. Dismiss button added to floating player.")
else:
    print("5. old_floating_end not found!")

with open(reader_path, 'w', encoding='utf-8') as f:
    f.write(code)

print("Saved quran-reader.tsx successfully!")
