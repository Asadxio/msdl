import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
  Modal,
  ActivityIndicator,
  Alert,
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
  loadCardSRSRecords,
  recordCardReview,
  sortCardsBySRS,
  loadCustomAiFlashcards,
  addCustomAiFlashcards,
  CardSRSRecord,
} from '@/lib/flashcardStorage';
import { generateAiFlashcards } from '@/lib/aiFlashcardGenerator';
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
  const [srsRecords, setSrsRecords] = useState<Record<string, CardSRSRecord>>({});
  const [srsSmartMode, setSrsSmartMode] = useState<boolean>(true);
  const [customAiCards, setCustomAiCards] = useState<IslamicFlashcard[]>([]);

  // AI Modal State
  const [aiModalVisible, setAiModalVisible] = useState<boolean>(false);
  const [aiTopic, setAiTopic] = useState<string>('Salah / Namaz');
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);

  // Flip Animation ref
  const animatedValue = useRef(new Animated.Value(0)).current;

  // 10.3 PanResponder Swipe Gesture Animation
  const pan = useRef(new Animated.ValueXY()).current;
  const isDraggingRef = useRef(false);

  useEffect(() => {
    Promise.all([
      loadMasteredCardIds(),
      loadCardSRSRecords(),
      loadCustomAiFlashcards(),
    ]).then(([mastered, srs, custom]) => {
      setMasteredIds(mastered);
      setSrsRecords(srs);
      setCustomAiCards(custom);
    });
  }, []);

  useEffect(() => {
    let list = getFlashcardsByCategory(activeCategory, customAiCards);
    if (srsSmartMode) {
      list = sortCardsBySRS(list, srsRecords);
    }
    setCards(list);
    setCurrentIndex(0);
    setIsFlipped(false);
    animatedValue.setValue(0);
    pan.setValue({ x: 0, y: 0 });
  }, [activeCategory, srsSmartMode, customAiCards]);

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

  // Swipe gesture interpolations
  const rotateCard = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
    outputRange: ['-25deg', '0deg', '25deg'],
    extrapolate: 'clamp',
  });

  const rightStampOpacity = pan.x.interpolate({
    inputRange: [15, 90],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const leftStampOpacity = pan.x.interpolate({
    inputRange: [-90, -15],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const frontAnimatedStyle = {
    transform: [{ rotateY: frontInterpolate }],
  };

  const backAnimatedStyle = {
    transform: [{ rotateY: backInterpolate }],
  };

  // 10.3 Card Swipe Completion Handlers
  const handleSwipeComplete = (direction: 'right' | 'left') => {
    const card = cards[currentIndex];
    const toX = direction === 'right' ? SCREEN_WIDTH + 80 : -SCREEN_WIDTH - 80;

    Animated.timing(pan, {
      toValue: { x: toX, y: 0 },
      duration: 220,
      useNativeDriver: true,
    }).start(async () => {
      pan.setValue({ x: 0, y: 0 });
      if (isFlipped) {
        animatedValue.setValue(0);
        setIsFlipped(false);
      }

      if (card) {
        // Record review in 10.1 SRS
        const res = await recordCardReview(card.id, direction === 'right' ? 'know' : 'dont_know');
        setSrsRecords((prev) => ({ ...prev, [card.id]: res.record }));

        const updatedMastered = await loadMasteredCardIds();
        setMasteredIds(updatedMastered);
      }

      // Advance to next card
      setCurrentIndex((prev) => {
        if (prev < cards.length - 1) return prev + 1;
        return 0; // loop back to first for continuous practice
      });
    });
  };

  // PanResponder configuration
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const isHorizontal = Math.abs(gestureState.dx) > 12 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
        return isHorizontal;
      },
      onPanResponderGrant: () => {
        isDraggingRef.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        pan.setValue({ x: gestureState.dx, y: gestureState.dy * 0.4 });
      },
      onPanResponderRelease: (_, gestureState) => {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 80);

        if (gestureState.dx > 100) {
          // Swipe Right: Mastered / Know
          handleSwipeComplete('right');
        } else if (gestureState.dx < -100) {
          // Swipe Left: Needs Practice / Don't Know
          handleSwipeComplete('left');
        } else {
          // Spring back to center
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 40,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

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
  const currentCardSRS = currentCard ? srsRecords[currentCard.id] : null;

  const handleToggleMastered = async () => {
    if (!currentCard) return;
    const res = await toggleCardMastery(currentCard.id);
    const updated = await loadMasteredCardIds();
    setMasteredIds(updated);
    const srs = await loadCardSRSRecords();
    setSrsRecords(srs);
  };

  // 10.2 Generate AI Cards Handler
  const handleGenerateAiDeck = async () => {
    setGeneratingAi(true);
    try {
      const generated = await generateAiFlashcards({ topic: aiTopic, count: 4 });
      const updatedCustom = await addCustomAiFlashcards(generated);
      setCustomAiCards(updatedCustom);
      setActiveCategory('custom_ai');
      setAiModalVisible(false);
      Alert.alert('ماشاءاللہ', `AI نے "${aiTopic}" کے نئے کارڈز کامیابی سے تیار کر دیے!`);
    } catch {
      Alert.alert('خطا', 'AI کارڈز تیار کرنے میں مسئلہ پیش آیا۔');
    } finally {
      setGeneratingAi(false);
    }
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
          <Text style={styles.arabicHeader}>Islamic Flashcards</Text>
          <Text style={styles.headerSubtitle}>Memorize Duas, Hadiths & Fiqh Rules</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* 10.2 AI Generator Button */}
          <TouchableOpacity
            style={[styles.headerBtn, { backgroundColor: '#C8A84E' }]}
            onPress={() => setAiModalVisible(true)}
            accessibilityLabel="Generate AI Flashcards"
          >
            <Ionicons name="sparkles" size={18} color="#002E23" />
          </TouchableOpacity>

          {/* 10.1 SRS Smart Mode Toggle */}
          <TouchableOpacity
            style={[styles.headerBtn, srsSmartMode && { backgroundColor: '#10B981' }]}
            onPress={() => setSrsSmartMode(!srsSmartMode)}
            accessibilityLabel="Toggle SRS Smart Review"
          >
            <Ionicons name="sync-circle" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleShuffle}
            accessibilityLabel="Shuffle cards"
          >
            <Ionicons name="shuffle-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.categoryTabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryTabsScroll}>
          {customAiCards.length > 0 && (
            <TouchableOpacity
              style={[styles.categoryTab, activeCategory === 'custom_ai' && styles.categoryTabSelected]}
              onPress={() => setActiveCategory('custom_ai')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="sparkles"
                size={14}
                color={activeCategory === 'custom_ai' ? '#002E23' : '#C8A84E'}
              />
              <Text style={[styles.categoryTabText, activeCategory === 'custom_ai' && styles.categoryTabTextSelected]}>
                AI Cards ({customAiCards.length})
              </Text>
            </TouchableOpacity>
          )}

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
            Mastered: <Text style={styles.progressBold}>{masteredInActiveDeck} / {cards.length}</Text>
          </Text>
          <Text style={styles.progressPercent}>{Math.round(progressPercent)}% Done</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>

      {/* Main Flashcard Viewport with 10.3 PanResponder Swipe Gestures */}
      <View style={styles.cardContainer}>
        {currentCard ? (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.touchArea,
              {
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                  { rotate: rotateCard },
                ],
              },
            ]}
          >
            {/* 10.3 Swipe Stamp Badges */}
            <Animated.View style={[styles.swipeStamp, styles.swipeStampRight, { opacity: rightStampOpacity }]}>
              <View style={styles.stampInnerRight}>
                <Ionicons name="checkmark-circle" size={26} color="#16A34A" />
                <Text style={styles.stampTextRight}>یاد ہو گیا (KNEW IT)</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.swipeStamp, styles.swipeStampLeft, { opacity: leftStampOpacity }]}>
              <View style={styles.stampInnerLeft}>
                <Ionicons name="close-circle" size={26} color="#DC2626" />
                <Text style={styles.stampTextLeft}>دوبارہ دہرائیں (PRACTICE)</Text>
              </View>
            </Animated.View>

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => {
                if (!isDraggingRef.current) flipCard();
              }}
              style={{ width: '100%', height: '100%' }}
            >
              {/* FRONT FACE */}
              <Animated.View style={[styles.card, styles.frontCard, frontAnimatedStyle]}>
                <View style={styles.cardTopBar}>
                  <View style={styles.topicBadge}>
                    <Text style={styles.topicBadgeText}>{currentCard.topic}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {/* 10.1 SRS Retention Stage Badge */}
                    {currentCardSRS && (
                      <View style={[
                        styles.srsLevelBadge,
                        currentCardSRS.level >= 4
                          ? styles.srsLevelMastered
                          : currentCardSRS.level >= 2
                          ? styles.srsLevelLearning
                          : styles.srsLevelWeak
                      ]}>
                        <Text style={styles.srsLevelText}>
                          {currentCardSRS.level >= 4 ? 'پکا یاد' : currentCardSRS.level >= 2 ? 'جاری' : 'کمزور'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.cardCounter}>
                      <Text style={styles.cardCounterText}>{currentIndex + 1} / {cards.length}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.bismillahTiny}>Bismillahir-Rahmanir-Rahim</Text>
                  <Text style={styles.arabicTextLarge}>{currentCard.frontText}</Text>
                  {currentCard.frontSubtitle && (
                    <Text style={styles.frontSubtitleText}>{currentCard.frontSubtitle}</Text>
                  )}
                </View>

                {/* FLIP HINT & GESTURE HINT */}
                <View style={styles.cardFooter}>
                  <View style={styles.gestureHintRow}>
                    <Text style={styles.gestureHintText}>👈 Swipe Left: دہرائیں</Text>
                    <View style={styles.footerDot} />
                    <Text style={styles.gestureHintText}>Swipe Right: یاد ہے 👉</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="sync-outline" size={14} color="#005F46" />
                    <Text style={styles.flipHintText}>Tap Card to Flip & View Meaning</Text>
                  </View>
                </View>
              </Animated.View>

              {/* BACK FACE */}
              <Animated.View style={[styles.card, styles.backCard, backAnimatedStyle]}>
                <View style={styles.cardTopBar}>
                  <View style={[styles.topicBadge, { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.topicBadgeText, { color: '#B45309' }]}>Meaning & Guidance</Text>
                  </View>
                  <View style={styles.cardCounter}>
                    <Text style={styles.cardCounterText}>
                      {currentIndex + 1} / {cards.length}
                    </Text>
                  </View>
                </View>

                <ScrollView style={styles.backScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.backTranslationText}>{currentCard.backTranslation}</Text>

                  {currentCard.backRoman && (
                    <View style={styles.romanBox}>
                      <Text style={styles.romanLabel}>Roman Pronunciation:</Text>
                      <Text style={styles.romanText}>{currentCard.backRoman}</Text>
                    </View>
                  )}

                  {currentCard.backExplanation && (
                    <View style={styles.explanationBox}>
                      <Ionicons name="bulb-outline" size={14} color="#005F46" />
                      <Text style={styles.explanationText}>{currentCard.backExplanation}</Text>
                    </View>
                  )}

                  {currentCard.reference && (
                    <View style={styles.refBox}>
                      <Ionicons name="book" size={14} color="#C8A84E" />
                      <Text style={styles.refText}>{currentCard.reference}</Text>
                    </View>
                  )}
                </ScrollView>

                <View style={styles.cardBottomBar}>
                  <Ionicons name="sync-outline" size={16} color="#005F46" />
                  <Text style={styles.flipHintText}>Tap to Return to Arabic Word</Text>
                </View>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="albums-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No flashcards currently in this category</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={[styles.controlsRow, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={handlePrev}
          disabled={currentIndex === 0}
          accessibilityLabel="Previous card"
        >
          <Ionicons name="arrow-back" size={20} color={currentIndex === 0 ? '#94A3B8' : '#002E23'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.masteryBtn, isCurrentMastered && styles.masteryBtnActive]}
          onPress={handleToggleMastered}
          activeOpacity={0.85}
        >
          <Ionicons
            name={isCurrentMastered ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={18}
            color={isCurrentMastered ? '#FFFFFF' : '#005F46'}
          />
          <Text style={[styles.masteryBtnText, isCurrentMastered && styles.masteryBtnTextActive]}>
            {isCurrentMastered ? 'Mastered ✓' : 'Mark as Mastered'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === cards.length - 1 && styles.navBtnDisabled]}
          onPress={handleNext}
          disabled={currentIndex === cards.length - 1}
          accessibilityLabel="Next card"
        >
          <Ionicons
            name="arrow-forward"
            size={20}
            color={currentIndex === cards.length - 1 ? '#94A3B8' : '#002E23'}
          />
        </TouchableOpacity>
      </View>

      {/* 10.2 AI Flashcard Generator Modal */}
      <Modal
        visible={aiModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="sparkles" size={20} color="#C8A84E" />
                <Text style={styles.modalTitle}>AI Flashcard Deck Maker</Text>
              </View>
              <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Select an Islamic course topic to generate high-yield memorization cards instantly with Arabic text, Urdu meanings, and authentic references:
            </Text>

            <View style={styles.topicOptionsList}>
              {[
                'Salah / Namaz',
                'Fasting / Roza',
                'Zakat & Charity',
                'Tajweed Rules',
                'Seerah & Akhlaq',
              ].map((topic) => {
                const isSelected = aiTopic === topic;
                return (
                  <TouchableOpacity
                    key={topic}
                    style={[styles.topicOptionBtn, isSelected && styles.topicOptionBtnSelected]}
                    onPress={() => setAiTopic(topic)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#005F46' : '#94A3B8'}
                    />
                    <Text style={[styles.topicOptionText, isSelected && styles.topicOptionTextSelected]}>
                      {topic}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.generateAiSubmitBtn, generatingAi && { opacity: 0.7 }]}
              onPress={handleGenerateAiDeck}
              disabled={generatingAi}
              activeOpacity={0.85}
            >
              {generatingAi ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color="#002E23" />
                  <Text style={styles.generateAiSubmitBtnText}>Generating Authentic Cards...</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="sparkles" size={18} color="#002E23" />
                  <Text style={styles.generateAiSubmitBtnText}>Generate 4 Cards (کارڈز بنائیں)</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 8,
    gap: 6,
  },
  refBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF5',
    borderRadius: RADIUS.md,
    padding: 8,
    marginTop: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  refText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '700',
    textAlign: 'center',
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

  // 10.3 Swipe Stamp Badges & Overlays
  swipeStamp: {
    position: 'absolute',
    top: 30,
    zIndex: 999,
    padding: 8,
  },
  swipeStampRight: {
    left: 20,
  },
  swipeStampLeft: {
    right: 20,
  },
  stampInnerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DCFCE7',
    borderWidth: 2.5,
    borderColor: '#16A34A',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '-15deg' }],
    ...SHADOWS.card,
  },
  stampTextRight: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '900',
  },
  stampInnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    borderWidth: 2.5,
    borderColor: '#DC2626',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ rotate: '15deg' }],
    ...SHADOWS.card,
  },
  stampTextLeft: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '900',
  },

  // 10.1 SRS Stage Badge
  srsLevelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  srsLevelMastered: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  srsLevelLearning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  srsLevelWeak: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  srsLevelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Gesture Hint
  gestureHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gestureHintText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },

  // 10.2 AI Flashcard Maker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    padding: SPACING.lg,
    gap: 14,
    ...SHADOWS.card,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#002E23',
  },
  modalDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  topicOptionsList: {
    gap: 8,
    marginVertical: 4,
  },
  topicOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  topicOptionBtnSelected: {
    borderColor: '#005F46',
    backgroundColor: '#E8F5EE',
  },
  topicOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  topicOptionTextSelected: {
    color: '#005F46',
    fontWeight: '800',
  },
  generateAiSubmitBtn: {
    backgroundColor: '#C8A84E',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...SHADOWS.card,
  },
  generateAiSubmitBtnText: {
    color: '#002E23',
    fontSize: 14,
    fontWeight: '800',
  },
});
