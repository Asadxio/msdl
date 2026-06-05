import { useCallback, useMemo } from 'react';
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
  const progress = useSharedValue(0);
  const crossedThreshold = useSharedValue(false);
  const completing = useSharedValue(false);

  const motifItems = useMemo(() => Array.from({ length: 9 }, (_, index) => index), []);

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
        completing.value = true;
        progress.value = withTiming(1, { duration: 520 }, (finished) => {
          if (finished) runOnJS(finish)();
        });
      } else {
        progress.value = withSpring(0, { damping: 18, stiffness: 170 });
      }
    });

  const emeraldRiseStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [height, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.92, 1], Extrapolation.CLAMP),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -18], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.72, 1], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -28], Extrapolation.CLAMP) }],
  }));

  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -SWIPE_DISTANCE * 0.72], Extrapolation.CLAMP) },
      { scale: interpolate(progress.value, [0, 1], [1, 0.9], Extrapolation.CLAMP) },
    ],
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
          <Text style={styles.arabicName}>مدرسۃ السالکات للبنات</Text>
          <Text style={styles.englishName}>Madars tus salikat Lilbanat</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>A refined learning space for sacred knowledge.</Text>
        </Animated.View>

        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.swipeZone, { bottom: insets.bottom + 28 }, handleStyle]}>
            <View style={styles.handleGlow} />
            <LinearGradient
              colors={[SOFT_GOLD, GOLD, '#B88916']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.handle}
            >
              <View style={styles.handlePill} />
            </LinearGradient>
            <Text style={styles.swipeText}>Swipe Up To Begin</Text>
          </Animated.View>
        </GestureDetector>
      </View>

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
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(212,175,55,0.24)',
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: Platform.OS === 'android' ? 0.8 : 0.44,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.68)',
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
});
