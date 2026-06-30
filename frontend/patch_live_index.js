const fs = require('fs');
const f = 'app/live-class/index.tsx';
let content = fs.readFileSync(f, 'utf8');

// Phase 1 - Upcoming Classes (Cards, Status Badge, Spacing, Typography)
content = content.replace(
  `classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },`,
  `classCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
    marginBottom: SPACING.sm,
  },`
);
content = content.replace(
  `classTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textMain,
    marginBottom: SPACING.xs,
  },`,
  `classTitle: {
    ...TYPOGRAPHY.heading,
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textMain,
    marginBottom: SPACING.sm,
    lineHeight: 28,
  },`
);
content = content.replace(
  `infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },`,
  `infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },`
);
content = content.replace(
  `infoText: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },`,
  `infoText: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '600',
  },`
);
content = content.replace(
  `joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    marginTop: SPACING.md,
  },`,
  `joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.lg,
    marginTop: SPACING.lg,
  },`
);
content = content.replace(
  `joinBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },`,
  `joinBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },`
);
content = content.replace(
  `upcomingBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },`,
  `upcomingBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
  },`
);
content = content.replace(
  `upcomingBtnText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },`,
  `upcomingBtnText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '800',
  },`
);
content = content.replace(
  `badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },`,
  `badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },`
);
content = content.replace(
  `badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },`,
  `badgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },`
);
// Make Active Card visually pop more
content = content.replace(
  `classCardActive: {
    borderColor: 'rgba(6, 78, 59, 0.2)',
  },`,
  `classCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F4FAF6',
    borderWidth: 2,
  },`
);

fs.writeFileSync(f, content);
console.log('Live class index patched');
