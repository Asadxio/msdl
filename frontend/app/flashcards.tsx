import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import {
  FLASHCARD_CATEGORIES,
  IslamicFlashcard,
} from '@/constants/flashcardData';
import {
  loadMasteredCardIds,
  toggleCardMastery,
  getFlashcardsByCategory,
} from '@/lib/flashcardStorage';
import { goBackOrReplace } from '@/lib/navigation';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

export default function FlashcardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<string>('duas');
  const [cards, setCards] = useState<IslamicFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [masteredIds, setMasteredIds] = useState<string[]>([]);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);

  // Flip Animation ref
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const list = getFlashcardsByCategory(activeCategory);
    setCards(list);
    setCurrentIndex(0);
    setIsFlipped(false);
    animatedValue.setValue(0);
  }, [activeCategory]);

  useEffect(() => {
    loadMasteredCardIds().then(setMasteredIds);
  }, []);

  const flipCard = () => {
    if (isFlipped) {
      Animated.spring(animatedValue, {
        toValue: 0,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(false);
    } else {
      Animated.spring(animatedValue, {
        toValue: 180,
        friction: 8,
        tension: 10,
        useNativeDriver: true,
      }).start();
      setIsFlipped(true);
    }
  };

  const frontInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = animatedValue.interpolate({
    inputRange: [0, 180],
    outputRange: ['180deg', '360deg'],
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      if (isFlipped) flipCard();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      if (isFlipped) flipCard();
    }
  };

  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    if (isFlipped) flipCard();
  };

  const currentCard = cards[currentIndex] || cards[0];
  const isCurrentMastered = currentCard && masteredIds.includes(currentCard.id);

  const handleToggleMastered = async () => {
    if (!currentCard) return;
    const res = await toggleCardMastery(currentCard.id);
    const updated = await loadMasteredCardIds();
    setMasteredIds(updated);
  };

  const masteredInActiveDeck = cards.filter((c) => masteredIds.includes(c.id)).length;
  const progressPercent = cards.length > 0 ? (masteredInActiveDeck / cards.length) * 100 : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>عِلْمِي فِلِيشْ كَارْڈْز</Text>
          <Text style={styles.headerSubtitle}>Islamic Revision Flashcards</Text>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleShuffle}
          accessibilityLabel="Shuffle cards"
        >
          <Ionicons name="shuffle-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryTabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsScroll}>
          {FLASHCARD_CATEGORIES.map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryTab, isSelected && styles.categoryTabSelected]}
                onPress={() => setActiveCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? '#002E23' : '#64748B'}
                />
                <Text style={[styles.categoryTabText, isSelected && styles.categoryTabTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Progress Bar Banner */}
      <View style={styles.progressBanner}>
        <View style={styles.progressInfoRow}>
          <Text style={styles.progressText}>
            یاد ہو چکے: <Text style={styles.progressBold}>{masteredInActiveDeck} / {cards.length}</Text>
          </Text>
          <Text style={styles.progressPercent}>{Math.round(progressPercent)}% مکمل</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Main Flashcard Viewport */}
      <View style={styles.cardContainer}>
        {currentCard ? (
          <TouchableOpacity activeOpacity={1} onPress={flipCard} style={styles.touchArea}>
            {/* FRONT FACE */}
            <Animated.View style={[styles.card, styles.frontCard, frontAnimatedStyle]}>
              <View style={styles.cardTopBar}>
                <View style={styles.topicBadge}>
                  <Text style={styles.topicBadgeText}>{currentCard.topic}</Text>
                </View>
                <View style={styles.cardCounter}>
                  <Text style={styles.cardCounterText}>{currentIndex + 1} / {cards.length}</Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.bismillahTiny}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>
                <Text style={styles.arabicTextLarge}>{currentCard.frontText}</Text>
                {currentCard.frontSubtitle && (
                  <Text style={styles.frontSubtitleText}>{currentCard.frontSubtitle}</Text>
                )}
              </View>

              <View style={styles.cardBottomBar}>
                <Ionicons name="refresh-outline" size={16} color="#005F46" />
                <Text style={styles.flipHintText}>کارڈ گھمائیں اور ترجمہ دیکھیں (Tap to Flip)</Text>
              </View>
            </Animated.View>

            {/* BACK FACE */}
            <Animated.View style={[styles.card, styles.backCard, backAnimatedStyle]}>
              <View style={styles.cardTopBar}>
                <View style={[styles.topicBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.topicBadgeText, { color: '#B45309' }]}>ترجمہ و وضاحت</Text>
                </View>
                <View style={styles.refBadge}>
                  <Text style={styles.refBadgeText}>{currentCard.reference}</Text>
                </View>
              </View>

              <ScrollView style={styles.backScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.backTranslationText}>{currentCard.backTranslation}</Text>

                {currentCard.backRoman && (
                  <View style={styles.romanBox}>
                    <Text style={styles.romanLabel}>Aasan Roman Urdu:</Text>
                    <Text style={styles.romanText}>{currentCard.backRoman}</Text>
                  </View>
                )}

                {currentCard.backExplanation && (
                  <View style={styles.explanationBox}>
                    <Ionicons name="bulb-outline" size={14} color="#005F46" />
                    <Text style={styles.explanationText}>{currentCard.backExplanation}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={styles.cardBottomBar}>
                <Ionicons name="refresh-outline" size={16} color="#005F46" />
                <Text style={styles.flipHintText}>عربی متن پر واپس جائیں (Tap to Flip)</Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Bottom Navigation & Mastery Controls */}
      <View style={[styles.controlsRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={20} color={currentIndex === 0 ? '#94A3B8' : '#005F46'} />
        </TouchableOpacity>

        {/* 1-Tap Mastery Button */}
        <TouchableOpacity
          style={[styles.masteryBtn, isCurrentMastered && styles.masteryBtnActive]}
          onPress={handleToggleMastered}
          activeOpacity={0.88}
        >
          <Ionicons
            name={isCurrentMastered ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={20}
            color={isCurrentMastered ? '#FFFFFF' : '#005F46'}
          />
          <Text style={[styles.masteryBtnText, isCurrentMastered && styles.masteryBtnTextActive]}>
            {isCurrentMastered ? 'یاد ہو گیا (Mastered)' : 'یاد کریں (Mark Mastered)'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === cards.length - 1 && styles.navBtnDisabled]}
          onPress={handleNext}
          disabled={currentIndex === cards.length - 1}
          activeOpacity={0.8}
        >
          <Ionicons
            name="arrow-forward"
            size={20}
            color={currentIndex === cards.length - 1 ? '#94A3B8' : '#005F46'}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 14,
    color: '#C8A84E',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  categoryTabsWrap: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingVertical: 10,
  },
  categoryTabsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  categoryTabSelected: {
    backgroundColor: '#C8A84E',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  categoryTabTextSelected: {
    color: '#002E23',
  },
  progressBanner: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    gap: 6,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 11,
    color: '#E2E8F0',
  },
  progressBold: {
    fontWeight: '800',
    color: '#C8A84E',
  },
  progressPercent: {
    fontSize: 11,
    color: '#C8A84E',
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
  },
  touchArea: {
    width: CARD_WIDTH,
    height: '92%',
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
    ...SHADOWS.card,
  },
  frontCard: {
    position: 'absolute',
    top: 0,
    borderWidth: 2,
    borderColor: '#C8A84E',
  },
  backCard: {
    position: 'absolute',
    top: 0,
    borderWidth: 2,
    borderColor: '#005F46',
    backgroundColor: '#F8FAFC',
  },
  cardTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  topicBadge: {
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  topicBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#005F46',
  },
  cardCounter: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  cardCounterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  refBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  refBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  cardBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: 12,
  },
  bismillahTiny: {
    fontSize: 13,
    color: '#C8A84E',
    fontWeight: '600',
  },
  arabicTextLarge: {
    fontSize: 21,
    fontWeight: '800',
    color: '#003D2E',
    textAlign: 'center',
    lineHeight: 36,
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  frontSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  cardBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 6,
  },
  flipHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#005F46',
  },
  backScroll: {
    flex: 1,
    marginVertical: 10,
  },
  backTranslationText: {
    fontSize: 14,
    lineHeight: 23,
    color: '#0F172A',
    fontWeight: '700',
  },
  romanBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 10,
    gap: 3,
  },
  romanLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  romanText: {
    fontSize: 12,
    color: '#334155',
    fontStyle: 'italic',
  },
  explanationBox: {
    flexDirection: 'row',
    backgroundColor: '#E8F5EE',
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 10,
    gap: 6,
  },
  explanationText: {
    flex: 1,
    fontSize: 11,
    color: '#005F46',
    lineHeight: 17,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    gap: 12,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.card,
  },
  navBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    elevation: 0,
  },
  masteryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#005F46',
    ...SHADOWS.card,
  },
  masteryBtnActive: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  masteryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#005F46',
  },
  masteryBtnTextActive: {
    color: '#FFFFFF',
  },
});
