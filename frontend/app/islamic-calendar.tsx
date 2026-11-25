import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScalePressable } from '@/components/ui';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import {
  getEventsForHijriYear,
  getHijriDateParts,
  getUpcomingIslamicEvents,
  type IslamicCalendarEvent,
} from '@/lib/islamicCalendarService';
import { goBackOrReplace } from '@/lib/navigation';

const HIJRI_MONTH_NORMALIZATION: Record<string, string> = {
  "Dhuʻl-Qiʻdah": 'Zul Qidah',
  'Dhu’l-Qi’dah': 'Zul Qidah',
  "Dhuʻl-Hijjah": 'Zul Hijjah',
  'Dhu’l-Hijjah': 'Zul Hijjah',
  'Dhu al-Hijjah': 'Zul Hijjah',
  'Rabiʻ I': 'Rabi al-Awwal',
  'Rabi’ I': 'Rabi al-Awwal',
  'Rabiʻ II': 'Rabi al-Thani',
  'Rabi’ II': 'Rabi al-Thani',
};

function normalizeHijriString(raw: string): string {
  return Object.entries(HIJRI_MONTH_NORMALIZATION).reduce(
    (value, [from, to]) => value.replace(from, to),
    raw
  );
}

export default function IslamicCalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const now = useMemo(() => new Date(), []);
  const todayHijri = useMemo(() => getHijriDateParts(now), [now]);
  const todayEnglish = useMemo(
    () =>
      now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [now]
  );
  const normalizedTodayHijri = useMemo(
    () => normalizeHijriString(todayHijri.formattedWithAH),
    [todayHijri.formattedWithAH]
  );

  // Coming up events starting from today (next ~12 months rolling horizon)
  const upcomingEvents = useMemo(() => getUpcomingIslamicEvents(now, 370), [now]);
  const featuredEvent = upcomingEvents[0] ?? null;
  const remainingUpcoming = useMemo(() => upcomingEvents.slice(1), [upcomingEvents]);

  // Browse full Hijri year (defaults to next Hijri year just below Coming up)
  const [selectedHijriYear, setSelectedHijriYear] = useState<number>(todayHijri.year + 1);
  const yearEvents = useMemo(
    () => getEventsForHijriYear(selectedHijriYear, now),
    [selectedHijriYear, now]
  );

  // Detail modal state
  const [selectedEvent, setSelectedEvent] = useState<IslamicCalendarEvent | null>(null);
  const [showTodayModal, setShowTodayModal] = useState(false);

  const handleOpenEvent = (event: IslamicCalendarEvent) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedEvent(event);
  };

  const handleChangeYear = (delta: number) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync().catch(() => {});
    }
    setSelectedHijriYear((prev) => Math.max(todayHijri.year - 2, Math.min(todayHijri.year + 10, prev + delta)));
  };

  const handleShareEvent = async (event: IslamicCalendarEvent) => {
    try {
      await Share.share({
        message: `${event.title} (${event.arabicTitle})\nHijri Date: ${event.hijriFullLabel}\nApproximate Gregorian Date: ${event.gregorianLong}\n\n${event.significance}\n\n— Shared via SUFFAH Islamic Calendar`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  // Surface colors tuned for clean visual harmony in both Light and Dark modes
  const screenBg = isDark ? colors.background : '#F6F7F6';
  const cardBg = isDark ? colors.surface : '#FFFFFF';
  const cardBorder = isDark ? colors.border : 'rgba(15, 23, 42, 0.05)';
  const pillBg = isDark ? 'rgba(16, 185, 129, 0.14)' : '#E8F5EE';
  const pillDayColor = isDark ? '#34D399' : '#056049';
  const pillMonthColor = isDark ? '#6EE7B7' : '#0A7D65';
  const heroBg = isDark ? '#064E3B' : '#045E44';

  const renderEventRow = (item: IslamicCalendarEvent, keyPrefix: string) => (
    <ScalePressable
      key={`${keyPrefix}-${item.id}-${item.hijriYear}`}
      style={[
        styles.eventCard,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
      onPress={() => handleOpenEvent(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.hijriDateLabel}, ${item.gregorianShort}`}
    >
      <View style={[styles.datePill, { backgroundColor: pillBg }]}>
        <Text style={[styles.datePillDay, { color: pillDayColor }]}>{item.hijriDay}</Text>
        <Text style={[styles.datePillMonth, { color: pillMonthColor }]} numberOfLines={1}>
          {item.hijriMonthAbbr}
        </Text>
      </View>

      <View style={styles.eventTextCol}>
        <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.eventSubtitle, { color: colors.textSecondary }]}>
          {item.hijriDateLabel} {'\u2022'} {item.gregorianShort}
        </Text>
      </View>
    </ScalePressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]} testID="islamic-calendar-screen">
      {/* Sticky Top Header */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + SPACING.xs,
            backgroundColor: screenBg,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Islamic Calendar
        </Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            setShowTodayModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="View today's Hijri and Gregorian date"
        >
          <Ionicons name="today-outline" size={20} color={isDark ? '#34D399' : '#045E44'} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact Today Date Strip */}
        <TouchableOpacity
          style={[
            styles.todayStrip,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
          onPress={() => setShowTodayModal(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Today is ${normalizedTodayHijri}, ${todayEnglish}`}
        >
          <View style={[styles.todayDotWrap, { backgroundColor: pillBg }]}>
            <Ionicons name="moon" size={14} color={pillDayColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.todayHijriText, { color: colors.text }]}>
              {normalizedTodayHijri}
            </Text>
            <Text style={[styles.todayGregText, { color: colors.textSecondary }]}>
              {todayEnglish} {'\u2022'} Umm al-Qura
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Section 1: Coming up */}
        <Text style={[styles.sectionHeader, { color: colors.text }]}>Coming up</Text>

        {/* Featured Emerald Hero Card for the immediate next Islamic Event */}
        {featuredEvent && (
          <ScalePressable
            style={[styles.heroCard, { backgroundColor: heroBg }]}
            onPress={() => handleOpenEvent(featuredEvent)}
            accessibilityRole="button"
            accessibilityLabel={`Coming up next: ${featuredEvent.title}, ${featuredEvent.countdownLabel}, ${featuredEvent.gregorianLong}`}
          >
            <View style={styles.heroBadge}>
              <Ionicons name="time-outline" size={12} color="#D1FAE5" />
              <Text style={styles.heroBadgeText}>{featuredEvent.countdownLabel}</Text>
            </View>

            <Text style={styles.heroTitle}>{featuredEvent.title}</Text>
            <Text style={styles.heroDesc}>{featuredEvent.description}</Text>

            <View style={styles.heroFooter}>
              <Ionicons name="calendar-outline" size={15} color="rgba(255,255,255,0.88)" />
              <Text style={styles.heroDateText}>{featuredEvent.gregorianLong}</Text>
            </View>
          </ScalePressable>
        )}

        {/* Upcoming Events List */}
        <View style={styles.eventsList}>
          {remainingUpcoming.map((ev) => renderEventRow(ev, 'upcoming'))}
        </View>

        {/* Section 2: Full Hijri Year Timeline with Prev / Next Year Stepper */}
        <View style={styles.yearSectionHeaderRow}>
          <Text style={[styles.yearSectionTitle, { color: colors.text }]}>
            {selectedHijriYear} AH
          </Text>

          <View style={styles.yearStepperRow}>
            <TouchableOpacity
              style={[
                styles.yearStepBtn,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => handleChangeYear(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous Hijri year"
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.yearStepBtn,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
              onPress={() => handleChangeYear(1)}
              accessibilityRole="button"
              accessibilityLabel="Next Hijri year"
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.eventsList}>
          {yearEvents.map((ev) => renderEventRow(ev, `yr-${selectedHijriYear}`))}
        </View>

        {/* Bottom Moon-Sighting Disclaimer Footer */}
        <View style={styles.disclaimerRow}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={colors.textMuted}
            style={{ marginTop: 1 }}
          />
          <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
            These dates are approximate. Islamic months depend on moon sighting, so dates may
            differ by one or two days in your country.
          </Text>
        </View>
      </ScrollView>

      {/* Event Details Modal */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedEvent(null)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, SPACING.lg),
              },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {selectedEvent && (
              <>
                <View style={styles.modalHeaderRow}>
                  <View style={[styles.modalDateChip, { backgroundColor: pillBg }]}>
                    <Text style={[styles.modalDateChipText, { color: pillDayColor }]}>
                      {selectedEvent.hijriFullLabel}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setSelectedEvent(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Close event details"
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalArabicTitle, { color: colors.secondary }]}>
                  {selectedEvent.arabicTitle}
                </Text>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {selectedEvent.title}
                </Text>
                <Text style={[styles.modalUrduTitle, { color: colors.textSecondary }]}>
                  {selectedEvent.urduTitle}
                </Text>

                <View
                  style={[
                    styles.modalInfoBox,
                    { backgroundColor: isDark ? colors.surfaceAlt : '#F7F8F7' },
                  ]}
                >
                  <View style={styles.modalInfoLine}>
                    <Ionicons name="calendar-outline" size={16} color={pillDayColor} />
                    <Text style={[styles.modalInfoText, { color: colors.text }]}>
                      {selectedEvent.gregorianLong}
                    </Text>
                  </View>
                  <View style={styles.modalInfoLine}>
                    <Ionicons name="time-outline" size={16} color={pillDayColor} />
                    <Text style={[styles.modalInfoText, { color: colors.textSecondary }]}>
                      {selectedEvent.countdownLabel}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.modalSubheading, { color: colors.text }]}>
                  Significance &amp; Virtues
                </Text>
                <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                  {selectedEvent.significance}
                </Text>

                <TouchableOpacity
                  style={[styles.shareBtn, { backgroundColor: heroBg }]}
                  onPress={() => handleShareEvent(selectedEvent)}
                  accessibilityRole="button"
                  accessibilityLabel="Share this Islamic date"
                >
                  <Ionicons name="share-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.shareBtnText}>Share Date &amp; Reminder</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Today's Date Details Modal */}
      <Modal
        visible={showTodayModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTodayModal(false)}
      >
        <Pressable style={styles.modalBackdropCenter} onPress={() => setShowTodayModal(false)}>
          <Pressable
            style={[
              styles.todayDialog,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.todayHeroMini, { backgroundColor: heroBg }]}>
              <Ionicons name="calendar-number-outline" size={32} color="#E8C96A" />
              <Text style={styles.todayDialogLabel}>TODAY&apos;S HIJRI DATE</Text>
              <Text style={styles.todayDialogHijri}>{normalizedTodayHijri}</Text>
              <Text style={styles.todayDialogUrdu}>{todayHijri.urduFormatted}</Text>
            </View>

            <View style={styles.todayDialogBody}>
              <Text style={[styles.todayDialogSubLabel, { color: colors.textMuted }]}>
                GREGORIAN CALENDAR
              </Text>
              <Text style={[styles.todayDialogGreg, { color: colors.text }]}>
                {now.toLocaleDateString(undefined, {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
              <Text style={[styles.todayDialogMethod, { color: colors.textSecondary }]}>
                Calculated using Umm al-Qura astronomical reference.
              </Text>

              <TouchableOpacity
                style={[styles.closeDialogBtn, { backgroundColor: pillBg }]}
                onPress={() => setShowTodayModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={[styles.closeDialogText, { color: pillDayColor }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  todayStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: SPACING.md,
    minHeight: 52,
  },
  todayDotWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayHijriText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  todayGregText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: SPACING.sm,
    letterSpacing: -0.1,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: SPACING.sm,
    ...SHADOWS.card,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.24)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    letterSpacing: -0.3,
  },
  heroDesc: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '400',
    marginTop: 6,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  heroDateText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  eventsList: {
    gap: 10,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 72,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  datePill: {
    width: 48,
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  datePillDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  datePillMonth: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  eventTextCol: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  eventSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 2,
  },
  yearSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  yearSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  yearStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  yearStepBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: SPACING.lg,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalDateChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modalDateChipText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
  },
  modalArabicTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: SPACING.sm,
    textAlign: 'left',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  modalUrduTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  modalInfoBox: {
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.md,
    gap: 8,
  },
  modalInfoLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalInfoText: {
    fontSize: 13.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  modalSubheading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    minHeight: 50,
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdropCenter: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  todayDialog: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  todayHeroMini: {
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
  },
  todayDialogLabel: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  todayDialogHijri: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  todayDialogUrdu: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  todayDialogBody: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  todayDialogSubLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  todayDialogGreg: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  todayDialogMethod: {
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  closeDialogBtn: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    minHeight: 48,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  closeDialogText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
