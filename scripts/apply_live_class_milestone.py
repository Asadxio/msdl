# -*- coding: utf-8 -*-
import os

# 1. Update agoraVoice.ts
agora_path = r'C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\lib\agoraVoice.ts'
with open(agora_path, 'r', encoding='utf-8') as f:
    agora_code = f.read()

agora_code = agora_code.replace('\r\n', '\n')

old_agora_audio = """      // Audio profile optimized for speech clarity in meetings/recitation
      try {
        this.engine.setAudioProfile?.(0, AudioScenarioType?.AudioScenarioMeeting ?? 8);
      } catch {}"""

new_agora_audio = """      // Audio profile optimized for speech clarity in meetings/recitation (Profile 1: SpeechStandard)
      try {
        this.engine.setAudioProfile?.(1, AudioScenarioType?.AudioScenarioMeeting ?? 8);
      } catch {}

      // AI Noise Suppression (Deep background fan, rustle, and room echo cancellation)
      try {
        if (typeof this.engine.setAINSMode === 'function') {
          this.engine.setAINSMode(true, 1);
        }
        if (typeof this.engine.setParameters === 'function') {
          // Speech enhancement and deep noise elimination
          this.engine.setParameters('{"che.audio.ains_mode": 1}');
          this.engine.setParameters('{"che.audio.ans.mode": 2}');
          // 2G/3G Packet Loss Concealment (PLC) & Adaptive Low-Bandwidth Resilience
          this.engine.setParameters('{"che.audio.neteq.plc_enabled": true}');
          this.engine.setParameters('{"che.audio.low_bitrate_mode": true}');
        }
      } catch (noiseErr) {
        console.warn('[AgoraVoice] Noise suppression setup fallback:', noiseErr);
      }"""

if old_agora_audio in agora_code:
    agora_code = agora_code.replace(old_agora_audio, new_agora_audio)
    with open(agora_path, 'w', encoding='utf-8') as f:
        f.write(agora_code)
    print("agoraVoice.ts updated successfully!")
else:
    print("agoraVoice.ts anchor not found!")

# 2. Update TajweedBoard.tsx with Color Tool Palette
tajweed_path = r'C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\components\classroom\TajweedBoard.tsx'
with open(tajweed_path, 'r', encoding='utf-8') as f:
    tajweed_code = f.read()

tajweed_code = tajweed_code.replace('\r\n', '\n')

old_tajweed_comp = """export const TajweedBoard: React.FC<TajweedBoardProps> = ({
  viewMode,
  isTeacher,
  highlightedWords,
  currentAyahOrPage,
  onViewModeChange,
  onToggleHighlight,
  onSelectMakhraj,
}) => {"""

new_tajweed_comp = """const TAJWEED_RULES = [
  { id: 'ghunnah', label: 'Ghunnah / Ikhfa', arabic: 'غُنَّة', color: '#059669' },
  { id: 'qalqalah', label: 'Qalqalah', arabic: 'قلقلة', color: '#2563EB' },
  { id: 'madd', label: 'Madd', arabic: 'مَدّ', color: '#DC2626' },
  { id: 'idgham', label: 'Idgham', arabic: 'إدغام', color: '#D97706' },
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
  const [activeRuleId, setActiveRuleId] = useState<string>('ghunnah');"""

if old_tajweed_comp in tajweed_code:
    tajweed_code = tajweed_code.replace(old_tajweed_comp, new_tajweed_comp)
    print("TajweedBoard component updated with activeRuleId state.")

# Add Teacher Palette UI in mushafBox
old_mushaf_header = """          <View style={styles.mushafHeader}>
            <Text style={styles.mushafTitle}>{displayMushafHeader}</Text>
            {isTeacher && <Text style={styles.teacherHint}>Tap a word to highlight for students</Text>}
          </View>"""

new_mushaf_header = """          <View style={styles.mushafHeader}>
            <Text style={styles.mushafTitle}>{displayMushafHeader}</Text>
            {isTeacher && <Text style={styles.teacherHint}>Select rule & tap word to highlight</Text>}
          </View>

          {/* Teacher Tajweed Rule Palette Bar */}
          {isTeacher && (
            <View style={styles.tajweedPaletteRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
                {TAJWEED_RULES.map((rule) => {
                  const isActive = activeRuleId === rule.id;
                  return (
                    <TouchableOpacity
                      key={rule.id}
                      style={[
                        styles.paletteChip,
                        { borderColor: rule.color },
                        isActive && { backgroundColor: rule.color },
                      ]}
                      onPress={() => setActiveRuleId(rule.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.paletteDot, { backgroundColor: isActive ? '#FFFFFF' : rule.color }]} />
                      <Text style={[styles.paletteChipText, isActive ? { color: '#FFFFFF' } : { color: rule.color }]}>
                        {rule.label} ({rule.arabic})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}"""

if old_mushaf_header in tajweed_code:
    tajweed_code = tajweed_code.replace(old_mushaf_header, new_mushaf_header)
    print("TajweedBoard palette row added.")

# Add Palette Styles
new_palette_styles = """  tajweedPaletteRow: {
    marginBottom: SPACING.sm,
    paddingBottom: 4,
  },
  paletteScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  paletteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
  },
  paletteDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  paletteChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});"""

if '\n});' in tajweed_code:
    tajweed_code = tajweed_code.replace('\n});', '\n' + new_palette_styles)
    print("TajweedBoard styles added.")

with open(tajweed_path, 'w', encoding='utf-8') as f:
    f.write(tajweed_code)

print("Saved TajweedBoard.tsx successfully!")
