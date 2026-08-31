import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';

export type TajweedBoardView = 'mushaf' | 'makharij' | 'whiteboard' | 'notes';

interface TajweedBoardProps {
  viewMode: TajweedBoardView;
  isTeacher: boolean;
  highlightedWords: string[];
  currentAyahOrPage: string | number;
  onViewModeChange?: (mode: TajweedBoardView) => void;
  onToggleHighlight?: (word: string) => void;
  onSelectMakhraj?: (region: string) => void;
}

const MAKHARIJ_REGIONS = [
  { id: 'halq', name: 'Al-Halq (الحلق)', desc: 'Throat letters: ء, ه, ع, ح, غ, خ', color: '#B45309' },
  { id: 'lisan', name: 'Al-Lisan (اللسان)', desc: 'Tongue letters: ق, ك, ج, ش, ي, ض, ل, ن, ر, ط, د, ت, ص, ز, س, ظ, ذ, ث', color: '#047857' },
  { id: 'shafatain', name: 'Ash-Shafatain (الشفتان)', desc: 'Lips letters: ف, و, ب, م', color: '#1D4ED8' },
  { id: 'jawf', name: 'Al-Jawf (الجوف)', desc: 'Empty space (Madd letters): ا, و, ي', color: '#7C3AED' },
  { id: 'khayshoom', name: 'Al-Khayshoom (الخيشوم)', desc: 'Nasal cavity (Ghunnah): نّ, مّ', color: '#C026D3' },
];

const SAMPLE_AYAH_WORDS = [
  { text: 'بِسْمِ', tajweed: 'normal' },
  { text: 'ٱللَّهِ', tajweed: 'madd' },
  { text: 'ٱلرَّحْمَٰنِ', tajweed: 'normal' },
  { text: 'ٱلرَّحِيمِ', tajweed: 'madd' },
  { text: 'ٱلْحَمْدُ', tajweed: 'normal' },
  { text: 'لِلَّهِ', tajweed: 'normal' },
  { text: 'رَبِّ', tajweed: 'normal' },
  { text: 'ٱلْعَٰلَمِينَ', tajweed: 'madd' },
  { text: 'إِيَّاكَ', tajweed: 'normal' },
  { text: 'نَعْبُدُ', tajweed: 'normal' },
  { text: 'وَإِيَّاكَ', tajweed: 'normal' },
  { text: 'نَسْتَعِينُ', tajweed: 'madd' },
];

export const TajweedBoard: React.FC<TajweedBoardProps> = ({
  viewMode,
  isTeacher,
  highlightedWords,
  currentAyahOrPage,
  onViewModeChange,
  onToggleHighlight,
  onSelectMakhraj,
}) => {
  return (
    <View style={styles.container}>
      {/* Board Mode Switcher */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'mushaf' && styles.modeTabActive]}
          onPress={() => isTeacher && onViewModeChange?.('mushaf')}
          disabled={!isTeacher}
        >
          <Ionicons name="book-outline" size={14} color={viewMode === 'mushaf' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.modeTabText, viewMode === 'mushaf' && styles.modeTabTextActive]}>Mushaf Page</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'makharij' && styles.modeTabActive]}
          onPress={() => isTeacher && onViewModeChange?.('makharij')}
          disabled={!isTeacher}
        >
          <Ionicons name="mic-circle-outline" size={14} color={viewMode === 'makharij' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.modeTabText, viewMode === 'makharij' && styles.modeTabTextActive]}>Makhārij Diagram</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, viewMode === 'whiteboard' && styles.modeTabActive]}
          onPress={() => isTeacher && onViewModeChange?.('whiteboard')}
          disabled={!isTeacher}
        >
          <Ionicons name="easel-outline" size={14} color={viewMode === 'whiteboard' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.modeTabText, viewMode === 'whiteboard' && styles.modeTabTextActive]}>Tajweed Notes</Text>
        </TouchableOpacity>
      </View>

      {/* Main View Area */}
      {viewMode === 'mushaf' && (
        <View style={styles.mushafBox}>
          <View style={styles.mushafHeader}>
            <Text style={styles.mushafTitle}>Surah Al-Fatihah (الفاتحة) — Ayah {currentAyahOrPage}</Text>
            {isTeacher && <Text style={styles.teacherHint}>Tap a word to highlight for students</Text>}
          </View>
          <View style={styles.arabicFlow}>
            {SAMPLE_AYAH_WORDS.map((w, idx) => {
              const isHigh = highlightedWords.includes(w.text);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.wordPill,
                    w.tajweed === 'madd' && styles.wordMadd,
                    isHigh && styles.wordHighlighted,
                  ]}
                  onPress={() => isTeacher && onToggleHighlight?.(w.text)}
                  disabled={!isTeacher}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.arabicText, isHigh && styles.arabicTextHighlighted]}>{w.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Tajweed Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: COLORS.secondary }]} />
              <Text style={styles.legendText}>Ghunnah / Madd</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendText}>Ikhfa / Idgham</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.legendText}>Qalqalah</Text>
            </View>
          </View>
        </View>
      )}

      {viewMode === 'makharij' && (
        <ScrollView style={styles.makharijScroll} contentContainerStyle={styles.makharijContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionHeading}>Makhārij al-Hurūf (مخارج الحروف) — Articulation Points</Text>
          <Text style={styles.sectionSub}>Select an articulation region to review the origin of Arabic phonetics:</Text>
          {MAKHARIJ_REGIONS.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.makhrajCard, { borderLeftColor: r.color }]}
              onPress={() => isTeacher && onSelectMakhraj?.(r.id)}
              activeOpacity={0.8}
            >
              <View style={styles.makhrajHeader}>
                <Text style={[styles.makhrajName, { color: r.color }]}>{r.name}</Text>
                <Ionicons name="sparkles" size={14} color={r.color} />
              </View>
              <Text style={styles.makhrajDesc}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {viewMode === 'whiteboard' && (
        <View style={styles.whiteboardBox}>
          <View style={styles.whiteboardHeader}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.whiteboardTitle}>Classroom Instruction Notes</Text>
          </View>
          <View style={styles.noteItem}>
            <Text style={styles.noteBullet}>•</Text>
            <Text style={styles.noteText}>
              <Text style={{ fontWeight: '700' }}>Purdah Standard:</Text> Female students participate via pure Quranic audio recitation. Video cameras remain permanently disabled for complete modesty.
            </Text>
          </View>
          <View style={styles.noteItem}>
            <Text style={styles.noteBullet}>•</Text>
            <Text style={styles.noteText}>
              <Text style={{ fontWeight: '700' }}>Tilawat Protocol:</Text> Students tap "Raise Hand for Tilawat" to enter the recitation queue. The Ustaadha grants individual turn.
            </Text>
          </View>
          <View style={styles.noteItem}>
            <Text style={styles.noteBullet}>•</Text>
            <Text style={styles.noteText}>
              <Text style={{ fontWeight: '700' }}>Makhraj Precision:</Text> Focus on throat articulation (Al-Halq) and tongue elevation (Isti'la) during today's session.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 3,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  modeTabActive: {
    backgroundColor: COLORS.surface,
  },
  modeTabText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  modeTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  mushafBox: {
    backgroundColor: '#FDFBF7',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#EFE6D5',
  },
  mushafHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6D5',
    paddingBottom: 6,
  },
  mushafTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A5D00',
  },
  teacherHint: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  arabicFlow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.sm,
  },
  wordPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#EFE6D5',
  },
  wordMadd: {
    borderColor: '#F59E0B',
    backgroundColor: '#FEF3C7',
  },
  wordHighlighted: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    transform: [{ scale: 1.05 }],
  },
  arabicText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  arabicTextHighlighted: {
    color: '#065F46',
    fontWeight: 'bold',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE6D5',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  makharijScroll: {
    maxHeight: 220,
  },
  makharijContent: {
    paddingVertical: 4,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 2,
  },
  sectionSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  makhrajCard: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: 6,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  makhrajHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  makhrajName: {
    fontSize: 12,
    fontWeight: '700',
  },
  makhrajDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  whiteboardBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  whiteboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: SPACING.sm,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  whiteboardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  noteItem: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  noteBullet: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  noteText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    flex: 1,
    lineHeight: 16,
  },
});
