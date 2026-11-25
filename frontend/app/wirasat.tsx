import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  DEFAULT_WIRASAT_INPUTS,
  WirasatInputs,
  calculateWirasat,
} from '@/lib/wirasatService';

type TabMode = 'calculator' | 'guide';

const MIRATH_RULES = [
  {
    title: '1. Settlement Order Before Inheritance',
    body: 'According to consensus of Fiqh (Surah An-Nisa 4:11): (1) Funeral & burial expenses, (2) Paying off all unpaid debts including Mahr, (3) Fulfilling valid Wasiyyah up to 1/3rd for non-heirs, (4) Distributing the remaining net estate.',
  },
  {
    title: '2. Ashab al-Furud (Fixed Qur’anic Shares)',
    body: 'Spouses, parents, daughters (when no son), and sisters (in Kalalah) have strictly defined Qur’anic fractions: 1/2, 1/4, 1/8, 2/3, 1/3, and 1/6.',
  },
  {
    title: '3. ’Asabah (Residuary Heirs)',
    body: 'After fixed shares are paid, sons (with daughters taking half of a son’s share), father (if no sons), or full brothers inherit the remaining residue.',
  },
  {
    title: '4. Hijab (Blocking Rules)',
    body: 'Presence of a Son or Father blocks full siblings from inheriting; Mother’s share shifts from 1/3 to 1/6 when children or two or more siblings exist.',
  },
];

export default function WirasatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [activeTab, setActiveTab] = useState<TabMode>('calculator');
  const [inputs, setInputs] = useState<WirasatInputs>(DEFAULT_WIRASAT_INPUTS);
  const [estateText, setEstateText] = useState(String(DEFAULT_WIRASAT_INPUTS.estateAmount));
  const [debtsText, setDebtsText] = useState('0');
  const [wasiyyahText, setWasiyyahText] = useState('0');

  const computed = useMemo(() => {
    return calculateWirasat({
      ...inputs,
      estateAmount: Math.max(0, Number(estateText.replace(/,/g, '')) || 0),
      funeralAndDebts: Math.max(0, Number(debtsText.replace(/,/g, '')) || 0),
      wasiyyahAmount: Math.max(0, Number(wasiyyahText.replace(/,/g, '')) || 0),
    });
  }, [inputs, estateText, debtsText, wasiyyahText]);

  const stepCount = (
    key: 'sonsCount' | 'daughtersCount' | 'fullBrothersCount' | 'fullSistersCount',
    delta: number
  ) => {
    setInputs((prev) => ({
      ...prev,
      [key]: Math.max(0, (prev[key] || 0) + delta),
    }));
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.primaryDeep }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerAr}>عِلْمُ الْفَرَائِضِ وَالْمِيرَاث</Text>
          <Text style={styles.headerTitle}>Wirasat (Mirath) Guide</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'calculator' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('calculator')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'calculator' ? '#FFFFFF' : colors.text }]}>
            Mirath Calculator
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'guide' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('guide')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'guide' ? '#FFFFFF' : colors.text }]}>
            Qur’anic Rules
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'calculator' ? (
          <>
            <View style={[styles.heroCard, { backgroundColor: isDark ? '#064E3B' : '#045E44' }]}>
              <Text style={styles.heroLabel}>NET DISTRIBUTABLE ESTATE</Text>
              <Text style={styles.heroValue}>{computed.netEstate.toLocaleString()}</Text>
              {(computed.wasiyyahCapped || computed.awlApplied || computed.raddApplied) && (
                <Text style={styles.heroSub}>
                  {computed.wasiyyahCapped ? 'Wasiyyah capped at max 1/3 • ' : ''}
                  {computed.awlApplied ? "'Awl proportional reduction applied • " : ''}
                  {computed.raddApplied ? 'Radd redistribution applied' : ''}
                </Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Estate & Deductions</Text>
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : colors.background }]}
                keyboardType="decimal-pad"
                placeholder="Total Estate Value"
                placeholderTextColor={colors.textMuted}
                value={estateText}
                onChangeText={setEstateText}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : colors.background }]}
                  keyboardType="decimal-pad"
                  placeholder="Debts & Funeral"
                  placeholderTextColor={colors.textMuted}
                  value={debtsText}
                  onChangeText={setDebtsText}
                />
                <TextInput
                  style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : colors.background }]}
                  keyboardType="decimal-pad"
                  placeholder="Wasiyyah (≤1/3)"
                  placeholderTextColor={colors.textMuted}
                  value={wasiyyahText}
                  onChangeText={setWasiyyahText}
                />
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Surviving Heirs</Text>

              <View style={styles.rowBetween}>
                <Text style={[styles.label, { color: colors.text }]}>Deceased Gender</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(['male', 'female'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.toggleChip, { backgroundColor: inputs.deceasedGender === g ? colors.primary : colors.background, borderColor: colors.border }]}
                      onPress={() => setInputs((p) => ({ ...p, deceasedGender: g }))}
                    >
                      <Text style={{ color: inputs.deceasedGender === g ? '#FFFFFF' : colors.text, fontWeight: '700', fontSize: 12 }}>
                        {g === 'male' ? 'Husband (Male)' : 'Wife (Female)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(
                [
                  { key: 'hasSpouse', label: inputs.deceasedGender === 'male' ? 'Surviving Wife' : 'Surviving Husband' },
                  { key: 'fatherAlive', label: 'Father Alive' },
                  { key: 'motherAlive', label: 'Mother Alive' },
                ] as const
              ).map((item) => {
                const active = inputs[item.key];
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.rowBetween}
                    onPress={() => setInputs((p) => ({ ...p, [item.key]: !p[item.key] }))}
                  >
                    <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={active ? colors.primary : colors.textMuted}
                    />
                  </TouchableOpacity>
                );
              })}

              {(
                [
                  { key: 'sonsCount', label: 'Sons' },
                  { key: 'daughtersCount', label: 'Daughters' },
                  { key: 'fullBrothersCount', label: 'Full Brothers' },
                  { key: 'fullSistersCount', label: 'Full Sisters' },
                ] as const
              ).map((st) => (
                <View key={st.key} style={styles.rowBetween}>
                  <Text style={[styles.label, { color: colors.text }]}>{st.label}</Text>
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={[styles.stepBtn, { borderColor: colors.border }]}
                      onPress={() => stepCount(st.key, -1)}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.stepVal, { color: colors.text }]}>{inputs[st.key]}</Text>
                    <TouchableOpacity
                      style={[styles.stepBtn, { borderColor: colors.border }]}
                      onPress={() => stepCount(st.key, 1)}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            {/* Output Shares */}
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 4 }]}>
              Distribution Breakdown
            </Text>
            {computed.shares.length === 0 ? (
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Select at least one surviving heir to calculate Qur’anic shares.
              </Text>
            ) : (
              computed.shares.map((row) => (
                <View
                  key={row.heir}
                  style={[styles.shareCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.rowBetween}>
                    <Text style={[styles.shareHeir, { color: colors.text }]}>
                      {row.heir} {row.count > 1 ? `(×${row.count})` : ''}
                    </Text>
                    <Text style={[styles.sharePct, { color: colors.primary }]}>
                      {row.percentage}% ({row.fractionLabel})
                    </Text>
                  </View>
                  <Text style={[styles.shareAmt, { color: colors.goldText }]}>
                    Total: {row.totalAmount.toLocaleString()}
                    {row.count > 1 ? ` • Each: ${row.perHeirAmount.toLocaleString()}` : ''}
                  </Text>
                  <Text style={[styles.shareBasis, { color: colors.textSecondary }]}>{row.ruleBasis}</Text>
                </View>
              ))
            )}
          </>
        ) : (
          MIRATH_RULES.map((r) => (
            <View
              key={r.title}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>{r.title}</Text>
              <Text style={[styles.ruleBody, { color: colors.text }]}>{r.body}</Text>
            </View>
          ))
        )}

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Note: Covers primary fixed heirs & residuary relatives. Complex distant kinship cases should always be verified by a qualified Mufti.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerAr: { fontSize: 12, fontWeight: '700', color: '#E5C378' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF' },
  tabRow: {
    flexDirection: 'row',
    margin: SPACING.md,
    marginBottom: 8,
    padding: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    gap: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.full, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '800' },
  scrollContent: { paddingHorizontal: SPACING.md, gap: 10 },
  heroCard: { borderRadius: 20, padding: 16, gap: 4 },
  heroLabel: { color: '#E5C378', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  heroValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  heroSub: { color: '#A7F3D0', fontSize: 11.5, fontWeight: '600' },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 10, ...SHADOWS.card },
  sectionTitle: { fontSize: 14.5, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 12, minHeight: 44, fontSize: 14, fontWeight: '700' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 },
  label: { fontSize: 13.5, fontWeight: '600' },
  toggleChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  shareCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 4, ...SHADOWS.card },
  shareHeir: { fontSize: 15, fontWeight: '800' },
  sharePct: { fontSize: 13, fontWeight: '800' },
  shareAmt: { fontSize: 14, fontWeight: '800' },
  shareBasis: { fontSize: 12 },
  ruleBody: { fontSize: 13, lineHeight: 20 },
  disclaimer: { fontSize: 11.5, textAlign: 'center', lineHeight: 17, marginTop: 6 },
});
