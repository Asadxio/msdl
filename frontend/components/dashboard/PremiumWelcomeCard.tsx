import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { UserProfile } from '@/context/AuthContext';

export const OFFICIAL_SENDER_NUMBER = '+916366919122';
export const OFFICIAL_HELPLINE_URL = 'https://wa.me/916366919122';

export interface PremiumWelcomeCardProps {
  profile: UserProfile | null;
  onExplore?: () => void;
  onDismiss?: () => void;
  testID?: string;
}

export function PremiumWelcomeCard({
  profile,
  onExplore,
  onDismiss,
  testID = 'premium-welcome-card',
}: PremiumWelcomeCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  const uid = profile?.uid || '';
  const studentName = profile?.name?.trim() || 'طالبہ';
  const storageKey = `@mslb_welcome_dismissed_${uid}`;

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem(storageKey)
      .then((val) => {
        if (val === 'true') {
          setDismissed(true);
        }
      })
      .catch(() => {});
  }, [uid, storageKey]);

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(async () => {
      setDismissed(true);
      if (uid) {
        await AsyncStorage.setItem(storageKey, 'true').catch(() => {});
      }
      onDismiss?.();
    });
  };

  const handleExplore = () => {
    handleDismiss();
    onExplore?.();
  };

  const handleWhatsAppContact = async () => {
    const prefilledText = `Assalamu Alaikum, main ${studentName} hoon. Maine Madrasatu-s-Salikat Lil Banat mein registration kiya hai.`;
    const encodedText = encodeURIComponent(prefilledText);
    const waUrl = `${OFFICIAL_HELPLINE_URL}?text=${encodedText}`;

    try {
      const canOpen = await Linking.canOpenURL(waUrl);
      if (canOpen) {
        await Linking.openURL(waUrl);
      } else {
        // Fallback if WhatsApp is not installed
        Alert.alert(
          'WhatsApp Helpline',
          `Hamari official helpline number par rabta farmayein:\n${OFFICIAL_SENDER_NUMBER}\n\n(WhatsApp application device par open nahi ho saki).`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Call Helpline',
              onPress: () => Linking.openURL(`tel:${OFFICIAL_SENDER_NUMBER}`).catch(() => {}),
            },
          ]
        );
      }
    } catch (err) {
      Alert.alert(
        'WhatsApp Helpline',
        `Official Helpline: ${OFFICIAL_SENDER_NUMBER}\n\nKripya is number ko apne phone mein save karke WhatsApp par rabta karein.`
      );
    }
  };

  if (dismissed) {
    return null;
  }

  return (
    <Animated.View style={[styles.outerContainer, { opacity: fadeAnim }]} testID={testID}>
      {/* Decorative Gold Header Bar */}
      <View style={styles.topGoldBar} />

      <View style={styles.cardContent}>
        {/* Header Row with Close/Dismiss Button */}
        <View style={styles.headerRow}>
          <View style={styles.bismillahBox}>
            <Text style={styles.bismillahText}>بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ</Text>
            <Text style={styles.salamText}>السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللهِ وَبَرَكَاتُهُ</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Dismiss welcome message"
            activeOpacity={0.7}
            testID="welcome-card-dismiss-button"
          >
            <Ionicons name="close" size={20} color="#718096" />
          </TouchableOpacity>
        </View>

        {/* Dynamic Student Greeting */}
        <View style={styles.greetingContainer}>
          <Text style={styles.welcomeEyebrow}>KHAIR MAQDAM • WELCOME TO MSLB</Text>
          <Text style={styles.studentNameTitle} numberOfLines={1}>
            Welcome, {studentName} 🌸
          </Text>
          <Text style={styles.introParagraph}>
            Madrasatu-s-Salikat Lil Banat mein aapka dilli khair-maqdam hai! Aapka admission registration kamyabi ke saath receive ho gaya hai.
          </Text>
        </View>

        {/* Review & Access Info Box */}
        <View style={styles.infoBox}>
          <View style={styles.infoBoxHeader}>
            <Ionicons name="shield-checkmark" size={18} color="#075B49" />
            <Text style={styles.infoBoxTitle}>Admission & Verification Status</Text>
          </View>
          <Text style={styles.infoBoxBody}>
            Sharah aur Idara ke qawaid o zawabit ki tameel ke tehat intizamia aapki darkhwast ka jaiza le rahi hai. Verification ke baad aapke darjaat ke asbaaq aur live classes activate ho jayenge.
          </Text>
        </View>

        {/* Verified Feature Highlights */}
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="videocam" size={16} color="#075B49" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureHeading}>Live Interactive Classes</Text>
              <Text style={styles.featureSub}>Muallimat ke saath parde ke ehtemam ke tehat dars</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="library" size={16} color="#C6A15B" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureHeading}>Recorded Lessons & Library</Text>
              <Text style={styles.featureSub}>Muntakhib kutub aur mehfooz audio asbaaq</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="chatbubbles" size={16} color="#075B49" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureHeading}>Teacher Q&A & Guidance</Text>
              <Text style={styles.featureSub}>Ilmi rehnumai aur sawal o jawab ki sahulat</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <Ionicons name="time" size={16} color="#C6A15B" />
            </View>
            <View style={styles.featureTextWrap}>
              <Text style={styles.featureHeading}>Prayer Times, Qibla & Quran</Text>
              <Text style={styles.featureSub}>Namaz ke auqat aur Qurani darsgah</Text>
            </View>
          </View>
        </View>

        {/* Academic Levels Badge Row */}
        <View style={styles.levelsContainer}>
          <Text style={styles.levelsEyebrow}>Academic Levels:</Text>
          <View style={styles.levelsRow}>
            {['Rabiya', 'Ula', 'Aaidadiya', 'Salisa', 'Qirat'].map((level) => (
              <View key={level} style={styles.levelBadge}>
                <Text style={styles.levelBadgeText}>{level}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons (CTAs) */}
        <View style={styles.actionButtonsRow}>
          {/* Primary CTA: Explore App */}
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={handleExplore}
            accessibilityRole="button"
            accessibilityLabel="Explore the App"
            activeOpacity={0.85}
            testID="welcome-card-explore-button"
          >
            <Ionicons name="compass-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.exploreButtonText}>Explore the App</Text>
          </TouchableOpacity>

          {/* Secondary CTA: Manual WhatsApp Contact */}
          <TouchableOpacity
            style={styles.whatsAppButton}
            onPress={handleWhatsAppContact}
            accessibilityRole="button"
            accessibilityLabel="WhatsApp par Rabta Karein"
            activeOpacity={0.85}
            testID="welcome-card-whatsapp-button"
          >
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 6 }} />
            <Text style={styles.whatsAppButtonText}>WhatsApp Helpline</Text>
          </TouchableOpacity>
        </View>

        {/* Disclaimer Note */}
        <Text style={styles.disclaimerText}>
          Rabta: {OFFICIAL_SENDER_NUMBER} • Jamia Darul Uloom Madrasatu-s-Salikat Lil Banat
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8DFD1',
    ...SHADOWS.card,
  },
  topGoldBar: {
    height: 4,
    backgroundColor: '#C6A15B',
    width: '100%',
  },
  cardContent: {
    padding: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.xs,
  },
  bismillahBox: {
    flex: 1,
  },
  bismillahText: {
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
    color: '#075B49',
    fontWeight: '700',
    textAlign: 'left',
  },
  salamText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
    color: '#C6A15B',
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F7FAFC',
  },
  greetingContainer: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C6A15B',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  studentNameTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#075B49',
    marginTop: 2,
    marginBottom: 4,
  },
  introParagraph: {
    fontSize: 13,
    color: '#4A5568',
    lineHeight: 19,
  },
  infoBox: {
    backgroundColor: '#F0F9F5',
    borderLeftWidth: 3,
    borderLeftColor: '#075B49',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.sm,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoBoxTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#075B49',
    marginLeft: 6,
  },
  infoBoxBody: {
    fontSize: 12,
    color: '#2D3748',
    lineHeight: 17,
  },
  featuresList: {
    marginVertical: SPACING.xs,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  featureTextWrap: {
    flex: 1,
  },
  featureHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2D3748',
  },
  featureSub: {
    fontSize: 11,
    color: '#718096',
  },
  levelsContainer: {
    marginTop: 6,
    marginBottom: SPACING.sm,
  },
  levelsEyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: '#718096',
    marginBottom: 4,
  },
  levelsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  levelBadge: {
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8DFD1',
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8C6D23',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  exploreButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#075B49',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    ...SHADOWS.card,
  },
  exploreButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  whatsAppButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#25D366',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  whatsAppButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#128C7E',
  },
  disclaimerText: {
    fontSize: 10,
    color: '#A0AEC0',
    textAlign: 'center',
    marginTop: 10,
  },
});
