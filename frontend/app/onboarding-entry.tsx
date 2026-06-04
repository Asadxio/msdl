import { useCallback, useMemo, useEffect } from 'react';
import {
  AccessibilityInfo,
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
import { safeReplace } from '@/lib/navigation';
import { StatusBar } from 'expo-status-bar';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  useAnimatedReaction as useReaction,
  createAnimatedComponent,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useOnboardingSession } from '@/context/OnboardingContext';
import { markOnboardingEntryComplete } from '@/lib/onboarding';

const SWIPE_DISTANCE = 220;
const COMPLETE_THRESHOLD = 0.64;
const GOLD = '#D4AF37';
const EMERALD = '#064E3B';
const DEEP_EMERALD = '#032D23';
const SOFT_GOLD = '#FFF7D8';
const DARK_TEAL = '#005E4A';

// Premium animation values
const LOGO_INTRO_DURATION = 1200;
const EXPANSION_DURATION = 900;
const BREATHING_DURATION = 3000;
const PARTICLE_DURATION = 4000;

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

export default function OnboardingEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { user } = useAuth();
  const { markEntryCompleteInSession } = useOnboardingSession();
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const reduceMotion = { reduceMotionEnabled };

  const progress = useSharedValue(0);
  const crossedThreshold = useSharedValue(false);
  const completing = useSharedValue(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotionEnabled)
      .catch(() => {});
  }, []);

  // Premium animation values
  const logoScale = useSharedValue(0.85);
  const logoOpacity = useSharedValue(0);
  const arabicOpacity = useSharedValue(0);
  const englishOpacity = useSharedValue(0);
  const handleBreathing = useSharedValue(0.5);
  const handleGlowOpacity = useSharedValue(0.3);
  const expansionRadius = useSharedValue(0);
  const centerExpansionOpacity = useSharedValue(0);
  const particleOpacity = useSharedValue(0);

  const motifItems = useMemo(() => Array.from({ length: 9 }, (_, index) => index), []);

  const hapticSelect = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const hapticComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, []);

  // Premium logo intro animation on mount
  useEffect(() => {
    if (reduceMotion?.reduceMotionEnabled) {
      logoOpacity.value = 1;
      logoScale.value = 1;
      arabicOpacity.value = 1;
      englishOpacity.value = 1;
      handleGlowOpacity.value = 1;
      return;
    }

    // Sequential premium animations
    logoOpacity.value = withTiming(1, {
      duration: 600,
      easing: Easing.inOut(Easing.cubic),
    });

    logoScale.value = withTiming(1, {
      duration: LOGO_INTRO_DURATION,
      easing: Easing.inOut(Easing.cubic),
    });

    arabicOpacity.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.inOut(Easing.cubic) }));
    englishOpacity.value = withDelay(300, withTiming(1, { duration: 500, easing: Easing.inOut(Easing.cubic) }));

    // Breathing animation for handle
    handleBreathing.value = withSequence(
      withDelay(800, withTiming(0.8, { duration: 1500 })),
      withTiming(1.2, { duration: 1500 }),
      withTiming(0.8, { duration: 1500 }),
    );

    // Glow intensity animation
    handleGlowOpacity.value = withSequence(
      withDelay(800, withTiming(0.6, { duration: 2000 })),
      withTiming(0.3, { duration: 2000 }),
    );

    // Particle fade-in
    particleOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
  }, [reduceMotion?.reduceMotionEnabled, logoOpacity, logoScale, arabicOpacity, englishOpacity, handleBreathing, handleGlowOpacity, particleOpacity]);

  const completeOnboarding = useCallback(async () => {
    await markOnboardingEntryComplete();
    markEntryCompleteInSession();
    safeReplace(router, user ? '/' : '/auth/login');
  }, [markEntryCompleteInSession, router, user]);

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
    
    // PREMIUM: Center expansion animation before navigation
    if (!reduceMotion?.reduceMotionEnabled) {
      centerExpansionOpacity.value = withTiming(0.8, { duration: 200 });
      
      const timer = setTimeout(() => {
        completeOnboarding().catch(() => {
          markEntryCompleteInSession();
          safeReplace(router, user ? '/' : '/auth/login');
        });
      }, EXPANSION_DURATION);
      
      return () => clearTimeout(timer);
    } else {
      completeOnboarding().catch(() => {
        markEntryCompleteInSession();
        safeReplace(router, user ? '/' : '/auth/login');
      });
    }
  }, [completeOnboarding, hapticComplete, markEntryCompleteInSession, router, user, centerExpansionOpacity, reduceMotion?.reduceMotionEnabled]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      if (completing.value) return;
      
      // PREMIUM: Add resistance at start for "unlocking" feel
      const rawProgress = -event.translationY / SWIPE_DISTANCE;
      const resistance = rawProgress < 0.1 ? rawProgress * 0.6 : 0.06 + (rawProgress - 0.1) * 1.04;
      progress.value = clamp(resistance, 0, 1);
    })
    .onEnd((event) => {
      'worklet';
      if (completing.value) return;
      
      const shouldComplete = progress.value >= COMPLETE_THRESHOLD || event.velocityY < -820;
      if (shouldComplete) {
        completing.value = true;
        
        // PREMIUM: Smoother expansion animation
        progress.value = withTiming(1, 
          { 
            duration: EXPANSION_DURATION,
            easing: Easing.inOut(Easing.cubic),
          }, 
          (finished) => {
            if (finished) runOnJS(finish)();
          }
        );
      } else {
        progress.value = withSpring(0, { damping: 16, stiffness: 180, overshootClamping: true });
      }
    });

  const emeraldRiseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.92, 1], Extrapolation.CLAMP),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -18], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [logoScale.value, 1.02, 1.08], Extrapolation.CLAMP) },
    ],
    opacity: logoOpacity.value,
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.72, 1], [arabicOpacity.value, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -28], Extrapolation.CLAMP) }],
  }));

  const englishNameStyle = useAnimatedStyle(() => ({
    opacity: englishOpacity.value,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -SWIPE_DISTANCE * 0.72], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.9], Extrapolation.CLAMP) },
    ],
  }));

  // PREMIUM: Breathing handle animation
  const handleBreathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: handleBreathing.value }],
  }));

  // PREMIUM: Glow intensity animation
  const glowIntensityStyle = useAnimatedStyle(() => ({
    opacity: handleGlowOpacity.value,
  }));

  // PREMIUM: Center expansion overlay
  const expansionStyle = useAnimatedStyle(() => ({
    opacity: centerExpansionOpacity.value,
  }));

  // PREMIUM: Particle fade-in
  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.8, 1], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#FFFFFF', '#FFFDF4', '#F8FBF7']}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View pointerEvents="none" style={styles.geometricLayer}>
        <Animated.View style={[particleStyle, styles.particleContainer]}>
          {motifItems.map((item) => {
            const size = width * (item % 2 === 0 ? 0.34 : 0.24);
            return (
              <View
                key={item}
                style={[
                  styles.motif,
                  {
                    width: size,
                    height: size,
                    left: (item % 3) * (width / 2.5) - size / 2,
                    top: 54 + item * 76,
                    transform: [{ rotate: `${45 + item * 9}deg` }],
                    borderColor: item % 2 === 0 ? 'rgba(212,175,55,0.18)' : 'rgba(6,78,59,0.12)',
                  },
                ]}
              />
            );
          })}
          <View style={[styles.star, { top: height * 0.15, left: width * 0.12 }]} />
          <View style={[styles.star, styles.starEmerald, { top: height * 0.7, right: width * 0.12 }]} />
        </Animated.View>
      </View>

      <Animated.View pointerEvents="none" style={[styles.emeraldRise, emeraldRiseStyle]}>
        <LinearGradient
          colors={[DEEP_EMERALD, EMERALD, '#0E7A5D']}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.riseGlow} />
      </Animated.View>

      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }]}>
        <Animated.View style={[styles.hero, logoStyle]}>
          <View style={styles.logoAura}>
            <View style={styles.logoRing}>
              <Image source={require('../assets/images/icon.png')} style={styles.logoImage} resizeMode="cover" />
              <View style={styles.logoMonogramOverlay}>
                <Text style={styles.logoArabic}>م</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Animated.Text style={[styles.arabicName, { opacity: arabicOpacity }]}>مدرسۃ السالکات للبنات</Animated.Text>
          <Animated.Text style={[styles.englishName, englishNameStyle]}>Madars tus salikat Lilbanat</Animated.Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>Begin your journey of sacred knowledge</Text>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.swipeZone, { bottom: insets.bottom + 28 }, handleStyle]}>
            <Animated.View style={[styles.handleGlow, glowIntensityStyle]} />
            <Animated.View style={[handleBreathingStyle]}>
              <LinearGradient
                colors={[SOFT_GOLD, GOLD, '#B88916']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.handle}
              >
                <View style={styles.handlePill} />
              </LinearGradient>
            </Animated.View>
            <Animated.Text style={[styles.swipeText, { opacity: interpolate(progress.value, [0, 0.3], [1, 0.2], Extrapolation.CLAMP) }]}>
              Swipe Up To Enter
            </Animated.Text>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* PREMIUM: Center expansion overlay for completion */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.expansionOverlay,
          expansionStyle,
          {
            borderRadius: Math.max(height, width),
          },
        ]}
      >
        <LinearGradient
          colors={[DARK_TEAL, EMERALD, '#0E7A5D']}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.fadeOverlay, fadeStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    overflow: 'hidden',
  },
  geometricLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  motif: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 22,
    opacity: 0.9,
  },
  star: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderColor: 'rgba(212,175,55,0.2)',
    borderWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  starEmerald: {
    borderColor: 'rgba(6,78,59,0.14)',
    transform: [{ rotate: '22deg' }],
  },
  emeraldRise: {
    ...StyleSheet.absoluteFillObject,
  },
  riseGlow: {
    position: 'absolute',
    top: -70,
    left: -40,
    right: -40,
    height: 150,
    borderRadius: 80,
    backgroundColor: 'rgba(212,175,55,0.24)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoAura: {
    width: 176,
    height: 176,
    borderRadius: 88,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
  logoRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#FDF8E8',
  },
  logoImage: {
    width: 136,
    height: 136,
    opacity: 0.18,
  },
  logoMonogramOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.76)',
  },
  logoArabic: {
    color: EMERALD,
    fontSize: 72,
    fontWeight: '800',
    includeFontPadding: false,
    textShadowColor: 'rgba(212,175,55,0.42)',
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 5 },
  },
  copy: {
    alignItems: 'center',
  },
  arabicName: {
    color: EMERALD,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  englishName: {
    marginTop: 10,
    color: '#173C31',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  divider: {
    marginVertical: 18,
    width: 74,
    height: 2,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  subtitle: {
    maxWidth: 280,
    color: 'rgba(15,47,37,0.7)',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  swipeZone: {
    position: 'absolute',
    alignItems: 'center',
  },
  handleGlow: {
    position: 'absolute',
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(212,175,55,0.28)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'android' ? 0.9 : 0.52,
    shadowRadius: 28,
    elevation: 18,
  },
  handle: {
    width: 86,
    height: 86,
    borderRadius: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  handlePill: {
    width: 30,
    height: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
    transform: [{ rotate: '-18deg' }],
  },
  swipeText: {
    marginTop: 16,
    color: EMERALD,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  expansionOverlay: {
    position: 'absolute',
    width: '200%',
    height: '200%',
    left: '-50%',
    top: '-50%',
    zIndex: 999,
  },
});
