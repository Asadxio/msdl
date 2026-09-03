import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { FATAWA_CATEGORIES, FatawaQuestion } from '@/lib/fatawa';
import { isFatwaBookmarked, toggleFatwaBookmark } from '@/lib/fatawaBookmarks';
import { goBackOrReplace } from '@/lib/navigation';

export default function FatawaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [question, setQuestion] = useState<FatawaQuestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    isFatwaBookmarked(id).then(setBookmarked);

    const unsub = onSnapshot(doc(db, 'fatawa_questions', id), (docSnap) => {
      if (docSnap.exists()) {
        setQuestion(docSnap.data() as FatawaQuestion);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  const handleBookmarkToggle = async () => {
    if (!id) return;
    const newState = await toggleFatwaBookmark(id);
    setBookmarked(newState);
    Alert.alert(
      newState ? 'Bookmarked' : 'Bookmark Removed',
      newState
        ? 'This fatwa has been added to your saved rulings.'
        : 'This fatwa has been removed from your saved rulings.'
    );
  };

  const handleCopyFatwa = async () => {
    if (!question) return;
    const textToCopy =
      'Dar-ul-Iftaa — Madrasatu-s-Salikat Lil Banat\n\n' +
      'Title: ' + question.title + '\n' +
      'Question: ' + question.question + '\n\n' +
      'Answer: ' + (question.answer || 'Under Review') + '\n\n' +
      'Reference: ' + (question.reference_kitab || 'Fiqh Reference') + '\n' +
      'Verified By: ' + (question.answered_by_name || 'Faculty') + '\n\n' +
      'Wallahu Ta\'ala A\'lam bi-s-Sawab';
    await Clipboard.setStringAsync(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
    Alert.alert('Copied', 'The fatwa text has been copied to your clipboard.');
  };

  const handleShareFatwa = async () => {
    if (!question) return;
    const shareMessage =
      'Dar-ul-Iftaa — Madrasatu-s-Salikat Lil Banat\n\n' +
      'Topic: ' + question.title + '\n' +
      'Question: ' + question.question + '\n\n' +
      'Answer: ' + (question.answer || 'Under Review') + '\n\n' +
      'Reference: ' + (question.reference_kitab || 'Fiqh Reference') + '\n\n' +
      'Wallahu Ta\'ala A\'lam bi-s-Sawab\nMadrasatu-s-Salikat Lil Banat App';
    try {
      await Share.share({
        message: shareMessage,
        title: question.title,
      });
    } catch {}
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading fatwa...</Text>
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color="#94A3B8" />
        <Text style={styles.notFoundText}>The requested fatwa could not be found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => goBackOrReplace(router, '/fatawa')}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cat = FATAWA_CATEGORIES[question.category] || FATAWA_CATEGORIES.general;
  const isAnswered = question.status === 'answered';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => goBackOrReplace(router, '/fatawa')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>DAR-UL-IFTAA VERDICT</Text>
          <Text style={styles.headerTitle}>Dar-ul-Iftaa Fatwa View</Text>
        </View>
        <View style={styles.headerActionBtns}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleBookmarkToggle}
            accessibilityLabel="Bookmark fatwa"
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={bookmarked ? '#C8A84E' : '#FFFFFF'}
            />
          </TouchableOpacity>
          {isAnswered && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleShareFatwa}
              accessibilityLabel="Share fatwa"
            >
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Category & Status Bar */}
        <View style={styles.metaRow}>
          <View style={styles.catPill}>
            <Ionicons name={cat.icon as any} size={14} color={COLORS.primary} />
            <Text style={styles.catPillText}>{cat.arabicTitle}</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              isAnswered ? styles.statusPillAnswered : styles.statusPillPending,
            ]}
          >
            <Ionicons
              name={isAnswered ? 'checkmark-circle' : 'time-outline'}
              size={14}
              color={isAnswered ? '#007A58' : '#B45309'}
            />
            <Text
              style={[
                styles.statusPillText,
                isAnswered ? styles.statusPillTextAnswered : styles.statusPillTextPending,
              ]}
            >
              {isAnswered ? 'Official Shariah Ruling Issued' : 'Under Review / Active Research'}
            </Text>
          </View>
        </View>

        {/* Question Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderStrip}>
            <Ionicons name="help-circle" size={18} color="#005F46" />
            <Text style={styles.cardHeaderLabel}>The Question:</Text>
          </View>
          <Text style={styles.questionTitle}>{question.title}</Text>
          <Text style={styles.questionBody}>{question.question}</Text>
        </View>

        {/* Answer / Fatwa Card */}
        {isAnswered ? (
          <View style={styles.fatwaCard}>
            <View style={styles.fatwaHeader}>
              <View style={styles.sealIcon}>
                <Ionicons name="ribbon" size={22} color="#C8A84E" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fatwaArabicHeading}>The Shariah Ruling & Verdict</Text>
                <Text style={styles.fatwaSub}>
                  Verified By: {question.answered_by_name || 'Faculty Scholar'}
                </Text>
              </View>
            </View>

            <View style={styles.fatwaBodyBox}>
              <Text style={styles.fatwaText}>{question.answer}</Text>
            </View>

            {/* Reference */}
            {question.reference_kitab && (
              <View style={styles.referenceRow}>
                <Ionicons name="bookmarks-outline" size={16} color="#C8A84E" />
                <Text style={styles.referenceLabel}>Juristic Reference:</Text>
                <Text style={styles.referenceValue}>{question.reference_kitab}</Text>
              </View>
            )}

            {/* Action Bar (Copy & Share) */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleCopyFatwa}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={COLORS.primary}
                />
                <Text style={styles.actionBtnText}>
                  {copied ? 'Copied ✓' : 'Copy Text'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnShare]}
                onPress={handleShareFatwa}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={16} color="#FFFFFF" />
                <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                  Share Ruling
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.fatwaFooter}>
              <Text style={styles.wallahuAlam}>And Allah Ta'ala Knows Best</Text>
            </View>
          </View>
        ) : (
          <View style={styles.pendingNoticeCard}>
            <Ionicons name="hourglass-outline" size={36} color="#B45309" />
            <Text style={styles.pendingNoticeTitle}>Question Under Review</Text>
            <Text style={styles.pendingNoticeBody}>
              Your question is currently being reviewed in light of authentic Fiqh sources. You will be notified here as soon as the verdict is issued.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  notFoundText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: 12,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusPillPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPillAnswered: {
    backgroundColor: '#DCFCE7',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPillTextPending: {
    color: '#B45309',
  },
  statusPillTextAnswered: {
    color: '#007A58',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 8,
    ...SHADOWS.card,
  },
  cardHeaderStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  cardHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  questionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  questionBody: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  fatwaCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: '#C8A84E',
    gap: 10,
    ...SHADOWS.card,
  },
  fatwaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  sealIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#003D2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fatwaArabicHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: '#005F46',
  },
  fatwaSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  fatwaBodyBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#C8A84E',
  },
  fatwaText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 22,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: RADIUS.sm,
  },
  referenceLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  referenceValue: {
    fontSize: 11,
    color: '#78350F',
    fontWeight: '600',
    flex: 1,
  },
  actionBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    gap: 6,
  },
  actionBtnShare: {
    backgroundColor: '#005F46',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  fatwaFooter: {
    alignItems: 'center',
    marginTop: 6,
  },
  wallahuAlam: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  pendingNoticeCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.xl,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  pendingNoticeBody: {
    fontSize: 12,
    color: '#78350F',
    textAlign: 'center',
    lineHeight: 18,
  },
});
