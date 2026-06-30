const fs = require('fs');
const f = 'app/live-class/[id].tsx';
let content = fs.readFileSync(f, 'utf8');

content = content.replace(
  `<View style={styles.content}>
        <View style={styles.card}>
          <Ionicons name="videocam" size={64} color={COLORS.primary} style={styles.icon} />
          <Text style={styles.cardTitle}>Live Class is Active</Text>
          <Text style={styles.cardDesc}>
            Join the Google Meet classroom to participate in the session.
          </Text>`,
  `<View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusBadge}>
            <View style={styles.pulseDot} />
            <Text style={styles.statusBadgeText}>LIVE NOW</Text>
          </View>
          <Text style={styles.cardTitle}>{liveClass.title}</Text>
          
          <View style={styles.instructorCard}>
            <View style={styles.instructorAvatar}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.instructorLabel}>Instructor</Text>
              <Text style={styles.instructorName}>{liveClass.teacher_name}</Text>
            </View>
          </View>

          <Text style={styles.cardDesc}>
            The class is currently in session. Tap below to launch Google Meet and join the ongoing discussion.
          </Text>`
);

content = content.replace(
  `cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: 'bold', marginBottom: SPACING.sm, textAlign: 'center' },
  cardDesc: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginBottom: SPACING.xl },`,
  `cardTitle: { color: COLORS.textMain, fontSize: 26, fontWeight: '900', marginBottom: SPACING.lg, textAlign: 'center', lineHeight: 32 },
  cardDesc: { color: COLORS.textMuted, fontSize: 16, textAlign: 'center', marginBottom: SPACING.xxl, lineHeight: 24 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, marginBottom: SPACING.lg, gap: 6 },
  statusBadgeText: { color: COLORS.error, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error },
  instructorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, padding: SPACING.md, borderRadius: RADIUS.lg, width: '100%', marginBottom: SPACING.xl, gap: 12 },
  instructorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  instructorLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  instructorName: { fontSize: 16, color: COLORS.textMain, fontWeight: '800' },`
);

content = content.replace(
  `primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },`,
  `primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 18,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },`
);

content = content.replace(
  `primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },`,
  `primaryBtnText: { color: '#fff', fontSize: 18, fontWeight: '900' },`
);

fs.writeFileSync(f, content);
console.log('Live class details patched');
