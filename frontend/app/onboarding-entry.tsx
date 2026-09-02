import { useCallback, useEffect } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingSession } from '@/context/OnboardingContext';
import { markOnboardingEntryComplete } from '@/lib/onboarding';

const SWIPE_DISTANCE = 220;
const COMPLETE_THRESHOLD = 0.65;
const ROYAL_GOLD = '#D4AF37';
const EMERALD = '#064E3B';
const WARM_IVORY = '#FAF9F6';

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export default function OnboardingEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useAuth();
  const { markEntryCompleteInSession } = useOnboardingSession();
  
  // Interaction Values
  const progress = useSharedValue(0);
  const crossedThreshold = useSharedValue(false);
  const completing = useSharedValue(false);

  // Entrance Animation Values
  const entryFade = useSharedValue(0);
  const dividerWidth = useSharedValue(0);
  const noorPulse = useSharedValue(1);
  const handlePulse = useSharedValue(1);

  const hapticSelect = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const hapticComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  const completeOnboarding = useCallback(async () => {
    await markOnboardingEntryComplete();
    markEntryCompleteInSession();
    router.replace(user ? '/' : '/auth/login');
  }, [markEntryCompleteInSession, router, user]);

  useEffect(() => {
    // Entrance Animations
    entryFade.value = withTiming(1, { duration: 1600 });
    dividerWidth.value = withDelay(800, withSpring(80, { damping: 15, stiffness: 100 }));
    
    // Breathing Noor Animation
    noorPulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 4000 }),
        withTiming(1, { duration: 4000 })
      ),
      -1,
      true
    );

    // Subtle Handle Pulse
    handlePulse.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 2500 }),
        withTiming(1, { duration: 2500 })
      ),
      -1,
      true
    );
  }, [entryFade, dividerWidth, noorPulse, handlePulse]);

  useAnimatedReaction(
    () => progress.value >= COMPLETE_THRESHOLD,
    (isReady, wasReady) => {
      if (isReady && !wasReady && !crossedThreshold.value) {
        crossedThreshold.value = true;
        runOnJS(hapticSelect)();
      }
      if (!isReady && wasReady) {
        crossedThreshold.value = false;
      }
    },
  );

  const finish = useCallback(() => {
    hapticComplete();
    completeOnboarding().catch(() => {
      markEntryCompleteInSession();
      router.replace(user ? '/' : '/auth/login');
    });
  }, [completeOnboarding, hapticComplete, markEntryCompleteInSession, router, user]);

  const triggerFinish = useCallback(() => {
    if (completing.value) return;
    completing.value = true;
    progress.value = withTiming(1, { duration: 500 }, (finished) => {
      if (finished) runOnJS(finish)();
    });
  }, [finish]);

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet';
      if (completing.value) return;
      runOnJS(triggerFinish)();
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (completing.value) return;
      progress.value = clamp(-event.translationY / SWIPE_DISTANCE, 0, 1);
    })
    .onEnd((event) => {
      'worklet';
      if (completing.value) return;
      const shouldComplete = progress.value >= COMPLETE_THRESHOLD || event.velocityY < -820;
      if (shouldComplete) {
        runOnJS(triggerFinish)();
      } else {
        progress.value = withSpring(0, { damping: 18, stiffness: 170 });
      }
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  // Animated Styles

  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -height * 0.1], Extrapolation.CLAMP) }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: entryFade.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [1, 1.15], Extrapolation.CLAMP) },
      { translateY: interpolate(progress.value, [0, 1], [0, -30], Extrapolation.CLAMP) }
    ],
  }));

  const noorStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: noorPulse.value * interpolate(progress.value, [0, 1], [1, 1.4], Extrapolation.CLAMP) }
    ],
    opacity: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP),
  }));

  const textGroupStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.6, 1], [entryFade.value, 0.2, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -40], Extrapolation.CLAMP) }],
  }));

  const dividerStyle = useAnimatedStyle(() => ({
    width: dividerWidth.value,
    opacity: interpolate(progress.value, [0, 0.6], [1, 0], Extrapolation.CLAMP),
  }));

  const handleContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.8, 1], [entryFade.value, 0.2, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -SWIPE_DISTANCE * 0.8], Extrapolation.CLAMP) },
      { scale: handlePulse.value }
    ],
  }));

  const handlePillStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(255, 255, 255, ${interpolate(progress.value, [0, 1], [0.92, 0.4])})`,
    borderColor: `rgba(212, 175, 55, ${interpolate(progress.value, [0, 1], [0.45, 0.9])})`,
    shadowOpacity: interpolate(progress.value, [0, 1], [0.2, 0.45]),
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      
      {/* Background Layer */}
      <Animated.View style={[StyleSheet.absoluteFill, backgroundStyle]}>
        <LinearGradient
          colors={['#FFFFFF', '#FAF9F6', '#F3EFE6']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Faint Islamic Arch Silhouette */}
        <View style={styles.archSilhouetteContainer}>
          <View style={styles.archSilhouette} />
        </View>
      </Animated.View>

      <View style={[styles.content, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 36 }]}>
        
        {/* Top Text Group */}
        <Animated.View style={[styles.topTextGroup, textGroupStyle]}>
          <Text style={styles.bismillah}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْم</Text>
        </Animated.View>

        {/* Center Logo / Pure Emblem */}
        <Animated.View style={[styles.hero, logoStyle]}>
          {/* Noor Glow Layer */}
          <Animated.View style={[styles.noorGlow, noorStyle]} />
          <Animated.View style={[styles.noorGlowCore, noorStyle]} />
          
          <View style={styles.logoRing}>
            <Image 
              source={require('../assets/images/emblem_pure.png')} 
              style={styles.logoImage} 
              resizeMode="contain" 
            />
          </View>
        </Animated.View>

        {/* Typography Group */}
        <Animated.View style={[styles.copy, textGroupStyle]}>
          <Text style={styles.arabicName}>مَدْرَسَةُ السَّالِكَاتِ لِلْبَنَات</Text>
          <Text style={styles.englishName}>MADRASA TUS SALIKAT LIL BANAT</Text>
          
          {/* Animated Gold Divider */}
          <Animated.View style={[styles.divider, dividerStyle]} />
          
          <Text style={styles.subtitle}>Where Sacred Knowledge Meets Noble Character</Text>
          <Text style={styles.secondarySubtitle}>Nurturing Faith, Knowledge & Adab</Text>
        </Animated.View>

        {/* Intuitive CTA with Tap + Swipe Up */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View 
            style={[styles.swipeZone, { bottom: insets.bottom + 28 }, handleContainerStyle]} 
            testID="goto-begin-journey-btn"
            accessibilityRole="button"
            accessibilityLabel="Begin your journey. Tap or swipe up to enter"
          >
            {/* Pulsing guidance indicator above pill */}
            <View style={styles.hintIndicator}>
              <Ionicons name="chevron-up" size={18} color="#D4AF37" />
              <Text style={styles.hintText}>Swipe up or tap to enter</Text>
            </View>

            <Animated.View style={[styles.swipePill, handlePillStyle]}>
              <View style={styles.swipeGlow} />
              <Text style={styles.swipeArabic}>ابدئي رحلتكِ</Text>
              <View style={styles.swipeEnglishRow}>
                <Ionicons name="sparkles" size={12} color="#D4AF37" style={{ marginRight: 6 }} />
                <Text style={styles.swipeEnglish}>BEGIN YOUR JOURNEY</Text>
                <Ionicons name="arrow-up" size={12} color="#D4AF37" style={{ marginLeft: 6 }} />
              </View>
            </Animated.View>
          </Animated.View>
        </GestureDetector>

      </View>

      {/* Golden Light Sweep on Completion */}
      <Animated.View pointerEvents="none" style={[styles.sweepOverlay, sweepStyle]}>
        <LinearGradient
          colors={['rgba(212,175,55,0)', 'rgba(212,175,55,0.15)', 'rgba(250,249,246,1)']}
          locations={[0, 0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WARM_IVORY,
    overflow: 'hidden',
  },
  archSilhouetteContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-start',
    top: '12%',
    opacity: 0.04,
  },
  archSilhouette: {
    width: '82%',
    height: '90%',
    borderTopLeftRadius: 1000,
    borderTopRightRadius: 1000,
    borderWidth: 2,
    borderColor: EMERALD,
    borderBottomWidth: 0,
    backgroundColor: 'rgba(6,78,59,0.1)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
  },
  topTextGroup: {
    alignItems: 'center',
    marginTop: 10,
  },
  bismillah: {
    color: ROYAL_GOLD,
    fontSize: 22,
    fontWeight: '500',
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    zIndex: 10,
  },
  noorGlow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(212,175,55,0.08)',
    shadowColor: ROYAL_GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
    elevation: 10,
  },
  noorGlowCore: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  logoRing: {
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    shadowColor: ROYAL_GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoMonogramOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoArabic: {
    color: EMERALD,
    fontSize: 76,
    fontWeight: '800',
    includeFontPadding: false,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 90,
  },
  arabicName: {
    color: EMERALD,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  englishName: {
    color: '#064E3B',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  divider: {
    height: 1.5,
    backgroundColor: ROYAL_GOLD,
    marginVertical: 16,
    borderRadius: 1,
  },
  subtitle: {
    color: EMERALD,
    fontSize: 15,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  secondarySubtitle: {
    color: 'rgba(6,78,59,0.7)',
    fontSize: 12.5,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontWeight: '500',
    textAlign: 'center',
  },
  swipeZone: {
    position: 'absolute',
    alignItems: 'center',
    width: '100%',
    zIndex: 20,
  },
  hintIndicator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  hintText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#8A6D1E',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  swipePill: {
    width: 260,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.2,
    borderColor: 'rgba(212,175,55,0.5)',
    shadowColor: ROYAL_GOLD,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  swipeGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  swipeArabic: {
    color: EMERALD,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  swipeEnglishRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeEnglish: {
    color: EMERALD,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  sweepOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
});
