import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { goBackOrReplace } from '@/lib/navigation';
import {
  getAzaanRecitations,
  getAzaanPreferences,
  saveAzaanPreferences,
  playAzaan,
  pauseAzaan,
  resumeAzaan,
  stopAzaan,
  subscribeToAzaanPlayback,
  AudioPlaybackState,
} from '@/lib/azaanAudioService';
import { AzaanPreference, AzaanRecitation } from '@/types/islamic';

export default function AzaanAudioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [recitations, setRecitations] = useState<AzaanRecitation[]>([]);
  const [preferences, setPreferences] = useState<AzaanPreference | null>(null);
  const [playbackState, setPlaybackState] = useState<AudioPlaybackState>({
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    isBuffering: false,
    azaanId: null,
  });

  const [activeTab, setActiveTab] = useState<'recitations' | 'settings' | 'duas'>('recitations');

  useEffect(() => {
    const list = getAzaanRecitations();
    setRecitations(list);

    getAzaanPreferences().then(setPreferences);

    const unsubscribe = subscribeToAzaanPlayback((state) => {
      setPlaybackState(state);
    });

    return () => {
      unsubscribe();
      stopAzaan().catch(() => {});
    };
  }, []);

  const currentRecitation = recitations.find((r) => r.id === playbackState.azaanId);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleTogglePlay = async (azaanId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    if (playbackState.azaanId === azaanId) {
      if (playbackState.isPlaying) {
        await pauseAzaan();
      } else {
        await resumeAzaan();
      }
    } else {
      await playAzaan(azaanId);
    }
  };

  const handleStop = async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    await stopAzaan();
  };

  const handleSetDefault = async (azaanId: string, isFajrOnly: boolean) => {
    if (!preferences) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    const updated: AzaanPreference = {
      ...preferences,
      selectedAzaanId: isFajrOnly ? preferences.selectedAzaanId : azaanId,
      fajrAzaanId: isFajrOnly ? azaanId : preferences.fajrAzaanId,
    };
    setPreferences(updated);
    await saveAzaanPreferences(updated);
  };

  const handleUpdateNotificationSound = async (
    prayer: 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha',
    sound: 'full_azaan' | 'takbeer_only' | 'beep' | 'silent'
  ) => {
    if (!preferences) return;
    const currentPrefs = preferences.prayerNotifications || {
      fajr: 'full_azaan',
      dhuhr: 'full_azaan',
      asr: 'full_azaan',
      maghrib: 'full_azaan',
      isha: 'full_azaan',
    };
    const updated: AzaanPreference = {
      ...preferences,
      prayerNotifications: {
        ...currentPrefs,
        [prayer]: sound,
      },
    };
    setPreferences(updated);
    await saveAzaanPreferences(updated);
  };

  const handleTogglePreAzaan = async (value: boolean) => {
    if (!preferences) return;
    const updated: AzaanPreference = {
      ...preferences,
      preAzaanReminder: value,
    };
    setPreferences(updated);
    await saveAzaanPreferences(updated);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.emerald} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitleEn}>Azaan & Prayer Audio</Text>
          <Text style={styles.headerTitleUr}>صدائے اذان • مؤذن و مسنون دعائیں</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/salah-guide' as any)}
          accessibilityRole="button"
          accessibilityLabel="Salah Guide"
        >
          <Ionicons name="compass-outline" size={24} color={COLORS.gold} />
        </TouchableOpacity>
      </View>

      {/* Hero Now-Playing Studio */}
      <View style={styles.heroStudio}>
        <View style={styles.studioTop}>
          <View style={styles.liveBadge}>
            <Ionicons name="volume-high" size={14} color={COLORS.gold} />
            <Text style={styles.liveBadgeText}>
              {playbackState.isPlaying ? 'تلاوت جاری ہے • Playing' : 'اسٹوڈیو پلیئر • Azaan Studio'}
            </Text>
          </View>
          {playbackState.azaanId && (
            <TouchableOpacity
              style={styles.stopIconBtn}
              onPress={handleStop}
              accessibilityRole="button"
              accessibilityLabel="Stop audio"
            >
              <Ionicons name="stop-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.heroAzaanTitle}>
          {currentRecitation?.titleEn || 'Select a Muazzin below'}
        </Text>
        <Text style={styles.heroMuazzin}>
          {currentRecitation?.muazzin || 'Authentic Sanctuaries of Makkah, Madinah & Al-Aqsa'}
        </Text>

        {/* Dynamic Waveform Visualizer */}
        <View style={styles.waveformContainer}>
          {[40, 65, 85, 55, 95, 70, 45, 80, 100, 60, 75, 50, 90, 65, 45].map((height, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: playbackState.isPlaying ? (height * (0.5 + (i % 3) * 0.25)) : 12,
                  backgroundColor: playbackState.isPlaying ? COLORS.gold : 'rgba(200, 168, 78, 0.3)',
                },
              ]}
            />
          ))}
        </View>

        {/* Progress Timeline */}
        <View style={styles.progressRow}>
          <Text style={styles.progressTime}>{formatTime(playbackState.positionMs)}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    playbackState.durationMs > 0
                      ? Math.min(100, (playbackState.positionMs / playbackState.durationMs) * 100)
                      : 0
                  }%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressTime}>
            {formatTime(playbackState.durationMs || (currentRecitation?.durationSeconds || 0) * 100)}
          </Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'recitations' && styles.tabActive]}
          onPress={() => setActiveTab('recitations')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'recitations' }}
        >
          <Ionicons
            name="mic-outline"
            size={18}
            color={activeTab === 'recitations' ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'recitations' && styles.tabTextActive]}>
            مؤذنین (Muazzins)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'settings' }}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={activeTab === 'settings' ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            اوقات کی ترتیبات (Preferences)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'duas' && styles.tabActive]}
          onPress={() => setActiveTab('duas')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'duas' }}
        >
          <Ionicons
            name="book-outline"
            size={18}
            color={activeTab === 'duas' ? COLORS.white : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'duas' && styles.tabTextActive]}>
            مسنون دعائیں (Duas)
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Contents */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'recitations' ? (
          /* Recitations Catalog */
          <View>
            <Text style={styles.sectionHeading}>
              حرمین شریفین و مقدس مقامات کی صدائے اذان
            </Text>
            {recitations.map((rec) => {
              const isCurrentPlaying =
                playbackState.azaanId === rec.id && playbackState.isPlaying;
              const isDefaultDaily = preferences?.selectedAzaanId === rec.id;
              const isDefaultFajr = preferences?.fajrAzaanId === rec.id;

              return (
                <View key={rec.id} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <View style={styles.recInfo}>
                      <Text style={styles.recTitleEn}>{rec.titleEn}</Text>
                      <Text style={styles.recTitleUr}>{rec.titleUr}</Text>
                      <Text style={styles.recMuazzin}>
                        <Ionicons name="person-outline" size={12} color={COLORS.emerald} /> {rec.muazzin}
                      </Text>
                      <Text style={styles.recLocation}>
                        <Ionicons name="location-outline" size={12} color={COLORS.textTertiary} /> {rec.location}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.playPill, isCurrentPlaying && styles.playPillActive]}
                      onPress={() => handleTogglePlay(rec.id)}
                      accessibilityRole="button"
                      accessibilityLabel={isCurrentPlaying ? 'Pause Azaan' : 'Play Azaan'}
                    >
                      <Ionicons
                        name={isCurrentPlaying ? 'pause' : 'play'}
                        size={20}
                        color={COLORS.white}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Actions & Defaults */}
                  <View style={styles.recFooter}>
                    <View style={styles.badgeWrap}>
                      {rec.isFajr ? (
                        <View style={styles.fajrBadge}>
                          <Text style={styles.fajrBadgeText}>فجر مخصوص • Fajr Special</Text>
                        </View>
                      ) : (
                        <View style={styles.durationBadge}>
                          <Text style={styles.durationBadgeText}>
                            {Math.floor(rec.durationSeconds / 60)}:
                            {rec.durationSeconds % 60 < 10 ? '0' : ''}
                            {rec.durationSeconds % 60} min
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.recBtnRow}>
                      <TouchableOpacity
                        style={[
                          styles.setDefaultBtn,
                          (rec.isFajr ? isDefaultFajr : isDefaultDaily) && styles.setDefaultBtnActive,
                        ]}
                        onPress={() => handleSetDefault(rec.id, rec.isFajr)}
                        accessibilityRole="button"
                        accessibilityLabel="Set as default Azaan"
                      >
                        <Ionicons
                          name={
                            (rec.isFajr ? isDefaultFajr : isDefaultDaily)
                              ? 'checkmark-circle'
                              : 'radio-button-off'
                          }
                          size={16}
                          color={
                            (rec.isFajr ? isDefaultFajr : isDefaultDaily)
                              ? COLORS.emerald
                              : COLORS.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.setDefaultText,
                            (rec.isFajr ? isDefaultFajr : isDefaultDaily) && styles.setDefaultTextActive,
                          ]}
                        >
                          {(rec.isFajr ? isDefaultFajr : isDefaultDaily)
                            ? 'منتخب شدہ (Active)'
                            : rec.isFajr
                            ? 'فجر کے لیے منتخب کریں'
                            : 'روزانہ کے لیے منتخب کریں'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : activeTab === 'settings' ? (
          /* Settings View */
          <View>
            <Text style={styles.sectionHeading}>اوقاتِ نماز کے لیے صوتی نوٹیفکیشن</Text>

            {/* Pre-Azaan Reminder */}
            <View style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>نماز سے قبل یاددہانی (Pre-Azaan Reminder)</Text>
                  <Text style={styles.settingSubtitle}>
                    15 منٹ قبل ہلکا الرٹ تاکہ وضو و تیاری ہو سکے۔
                  </Text>
                </View>
                <Switch
                  value={preferences?.preAzaanReminder ?? true}
                  onValueChange={handleTogglePreAzaan}
                  trackColor={{ false: '#CBD5E1', true: COLORS.emerald }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            {/* Per-Prayer Notification Configuration */}
            {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((pr) => {
              const currentMode = preferences?.prayerNotifications?.[pr] || 'full_azaan';
              const prayerNames: Record<string, { en: string; ur: string }> = {
                fajr: { en: 'Fajr', ur: 'فجر' },
                dhuhr: { en: 'Dhuhr', ur: 'ظہر' },
                asr: { en: 'Asr', ur: 'عصر' },
                maghrib: { en: 'Maghrib', ur: 'مغرب' },
                isha: { en: 'Isha', ur: 'عشاء' },
              };

              return (
                <View key={pr} style={styles.prayerPrefCard}>
                  <View style={styles.prayerPrefHeader}>
                    <Text style={styles.prayerPrefTitleEn}>{prayerNames[pr].en}</Text>
                    <Text style={styles.prayerPrefTitleUr}>{prayerNames[pr].ur}</Text>
                  </View>

                  <View style={styles.optionsRow}>
                    {(
                      [
                        { id: 'full_azaan', label: 'مکمل اذان (Full Azaan)' },
                        { id: 'takbeer_only', label: 'صرف تکبیر (Takbeer)' },
                        { id: 'beep', label: 'بیپ چائم (Chime)' },
                        { id: 'silent', label: 'خاموش (Silent)' },
                      ] as const
                    ).map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.optionPill,
                          currentMode === opt.id && styles.optionPillActive,
                        ]}
                        onPress={() => handleUpdateNotificationSound(pr, opt.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`${prayerNames[pr].en}: ${opt.label}`}
                      >
                        <Text
                          style={[
                            styles.optionPillText,
                            currentMode === opt.id && styles.optionPillTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          /* Duas View */
          <View>
            <Text style={styles.sectionHeading}>اذان اور وضو کے بعد کی مسنون دعائیں</Text>

            {/* Dua After Azaan */}
            <View style={styles.duaCard}>
              <View style={styles.duaCardHeader}>
                <Ionicons name="sparkles" size={20} color={COLORS.gold} />
                <View style={styles.duaTitleWrap}>
                  <Text style={styles.duaMainTitle}>اذان کے بعد کی مسنون دعا</Text>
                  <Text style={styles.duaSubTitle}>Supplication after the Call to Prayer</Text>
                </View>
              </View>

              <View style={styles.arabicBox}>
                <Text style={styles.arabicText}>
                  اللَّهُمَّ رَبَّ هَٰذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ
                </Text>
              </View>

              <Text style={styles.translitText}>
                "Allahumma Rabba hadhihi-d-da'wati-t-tammah, was-salati-l-qa'imah, ati Muhammadan al-wasilata wal-fadilah, wab'ath-hu maqamam mahmudan alladhi wa'adtah."
              </Text>

              <View style={styles.transWrap}>
                <Text style={styles.transLabelUr}>اردو ترجمہ:</Text>
                <Text style={styles.transUr}>
                  اے اللہ! اس کامل پکار اور قائم رہنے والی نماز کے رب! محمد ﷺ کو وسیلہ اور فضیلت عطا فرما، اور انہیں اس مقامِ محمود پر فائز فرما جس کا تو نے ان سے وعدہ فرمایا ہے۔
                </Text>

                <Text style={styles.transLabelEn}>English Translation:</Text>
                <Text style={styles.transEn}>
                  O Allah, Lord of this perfect call and established prayer, grant Muhammad the station of intercession and excellence, and resurrect him to the praised station that You have promised him.
                </Text>
              </View>

              <View style={styles.virtueBadge}>
                <Ionicons name="star" size={14} color={COLORS.gold} />
                <Text style={styles.virtueText}>
                  رسول اللہ ﷺ نے فرمایا: جس نے اذان سن کر یہ دعا پڑھی، اس کے لیے قیامت کے دن میری شفاعت واجب ہو گئی۔ (صحیح بخاری: 614)
                </Text>
              </View>
            </View>

            {/* Dua After Wudu */}
            <View style={styles.duaCard}>
              <View style={styles.duaCardHeader}>
                <Ionicons name="water" size={20} color={COLORS.emerald} />
                <View style={styles.duaTitleWrap}>
                  <Text style={styles.duaMainTitle}>وضو کے بعد کی مسنون دعا</Text>
                  <Text style={styles.duaSubTitle}>Supplication upon completing Ablution</Text>
                </View>
              </View>

              <View style={styles.arabicBox}>
                <Text style={styles.arabicText}>
                  أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ
                </Text>
              </View>

              <Text style={styles.translitText}>
                "Ash-hadu alla ilaha illallahu wahdahu la sharika lah, wa ash-hadu anna Muhammadan 'abduhu wa rasuluh. Allahummaj'alni minat-tawwabina waj'alni minal-mutatahhirin."
              </Text>

              <View style={styles.transWrap}>
                <Text style={styles.transLabelUr}>اردو ترجمہ:</Text>
                <Text style={styles.transUr}>
                  میں گواہی دیتا ہوں کہ اللہ کے سوا کوئی معبود نہیں، وہ اکیلا ہے اس کا کوئی شریک نہیں، اور میں گواہی دیتا ہوں کہ محمد ﷺ اس کے بندے اور رسول ہیں۔ اے اللہ! مجھے خوب توبہ کرنے والوں اور پاکیزہ رہنے والوں میں بنا دے۔
                </Text>

                <Text style={styles.transLabelEn}>English Translation:</Text>
                <Text style={styles.transEn}>
                  I bear witness that there is no deity worthy of worship except Allah alone without partner, and I bear witness that Muhammad is His servant and messenger. O Allah, make me of those who constantly repent and make me of those who purify themselves.
                </Text>
              </View>

              <View style={styles.virtueBadge}>
                <Ionicons name="star" size={14} color={COLORS.gold} />
                <Text style={styles.virtueText}>
                  رسول اللہ ﷺ نے فرمایا: جو وضو کے بعد یہ دعا پڑھے، اس کے لیے جنت کے آٹھوں دروازے کھول دیے جاتے ہیں جس سے چاہے داخل ہو جائے۔ (صحیح مسلم: 234)
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FA',
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
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleEn: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F291E',
  },
  headerTitleUr: {
    fontSize: 12,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
  },
  heroStudio: {
    backgroundColor: '#0F291E',
    padding: SPACING.lg,
    borderBottomLeftRadius: RADIUS.xl,
    borderBottomRightRadius: RADIUS.xl,
    ...SHADOWS.md,
  },
  studioTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(200, 168, 78, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
  },
  stopIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAzaanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginTop: 4,
  },
  heroMuazzin: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    gap: 6,
    marginVertical: SPACING.sm,
  },
  waveformBar: {
    width: 6,
    borderRadius: 3,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  progressTime: {
    fontSize: 11,
    color: '#94A3B8',
    width: 40,
    textAlign: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF2',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: RADIUS.md,
    backgroundColor: '#F0F4F6',
    gap: 6,
  },
  tabActive: {
    backgroundColor: COLORS.emerald,
  },
  tabText: {
    fontSize: 12,
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
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: SPACING.md,
  },
  recCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  recHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  recInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  recTitleEn: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F291E',
  },
  recTitleUr: {
    fontSize: 13,
    color: COLORS.gold,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
  recMuazzin: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  recLocation: {
    fontSize: 11,
    color: COLORS.textTertiary,
  },
  playPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPillActive: {
    backgroundColor: '#DC2626',
  },
  recFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  badgeWrap: {
    flexDirection: 'row',
    gap: 6,
  },
  fajrBadge: {
    backgroundColor: '#FEF9C3',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  fajrBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#854D0E',
  },
  durationBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  durationBadgeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  recBtnRow: {
    flexDirection: 'row',
  },
  setDefaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  setDefaultBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
  },
  setDefaultText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  setDefaultTextActive: {
    color: COLORS.emerald,
  },
  settingCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTextWrap: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F291E',
  },
  settingSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  prayerPrefCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  prayerPrefHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  prayerPrefTitleEn: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F291E',
  },
  prayerPrefTitleUr: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gold,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: '#F1F5F9',
  },
  optionPillActive: {
    backgroundColor: COLORS.emerald,
  },
  optionPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  optionPillTextActive: {
    color: COLORS.white,
  },
  duaCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.sm,
  },
  duaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  duaTitleWrap: {
    flex: 1,
  },
  duaMainTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F291E',
  },
  duaSubTitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  arabicBox: {
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderRightWidth: 4,
    borderRightColor: COLORS.gold,
    marginBottom: SPACING.md,
  },
  arabicText: {
    fontSize: 20,
    lineHeight: 40,
    color: '#0F291E',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  translitText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#475569',
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  transWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  transLabelUr: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.gold,
    textAlign: 'right',
    marginBottom: 2,
  },
  transUr: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: SPACING.sm,
  },
  transLabelEn: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
    marginBottom: 2,
  },
  transEn: {
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 20,
  },
  virtueBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF9C3',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  virtueText: {
    flex: 1,
    fontSize: 12,
    color: '#854D0E',
    lineHeight: 18,
  },
});
