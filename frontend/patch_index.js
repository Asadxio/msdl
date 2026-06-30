const fs = require('fs');
const file = 'app/(tabs)/index.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /headerOverlay: \{[\s\S]*?\},/,
  `headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 32,
    backgroundColor: "rgba(6,78,59,0.88)",
  },`
);

content = content.replace(
  /madrasaName: \{[\s\S]*?\},/,
  `madrasaName: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 34,
    marginTop: 6,
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },`
);

content = content.replace(
  /welcomeBanner: \{[\s\S]*?\},/,
  `welcomeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
    marginHorizontal: SPACING.lg,
    marginTop: -28,
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xxl,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
    ...SHADOWS.card,
    zIndex: 10,
  },`
);

content = content.replace(
  /welcomeAvatarCircle: \{[\s\S]*?\},/,
  `welcomeAvatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(212,175,55,0.1)",
    borderWidth: 2,
    borderColor: COLORS.goldBg,
    alignItems: "center",
    justifyContent: "center",
  },`
);

content = content.replace(
  /welcomeAvatarText: \{[\s\S]*?\},/,
  `welcomeAvatarText: {
    fontSize: 24,
    fontWeight: "900",
    color: COLORS.primary,
  },`
);

content = content.replace(
  /welcomeName: \{[\s\S]*?\},/,
  `welcomeName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.textMain,
    marginBottom: 6,
  },`
);

content = content.replace(
  /roleBadge: \{[\s\S]*?\},/,
  `roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },`
);

content = content.replace(
  /quickActionCard: \{[\s\S]*?\},/,
  `quickActionCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    paddingVertical: 18,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    ...SHADOWS.card,
    gap: 10,
  },`
);

content = content.replace(
  /quickActionIcon: \{[\s\S]*?\},/,
  `quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },`
);

content = content.replace(
  /quickActionLabel: \{[\s\S]*?\},/,
  `quickActionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.textMain,
    textAlign: "center",
  },`
);

content = content.replace(
  /courseCard: \{[\s\S]*?\},/,
  `courseCard: {
    borderRadius: RADIUS.xxl,
    overflow: "hidden",
    ...SHADOWS.card,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
  },`
);

content = content.replace(
  /courseCardContent: \{[\s\S]*?\},/,
  `courseCardContent: { padding: SPACING.lg, gap: 8 },`
);

content = content.replace(
  /courseCardName: \{[\s\S]*?\},/,
  `courseCardName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 4,
  },`
);

content = content.replace(
  /courseTeacherRow: \{[\s\S]*?\},/,
  `courseTeacherRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },`
);

content = content.replace(
  /courseTeacherName: \{[\s\S]*?\},/,
  `courseTeacherName: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: "600",
  },`
);

content = content.replace(
  /announcementCard: \{[\s\S]*?\},/,
  `announcementCard: {
    borderRadius: RADIUS.xxl,
    overflow: "hidden",
    ...SHADOWS.card,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.25)",
    backgroundColor: COLORS.surface,
  },`
);

content = content.replace(
  /announcementContent: \{[\s\S]*?\},/,
  `announcementContent: { padding: SPACING.xl },`
);

content = content.replace(
  /announcementTitle: \{[\s\S]*?\},/,
  `announcementTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.textMain,
    marginBottom: 10,
  },`
);

content = content.replace(
  /hadithCard: \{[\s\S]*?\},/,
  `hadithCard: {
    backgroundColor: "rgba(212,175,55,0.08)",
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.3)",
  },`
);

content = content.replace(
  /hadithIconCircle: \{[\s\S]*?\},/,
  `hadithIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(212,175,55,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },`
);

content = content.replace(
  /hadithText: \{[\s\S]*?\},/,
  `hadithText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textMain,
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: 12,
  },`
);

content = content.replace(
  /notifCard: \{[\s\S]*?\},/,
  `notifCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    ...SHADOWS.card,
  },`
);

// One tiny UI update to the actual component logic for featured courses wrapper
// If there's an outer wrapper, we update it. But replacing styles is safer.
fs.writeFileSync(file, content);
console.log('Styles patched');
