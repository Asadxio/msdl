const fs = require('fs');
const f = 'app/admin/payments.tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.md, ...SHADOWS.card },`,
  `card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xxl, padding: SPACING.lg, ...SHADOWS.card, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },`
);

content = content.replace(
  `name: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
    meta: { fontSize: 13, color: COLORS.textMuted, marginTop: 3, textTransform: 'capitalize' },
    time: { fontSize: 11, color: COLORS.textMuted, marginTop: 6 },`,
  `name: { fontSize: 18, fontWeight: '800', color: COLORS.textMain, marginBottom: 2 },
    meta: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, textTransform: 'capitalize' },
    time: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },`
);

content = content.replace(
  `actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    verifyBtn: { flex: 1, backgroundColor: '#DCFCE7', borderRadius: RADIUS.xxl, paddingVertical: 10, alignItems: 'center' },
    verifyText: { color: '#166534', fontWeight: '700' },
    rejectBtn: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: RADIUS.xxl, paddingVertical: 10, alignItems: 'center' },
    disabledBtn: { opacity: 0.7 },
    rejectText: { color: COLORS.error, fontWeight: '700' },`,
  `actions: { flexDirection: 'row', gap: 12, marginTop: 14 },
    verifyBtn: { flex: 1, backgroundColor: '#E8F5EE', borderRadius: RADIUS.full, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    verifyText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },
    rejectBtn: { flex: 1, backgroundColor: '#FDECEC', borderRadius: RADIUS.full, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
    disabledBtn: { opacity: 0.5 },
    rejectText: { color: COLORS.error, fontWeight: '800', fontSize: 14 },`
);

fs.writeFileSync(f, content);
console.log('Admin Payments UI patched');
