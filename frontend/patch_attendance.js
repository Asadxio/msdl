const fs = require('fs');
const f = 'app/(tabs)/attendance.tsx';
let content = fs.readFileSync(f, 'utf8');

// 1. Fix subtitle bug
content = content.replace(
  `subtitle: { fontSize: 24, fontWeight: '800', color: COLORS.primary },`,
  `subtitle: { fontSize: 14, color: COLORS.textMuted, marginTop: 4 },`
);

// 2. Enhance Student Row Card UI (Marking)
content = content.replace(
  `rowCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.sm, flexDirection: 'row', alignItems: 'center', gap: 8, ...SHADOWS.card },`,
  `rowCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },`
);

content = content.replace(
  `presentBtn: { backgroundColor: '#DCFCE7', borderRadius: RADIUS.xxl, paddingVertical: 8, paddingHorizontal: 10 },
  absentBtn: { backgroundColor: '#FEE2E2', borderRadius: RADIUS.xxl, paddingVertical: 8, paddingHorizontal: 10 },
  presentText: { color: '#166534', fontWeight: '700', fontSize: 12 },
  absentText: { color: COLORS.error, fontWeight: '700', fontSize: 12 },`,
  `presentBtn: { backgroundColor: '#E8F5EE', borderRadius: RADIUS.full, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  absentBtn: { backgroundColor: '#FDECEC', borderRadius: RADIUS.full, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  presentText: { color: COLORS.primary, fontWeight: '800', fontSize: 13 },
  absentText: { color: COLORS.error, fontWeight: '800', fontSize: 13 },`
);

// 3. Enhance History Card UI
content = content.replace(
  `historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.sm, ...SHADOWS.card },`,
  `historyCard: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },`
);

content = content.replace(
  `<Text style={[styles.meta, item.status === 'present' ? { color: '#166534' } : { color: COLORS.error }]}>{item.status}</Text>`,
  `<View style={item.status === 'present' ? styles.badgePresent : styles.badgeAbsent}>
                <Text style={item.status === 'present' ? styles.badgeTextPresent : styles.badgeTextAbsent}>{item.status}</Text>
              </View>`
);

content = content.replace(
  `name: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, textTransform: 'capitalize' },`,
  `name: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  meta: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textTransform: 'capitalize' },`
);

const extraStyles = `
  badgePresent: { backgroundColor: '#E8F5EE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginTop: 4 },
  badgeAbsent: { backgroundColor: '#FDECEC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.sm, alignSelf: 'flex-start', marginTop: 4 },
  badgeTextPresent: { color: COLORS.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  badgeTextAbsent: { color: COLORS.error, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
`;
content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

fs.writeFileSync(f, content);
console.log('Attendance UI patched');
