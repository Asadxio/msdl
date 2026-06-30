const fs = require('fs');
const f = 'app/(tabs)/quiz.tsx';
let content = fs.readFileSync(f, 'utf8');

// Enhance Result Card (Phase 3)
content = content.replace(
  `<View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Your Score</Text>
            <Text style={styles.resultScore}>{result.score}/{result.total}</Text>
          </View>`,
  `<View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Your Score</Text>
            <Text style={styles.resultScore}>{result.score} / {result.total}</Text>
            {(() => {
              const pct = result.total > 0 ? Math.round((result.score / result.total) * 100) : 0;
              const passed = pct >= 60;
              return (
                <>
                  <View style={[styles.resultBadge, passed ? styles.resultBadgePass : styles.resultBadgeFail]}>
                    <Text style={[styles.resultBadgeText, passed ? styles.resultBadgeTextPass : styles.resultBadgeTextFail]}>
                      {passed ? 'Passed' : 'Needs Practice'}
                    </Text>
                  </View>
                  <Text style={styles.resultPct}>{pct}% Correct</Text>
                  <Text style={styles.resultSummary}>
                    You got {result.score} correct and {result.total - result.score} wrong.
                  </Text>
                  <Text style={styles.resultMessage}>
                    {passed ? 'Great job! You have a solid understanding of this topic.' : 'Keep learning and try again. You can do this!'}
                  </Text>
                </>
              );
            })()}
          </View>`
);

const extraStyles = `
  resultBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, marginBottom: 8 },
  resultBadgePass: { backgroundColor: '#E8F5EE' },
  resultBadgeFail: { backgroundColor: '#FDECEC' },
  resultBadgeText: { fontSize: 13, fontWeight: '800' },
  resultBadgeTextPass: { color: COLORS.primary },
  resultBadgeTextFail: { color: COLORS.error },
  resultPct: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  resultSummary: { fontSize: 14, color: COLORS.textMuted, marginBottom: 12 },
  resultMessage: { fontSize: 14, fontWeight: '600', color: COLORS.primary, textAlign: 'center', marginTop: 8 },
`;
content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

// Enhance Result answer cards UI (Phase 3)
content = content.replace(
  `answerCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.sm, gap: 4 },`,
  `answerCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, gap: 8, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card },`
);
content = content.replace(
  `answerQ: { color: COLORS.textMain, fontWeight: '700' },`,
  `answerQ: { color: COLORS.textMain, fontWeight: '800', fontSize: 15, marginBottom: 4 },`
);
content = content.replace(
  `answerLine: { color: COLORS.textMuted, fontSize: 12 },`,
  `answerLine: { color: COLORS.textMuted, fontSize: 13, fontWeight: '600' },`
);

fs.writeFileSync(f, content);
console.log('Quiz Result UI patched');
