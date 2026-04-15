import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <Ionicons name={icon as any} size={22} color={COLORS.secondary} />
        <Text style={styles.sectionCardTitle}>{title}</Text>
      </View>
      <View style={styles.goldAccent} />
      {children}
    </View>
  );
}

export default function AboutScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>About Us</Text>
        <Text style={styles.headerSubtitle}>Madrasa Tus Salikat Lil Banat</Text>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="about-scroll"
      >
        {/* Bismillah */}
        <View style={styles.bismillahCard} testID="bismillah-section">
          <Text style={styles.bismillah}>بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</Text>
          <Text style={styles.bismillahTranslation}>
            In the name of Allah, the Most Gracious, the Most Merciful
          </Text>
        </View>

        {/* Introduction */}
        <SectionCard title="Introduction" icon="sparkles">
          <Text style={styles.bodyText} testID="introduction-text">
            Madrasa Tus Salikat Lil Banat is a distinguished institution dedicated to providing comprehensive Islamic education for women. Founded on the principles of the Quran and Sunnah, our Madrasa strives to cultivate knowledgeable, pious, and empowered Muslim women who can contribute positively to their families and communities.
          </Text>
          <Text style={styles.bodyText}>
            Our curriculum encompasses a wide range of Islamic sciences, from Quranic studies and Hadith to Islamic jurisprudence and Arabic language, ensuring a holistic and enriching learning experience.
          </Text>
        </SectionCard>

        {/* Vision */}
        <SectionCard title="Our Vision" icon="eye-outline">
          <Text style={styles.bodyText} testID="vision-text">
            To be a leading center of Islamic learning for women, producing scholars and educators who embody the teachings of Islam and inspire positive change in society. We envision a community where every Muslim woman has access to authentic Islamic knowledge and the tools to live a life of purpose and faith.
          </Text>
        </SectionCard>

        {/* Mission */}
        <SectionCard title="Our Mission" icon="flag-outline">
          <View style={styles.missionList} testID="mission-text">
            <View style={styles.missionItem}>
              <View style={styles.bullet} />
              <Text style={styles.missionText}>
                Provide authentic and comprehensive Islamic education rooted in the Quran and Sunnah
              </Text>
            </View>
            <View style={styles.missionItem}>
              <View style={styles.bullet} />
              <Text style={styles.missionText}>
                Nurture a love for learning and a deep connection with the Creator
              </Text>
            </View>
            <View style={styles.missionItem}>
              <View style={styles.bullet} />
              <Text style={styles.missionText}>
                Empower women with knowledge to become role models in their communities
              </Text>
            </View>
            <View style={styles.missionItem}>
              <View style={styles.bullet} />
              <Text style={styles.missionText}>
                Foster an environment of spiritual growth, discipline, and excellence
              </Text>
            </View>
            <View style={styles.missionItem}>
              <View style={styles.bullet} />
              <Text style={styles.missionText}>
                Preserve and transmit Islamic heritage to future generations
              </Text>
            </View>
          </View>
        </SectionCard>

        {/* Contact Info Placeholder */}
        <View style={styles.contactCard} testID="contact-section">
          <Ionicons name="mail-outline" size={24} color={COLORS.secondary} />
          <Text style={styles.contactTitle}>Get in Touch</Text>
          <Text style={styles.contactText}>
            For admissions and inquiries, please reach out to us through our official channels.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    ...SHADOWS.header,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 40,
    gap: SPACING.lg,
  },
  bismillahCard: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  bismillah: {
    fontSize: 28,
    color: COLORS.secondary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  bismillahTranslation: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.secondary,
    ...SHADOWS.card,
  },
  sectionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  sectionCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  goldAccent: {
    height: 2,
    backgroundColor: COLORS.secondary,
    width: 40,
    borderRadius: 1,
    marginBottom: SPACING.md,
    marginTop: 8,
  },
  bodyText: {
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 24,
    marginBottom: SPACING.sm,
  },
  missionList: {
    gap: SPACING.md,
  },
  missionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.secondary,
    marginTop: 7,
  },
  missionText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textMuted,
    lineHeight: 24,
  },
  contactCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 8,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  contactText: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
