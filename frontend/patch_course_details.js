const fs = require('fs');
const f = 'app/course/[id].tsx';
let content = fs.readFileSync(f, 'utf8');

// 1. Progress Summary Card
const progressSummaryHTML = `
        <View style={styles.body}>
          {safeProgress && (
            <View style={styles.progressSummaryCard}>
              <View style={styles.progressSummaryHeader}>
                <Text style={styles.progressSummaryTitle}>Your Progress</Text>
                {(() => {
                  const total = safeModules.reduce((acc, m) => acc + (Array.isArray(getLessonsForModule(m.id)) ? getLessonsForModule(m.id).length : 0), 0);
                  const completed = Object.values(safeProgress).filter(p => p?.completed).length;
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <View style={{ width: '100%' }}>
                      {pct === 100 && (
                        <View style={styles.completedBadgeLarge}>
                          <Ionicons name="trophy" size={14} color="#FFFFFF" />
                          <Text style={styles.completedBadgeLargeText}>Completed</Text>
                        </View>
                      )}
                      <View style={{ width: '100%', marginTop: SPACING.sm }}>
                        <View style={styles.progressSummaryTrack}>
                          <View style={[styles.progressSummaryFill, { width: \`\${Math.min(100, pct)}%\` }]} />
                        </View>
                        <View style={styles.progressSummaryStats}>
                          <Text style={styles.progressSummaryStatText}>{completed} completed</Text>
                          <Text style={styles.progressSummaryStatText}>{pct}%</Text>
                          <Text style={styles.progressSummaryStatText}>{Math.max(0, total - completed)} remaining</Text>
                        </View>
                      </View>
                    </View>
                  );
                })()}
              </View>
            </View>
          )}`;

content = content.replace(
  `<View style={styles.body}>`,
  progressSummaryHTML
);

// 2. Improve Lesson Card UI
content = content.replace(/lessonRow: \{[\s\S]*?backgroundColor: COLORS\.surfaceAlt,[\s\S]*?marginTop: 8,\r?\n\s*\}/m, `lessonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xxl,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    marginTop: 8,
    ...SHADOWS.card,
  }`);
  
content = content.replace(/lessonRowDone: \{ borderColor: "#CFE9DB", backgroundColor: "#F7FBF9" \},/m, `lessonRowDone: { borderColor: COLORS.primary, backgroundColor: "#F4FAF6" },`);

// 3. Improve Hero UI
content = content.replace(/height: 270/g, `height: 300`);
content = content.replace(/backgroundColor: "rgba\(6,78,59,0\.68\)"/g, `backgroundColor: "rgba(0,0,0,0.4)"`);

content = content.replace(
  `<View style={styles.heroGradient} />`,
  `<View style={styles.heroGradient} /><View style={styles.heroGradientBottom} />`
);

content = content.replace(/heroTitle: \{ color: "#fff", fontSize: 26, fontWeight: "800" \}/g, `heroTitle: { color: "#fff", fontSize: 28, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 }`);

// 4. Add Progress Styles
const extraStyles = `
  heroGradientBottom: {
    position: "absolute",
    left: 0, right: 0, bottom: 0, height: "60%",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  progressSummaryCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, borderWidth: 1, borderColor: COLORS.border, ...SHADOWS.card, marginBottom: SPACING.md },
  progressSummaryHeader: { alignItems: 'flex-start', width: '100%' },
  progressSummaryTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 4 },
  completedBadgeLarge: { position: 'absolute', top: -30, right: 0, backgroundColor: COLORS.goldText, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, gap: 4 },
  completedBadgeLargeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  progressSummaryTrack: { height: 8, borderRadius: 4, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden', width: '100%' },
  progressSummaryFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.primary },
  progressSummaryStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  progressSummaryStatText: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },`;

content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

fs.writeFileSync(f, content);
console.log('course details patched correctly');
