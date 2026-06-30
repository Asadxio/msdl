const fs = require('fs');
const f = 'app/recordings.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.card,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },`,
  `card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },`
);

content = content.replace(
  `cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  cardMeta: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  cardDesc: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },`,
  `cardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 2 },
  cardMeta: { fontSize: 13, color: COLORS.primary, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.textMuted },`
);

content = content.replace(
  `playBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  downloadBtn: { paddingHorizontal: 8, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 2 },
  downloadText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },`,
  `playBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center', gap: 4 },
  downloadBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center', gap: 4 },
  downloadText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },`
);

fs.writeFileSync(f, content);
console.log('Recordings UI patched');
