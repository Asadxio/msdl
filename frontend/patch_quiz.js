const fs = require('fs');
const f = 'app/(tabs)/quiz.tsx';
let content = fs.readFileSync(f, 'utf8');

// 1. Fix headerSubtitle
content = content.replace(
  "subtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },",
  "subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },"
);

// 2. Improve Category List UI
content = content.replace(
  `categoryCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.xxl, 
    padding: SPACING.lg, 
    ...SHADOWS.card, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },`,
  `categoryCard: { 
    backgroundColor: COLORS.surface, 
    borderRadius: RADIUS.xxl, 
    padding: SPACING.xl, 
    ...SHADOWS.card, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },`
);
content = content.replace(
  "categoryCount: { fontSize: 13, fontWeight: '600', color: COLORS.primary, backgroundColor: COLORS.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },",
  "categoryCount: { fontSize: 13, fontWeight: '700', color: COLORS.primary, backgroundColor: '#E8F5EE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, overflow: 'hidden' },"
);

// 3. Improve Quiz Player Option Buttons & Progress
content = content.replace(
  `optionBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xxl, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: COLORS.surfaceAlt },`,
  `optionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.xxl, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: COLORS.surface },`
);
content = content.replace(
  `optionBtnActive: { borderColor: COLORS.primary, backgroundColor: '#EEF6F2' },`,
  `optionBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F4FAF6', borderWidth: 2 },`
);
content = content.replace(
  `optionText: { color: COLORS.textMain, fontSize: 14 },`,
  `optionText: { color: COLORS.textMain, fontSize: 15, flex: 1 },`
);
content = content.replace(
  `optionTextActive: { color: COLORS.primary, fontWeight: '700' },`,
  `optionTextActive: { color: COLORS.primary, fontWeight: '800' },`
);
content = content.replace(
  `btn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },`,
  `btn: {
    backgroundColor: COLORS.goldBg,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },`
);
content = content.replace(
  `btnText: { color: '#fff', fontWeight: '700' },`,
  `btnText: { color: COLORS.goldText, fontWeight: '800', fontSize: 15 },`
);
content = content.replace(
  `secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },`,
  `secondaryBtn: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },`
);
content = content.replace(
  `secondaryBtnText: { color: COLORS.textMain, fontWeight: '700' },`,
  `secondaryBtnText: { color: COLORS.textMain, fontWeight: '700', fontSize: 15 },`
);
content = content.replace(
  `questionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card, gap: 10 },`,
  `questionCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.xl, ...SHADOWS.card, gap: 12, borderWidth: 1, borderColor: COLORS.border },`
);
content = content.replace(
  `question: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },`,
  `question: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginBottom: 8, lineHeight: 26 },`
);
content = content.replace(
  `progress: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },`,
  `progress: { fontSize: 14, color: COLORS.primary, fontWeight: '800', marginBottom: 4 },`
);

// Result Card Update
content = content.replace(
  `resultScore: { fontSize: 28, color: COLORS.primary, fontWeight: '800' },`,
  `resultScore: { fontSize: 42, color: COLORS.primary, fontWeight: '900', marginVertical: 8 },`
);

// Also I want to change the Option component rendering to add a radio circle
content = content.replace(
  `{current?.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, picked === opt && styles.optionBtnActive]}
                onPress={() => setAnswers((p) => ({ ...p, [current.id]: opt }))}
              >
                <Text style={[styles.optionText, picked === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}`,
  `{current?.options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.optionBtn, picked === opt && styles.optionBtnActive]}
                onPress={() => setAnswers((p) => ({ ...p, [current.id]: opt }))}
                activeOpacity={0.7}
              >
                <View style={[styles.radioCircle, picked === opt && styles.radioCircleActive]}>
                  {picked === opt && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.optionText, picked === opt && styles.optionTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}`
);

const extraStyles = `
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
`;
content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

fs.writeFileSync(f, content);
console.log('Quiz UI patched');
