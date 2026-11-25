import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { goBackOrReplace } from '@/lib/navigation';
import {
  CURRENCY_OPTIONS,
  DEFAULT_ZAKAT_INPUTS,
  NISAB_WEIGHTS,
  calculateZakat,
  clearZakatInputs,
  fetchLiveMetalPrices,
  formatZakatNumber,
  loadZakatInputs,
  sanitizeDecimalInput,
  sanitizeSignedDecimalInput,
  saveZakatInputs,
  type CurrencyCode,
  type GoldKarat,
  type NisabStandard,
  type WeightStandard,
  type ZakatInputs,
} from '@/lib/zakatService';

interface ZakatFieldProps {
  label: string;
  value: string;
  onChangeText: (val: string) => void;
  sanitizer?: (val: string) => string;
  rightBadge?: string | null;
  warningText?: string | null;
  unitHint?: string;
  inputBg: string;
  textColor: string;
  mutedColor: string;
  accentColor: string;
  warningColor: string;
}

function ZakatInputBox({
  label,
  value,
  onChangeText,
  sanitizer,
  rightBadge,
  warningText,
  unitHint,
  inputBg,
  textColor,
  mutedColor,
  accentColor,
  warningColor,
}: ZakatFieldProps) {
  const hasValue = value.trim().length > 0;

  return (
    <View>
      <View style={[styles.inputBox, { backgroundColor: inputBg }]}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {hasValue && (
            <Text style={[styles.floatingLabel, { color: accentColor }]} numberOfLines={1}>
              {label}
            </Text>
          )}
          <TextInput
            value={value}
            onChangeText={(txt) => onChangeText((sanitizer || sanitizeDecimalInput)(txt))}
            placeholder={label}
            placeholderTextColor={mutedColor}
            keyboardType={sanitizer ? 'numbers-and-punctuation' : 'decimal-pad'}
            returnKeyType="done"
            style={[
              styles.inputControl,
              {
                color: textColor,
                paddingTop: hasValue ? 2 : 0,
              },
            ]}
            accessibilityLabel={label}
          />
        </View>

        {rightBadge ? (
          <View style={[styles.valueChip, { backgroundColor: 'rgba(16, 185, 129, 0.14)' }]}>
            <Text style={[styles.valueChipText, { color: accentColor }]}>{rightBadge}</Text>
          </View>
        ) : unitHint ? (
          <Text style={[styles.unitHintText, { color: mutedColor }]}>{unitHint}</Text>
        ) : null}
      </View>

      {!!warningText && (
        <Text style={[styles.fieldWarning, { color: warningColor }]}>{warningText}</Text>
      )}
    </View>
  );
}

export default function ZakatCalculatorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [inputs, setInputs] = useState<ZakatInputs>(DEFAULT_ZAKAT_INPUTS);
  const [hydrated, setHydrated] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [liveRateNote, setLiveRateNote] = useState<string | null>(null);
  const [liveRateError, setLiveRateError] = useState<string | null>(null);

  const handleFetchLiveRates = async () => {
    if (fetchingRates) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setFetchingRates(true);
    setLiveRateError(null);
    try {
      const targetCurrency = inputs.currency === 'NONE' ? 'INR' : inputs.currency;
      const result = await fetchLiveMetalPrices(targetCurrency);
      setInputs((prev) => ({
        ...prev,
        currency: prev.currency === 'NONE' ? result.currency : prev.currency,
        goldPricePerGram: String(result.goldPerGram),
        silverPricePerGram: String(result.silverPerGram),
      }));
      setLiveRateNote(
        `Live ${result.currency}/g synced (${result.source} • ${result.updatedAt})`
      );
    } catch (err: any) {
      setLiveRateError(err?.message || 'Unable to fetch live gold/silver spot prices.');
    } finally {
      setFetchingRates(false);
    }
  };

  useEffect(() => {
    let active = true;
    loadZakatInputs().then((loaded) => {
      if (active) {
        setInputs(loaded);
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void saveZakatInputs(inputs);
  }, [inputs, hydrated]);

  const breakdown = useMemo(() => calculateZakat(inputs), [inputs]);
  const weightSpec = NISAB_WEIGHTS[inputs.weightStandard] || NISAB_WEIGHTS.hanafi;

  const screenBg = isDark ? colors.background : '#F6F7F6';
  const cardBg = isDark ? colors.surface : '#FFFFFF';
  const cardBorder = isDark ? colors.border : 'rgba(15, 23, 42, 0.05)';
  const inputBg = isDark ? colors.surfaceAlt : '#F2F3F2';
  const heroBg = isDark ? '#064E3B' : '#045E44';
  const accentColor = isDark ? '#34D399' : '#056049';
  const selectedSegBg = isDark ? 'rgba(198, 161, 91, 0.22)' : '#FBF2DC';
  const selectedSegText = isDark ? '#FDE047' : '#9A7328';

  const updateField = <K extends keyof ZakatInputs>(key: K, value: ZakatInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSelectNisab = (standard: NisabStandard) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    updateField('nisabStandard', standard);
  };

  const handleReset = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const resetState: ZakatInputs = {
      ...DEFAULT_ZAKAT_INPUTS,
      currency: inputs.currency,
      weightStandard: inputs.weightStandard,
      nisabStandard: inputs.nisabStandard,
    };
    setInputs(resetState);
    await clearZakatInputs();
  };

  const handleShareSummary = async () => {
    try {
      const zakatStr = formatZakatNumber(breakdown.zakatDue, inputs.currency);
      const netStr = formatZakatNumber(breakdown.netZakatableWealth, inputs.currency);
      const nisabStr =
        breakdown.nisabThreshold !== null
          ? formatZakatNumber(breakdown.nisabThreshold, inputs.currency)
          : 'Not set';

      await Share.share({
        message:
          `SUFFAH Zakat Calculation Summary\n\n` +
          `Zakat Due (2.5%): ${zakatStr}\n` +
          `Net Zakatable Wealth: ${netStr}\n` +
          `Nisab Standard (${inputs.nisabStandard.toUpperCase()} - ${breakdown.nisabGramsUsed}g): ${nisabStr}\n` +
          `Total Assets: ${formatZakatNumber(breakdown.totalAssets, inputs.currency)}\n` +
          `Deductible Liabilities: ${formatZakatNumber(breakdown.totalLiabilities, inputs.currency)}\n\n` +
          `Note: Zakat is obligatory when net zakatable wealth equals or exceeds Nisab for one complete lunar year.`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const hasAnyEntry =
    breakdown.totalAssets > 0 ||
    breakdown.totalLiabilities > 0 ||
    breakdown.goldPrice > 0 ||
    breakdown.silverPrice > 0;

  return (
    <View style={[styles.container, { backgroundColor: screenBg }]} testID="zakat-screen">
      {/* Header Bar */}
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + SPACING.xs,
            backgroundColor: screenBg,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/more')}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Zakat
        </Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
            setShowGuideModal(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Nisab rules, currency, and Fiqh standards"
        >
          <Ionicons name="options-outline" size={21} color={colors.text} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, SPACING.lg) + SPACING.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Zakat Summary Card */}
          <View style={[styles.heroCard, { backgroundColor: heroBg }]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.heroEyebrow}>ZAKAT DUE</Text>

              {hasAnyEntry ? (
                <TouchableOpacity
                  style={styles.heroChipBtn}
                  onPress={handleReset}
                  accessibilityRole="button"
                  accessibilityLabel="Reset all entered Zakat values"
                >
                  <Ionicons name="refresh" size={12} color="#FFFFFF" />
                  <Text style={styles.heroChipBtnText}>Reset</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.heroChipBtn}
                  onPress={() => setShowGuideModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change currency or Fiqh standard"
                >
                  <Text style={styles.heroChipBtnText}>
                    {inputs.currency === 'NONE' ? 'Currency' : inputs.currency}
                  </Text>
                  <Ionicons name="chevron-down" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.heroAmount}>
              {formatZakatNumber(breakdown.zakatDue, inputs.currency)}
            </Text>

            <View style={styles.heroMetaRows}>
              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMetaLabel}>Net zakatable wealth</Text>
                <Text style={styles.heroMetaValue}>
                  {formatZakatNumber(breakdown.netZakatableWealth, inputs.currency)}
                </Text>
              </View>

              <View style={styles.heroMetaRow}>
                <Text style={styles.heroMetaLabel}>Nisab threshold</Text>
                <Text style={styles.heroMetaValue}>
                  {breakdown.nisabThreshold !== null
                    ? formatZakatNumber(breakdown.nisabThreshold, inputs.currency)
                    : 'Enter a metal price'}
                </Text>
              </View>
            </View>

            {/* Status / Utility strip shown once wealth or threshold exists */}
            {breakdown.nisabThreshold !== null && (
              <View style={styles.heroStatusBanner}>
                <Ionicons
                  name={breakdown.isAboveNisab ? 'checkmark-circle' : 'information-circle'}
                  size={15}
                  color={breakdown.isAboveNisab ? '#6EE7B7' : 'rgba(255,255,255,0.78)'}
                />
                <Text style={styles.heroStatusText}>
                  {breakdown.isAboveNisab
                    ? `Exceeds ${inputs.nisabStandard} Nisab (${breakdown.nisabGramsUsed}g) • 2.5% due`
                    : `Below ${inputs.nisabStandard} Nisab (${breakdown.nisabGramsUsed}g) • No Zakat due`}
                </Text>
              </View>
            )}

            {breakdown.zakatDue > 0 && (
              <View style={styles.heroActionsRow}>
                <TouchableOpacity
                  style={styles.heroActionPill}
                  onPress={handleShareSummary}
                  accessibilityRole="button"
                  accessibilityLabel="Share Zakat summary"
                >
                  <Ionicons name="share-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.heroActionPillText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.heroActionPill, { backgroundColor: '#C6A15B' }]}
                  onPress={() => router.push('/payment' as any)}
                  accessibilityRole="button"
                  accessibilityLabel="Fulfill Zakat via Madrasa Fund"
                >
                  <Ionicons name="heart" size={14} color="#043C32" />
                  <Text style={[styles.heroActionPillText, { color: '#043C32', fontWeight: '800' }]}>
                    Give Zakat
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Nisab Standard Segmented Control */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Nisab standard</Text>
          <View
            style={[
              styles.segmentedWrap,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                inputs.nisabStandard === 'silver' && { backgroundColor: selectedSegBg },
              ]}
              onPress={() => handleSelectNisab('silver')}
              accessibilityRole="tab"
              accessibilityState={{ selected: inputs.nisabStandard === 'silver' }}
              accessibilityLabel={`Silver Nisab (${weightSpec.silverGrams} grams)`}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color:
                      inputs.nisabStandard === 'silver' ? selectedSegText : colors.text,
                  },
                ]}
              >
                Silver
              </Text>
            </TouchableOpacity>

            <View style={[styles.segmentDivider, { backgroundColor: cardBorder }]} />

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                inputs.nisabStandard === 'gold' && { backgroundColor: selectedSegBg },
              ]}
              onPress={() => handleSelectNisab('gold')}
              accessibilityRole="tab"
              accessibilityState={{ selected: inputs.nisabStandard === 'gold' }}
              accessibilityLabel={`Gold Nisab (${weightSpec.goldGrams} grams)`}
            >
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: inputs.nisabStandard === 'gold' ? selectedSegText : colors.text,
                  },
                ]}
              >
                Gold
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.nisabHelper, { color: colors.textSecondary }]}>
            {inputs.nisabStandard === 'silver'
              ? `Silver standard: ${weightSpec.silverGrams}g (${
                  inputs.weightStandard === 'hanafi' ? '52.5 Tola' : '200 Dirhams'
                }) — benefits more recipients in need`
              : `Gold standard: ${weightSpec.goldGrams}g (${
                  inputs.weightStandard === 'hanafi' ? '7.5 Tola' : '20 Mithqal'
                }) — applies when holding gold exclusively`}
          </Text>

          {/* Metal Prices Group + Live Spot Fetcher */}
          <View style={styles.metalHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>
              Metal prices
            </Text>
            <TouchableOpacity
              style={[
                styles.liveRatesBtn,
                {
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#E8F5EE',
                  borderColor: accentColor,
                },
              ]}
              onPress={() => void handleFetchLiveRates()}
              disabled={fetchingRates}
              accessibilityRole="button"
              accessibilityLabel="Fetch live Gold and Silver rates"
            >
              {fetchingRates ? (
                <ActivityIndicator size="small" color={accentColor} />
              ) : (
                <Ionicons name="pulse" size={14} color={accentColor} />
              )}
              <Text style={[styles.liveRatesBtnText, { color: accentColor }]}>
                {fetchingRates ? 'Fetching...' : 'Fetch Live Rates'}
              </Text>
            </TouchableOpacity>
          </View>
          {!!liveRateNote && (
            <Text style={[styles.liveRateStatus, { color: accentColor }]}>{liveRateNote}</Text>
          )}
          {!!liveRateError && (
            <Text style={[styles.liveRateStatus, { color: colors.error }]}>{liveRateError}</Text>
          )}
          <View style={[styles.cardGroup, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ZakatInputBox
              label="Gold price per gram"
              value={inputs.goldPricePerGram}
              onChangeText={(v) => updateField('goldPricePerGram', v)}
              unitHint="/g"
              warningText={
                breakdown.missingGoldPriceForOwnedGold
                  ? 'Enter gold price per gram to include your gold in Net Wealth.'
                  : null
              }
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Silver price per gram"
              value={inputs.silverPricePerGram}
              onChangeText={(v) => updateField('silverPricePerGram', v)}
              unitHint="/g"
              warningText={
                breakdown.missingSilverPriceForOwnedSilver
                  ? 'Enter silver price per gram to include your silver in Net Wealth.'
                  : null
              }
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            {/* Gold Purity Karat Selector */}
            <View style={{ paddingTop: 4 }}>
              <Text style={[styles.nisabHelper, { color: colors.textSecondary, marginTop: 0, marginBottom: 6, marginLeft: 2 }]}>
                Owned gold purity (Karat)
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {([24, 22, 21, 18] as const).map((karat) => {
                  const sel = (inputs.goldPurityKarat || 24) === karat;
                  return (
                    <TouchableOpacity
                      key={karat}
                      style={[
                        styles.currencyPill,
                        {
                          flex: 1,
                          minHeight: 38,
                          paddingVertical: 6,
                          backgroundColor: sel ? selectedSegBg : inputBg,
                          borderWidth: 1,
                          borderColor: sel ? accentColor : 'transparent',
                        },
                      ]}
                      onPress={() => updateField('goldPurityKarat', karat)}
                      accessibilityRole="button"
                      accessibilityLabel={`Gold ${karat} karat purity`}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: sel ? selectedSegText : colors.text }}>
                        {karat}K
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Custom Nisab Offset (+/-) */}
            <ZakatInputBox
              label="Custom Nisab offset (+/-)"
              value={inputs.customNisabOffset || ''}
              onChangeText={(v) => updateField('customNisabOffset', v)}
              sanitizer={sanitizeSignedDecimalInput}
              unitHint={inputs.currency === 'NONE' ? '±' : inputs.currency}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />
          </View>

          {/* What You Own Group */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What you own</Text>
          <View style={[styles.cardGroup, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ZakatInputBox
              label="Cash in hand"
              value={inputs.cashInHand}
              onChangeText={(v) => updateField('cashInHand', v)}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Bank savings"
              value={inputs.bankSavings}
              onChangeText={(v) => updateField('bankSavings', v)}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Gold (grams)"
              value={inputs.goldGrams}
              onChangeText={(v) => updateField('goldGrams', v)}
              unitHint="g"
              rightBadge={
                breakdown.goldValue > 0
                  ? `= ${formatZakatNumber(breakdown.goldValue, inputs.currency)}`
                  : null
              }
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Silver (grams)"
              value={inputs.silverGrams}
              onChangeText={(v) => updateField('silverGrams', v)}
              unitHint="g"
              rightBadge={
                breakdown.silverValue > 0
                  ? `= ${formatZakatNumber(breakdown.silverValue, inputs.currency)}`
                  : null
              }
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Business assets"
              value={inputs.businessAssets}
              onChangeText={(v) => updateField('businessAssets', v)}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />

            <ZakatInputBox
              label="Money owed to you"
              value={inputs.moneyOwedToYou}
              onChangeText={(v) => updateField('moneyOwedToYou', v)}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />
          </View>

          {/* What You Owe Group */}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>What you owe</Text>
          <View style={[styles.cardGroup, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ZakatInputBox
              label="Debts and bills due"
              value={inputs.debtsAndBillsDue}
              onChangeText={(v) => updateField('debtsAndBillsDue', v)}
              inputBg={inputBg}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              accentColor={accentColor}
              warningColor={colors.goldText}
            />
          </View>

          {/* Disclaimer Footer */}
          <View style={styles.disclaimerRow}>
            <Ionicons
              name="information-circle-outline"
              size={18}
              color={colors.textMuted}
              style={{ marginTop: 1 }}
            />
            <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
              This is a guide based on the standard 2.5% rate applied to wealth held for a lunar
              year. Rulings differ on some assets — consult a scholar for your situation.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Zakat Fiqh Settings & Nisab Guide Modal */}
      <Modal
        visible={showGuideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuideModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowGuideModal(false)}>
          <Pressable
            style={[
              styles.modalSheet,
              {
                backgroundColor: isDark ? colors.surface : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, SPACING.lg),
              },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Nisab &amp; Calculation Settings
              </Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowGuideModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Close settings"
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Weight Standard */}
              <Text style={[styles.modalLabel, { color: accentColor }]}>
                CLASSICAL WEIGHT STANDARD
              </Text>
              <View style={{ gap: 8, marginTop: 6 }}>
                {(['hanafi', 'classical'] as WeightStandard[]).map((mode) => {
                  const selected = inputs.weightStandard === mode;
                  const meta = NISAB_WEIGHTS[mode];
                  return (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.optionTile,
                        {
                          backgroundColor: selected
                            ? selectedSegBg
                            : isDark
                            ? colors.surfaceAlt
                            : '#F8FAF9',
                          borderColor: selected ? selectedSegText : cardBorder,
                        },
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        updateField('weightStandard', mode);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.optionTileTitle,
                            { color: selected ? selectedSegText : colors.text },
                          ]}
                        >
                          {meta.label}
                        </Text>
                        <Text style={[styles.optionTileSub, { color: colors.textSecondary }]}>
                          {meta.summary}
                        </Text>
                      </View>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={20} color={selectedSegText} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Currency Display Prefix */}
              <Text style={[styles.modalLabel, { color: accentColor, marginTop: SPACING.md }]}>
                DISPLAY CURRENCY
              </Text>
              <View style={styles.currencyGrid}>
                {CURRENCY_OPTIONS.map((curr) => {
                  const active = inputs.currency === curr.code;
                  return (
                    <TouchableOpacity
                      key={curr.code}
                      style={[
                        styles.currencyPill,
                        {
                          backgroundColor: active
                            ? heroBg
                            : isDark
                            ? colors.surfaceAlt
                            : '#F3F4F6',
                        },
                      ]}
                      onPress={() => {
                        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                        updateField('currency', curr.code as CurrencyCode);
                      }}
                    >
                      <Text
                        style={[
                          styles.currencyPillText,
                          { color: active ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {curr.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Tola Conversion & Scholar Reference */}
              <View
                style={[
                  styles.guideNoteBox,
                  { backgroundColor: isDark ? colors.surfaceAlt : '#F8FAF9', borderColor: cardBorder },
                ]}
              >
                <Text style={[styles.guideNoteTitle, { color: colors.text }]}>
                  Quick Tola Reference
                </Text>
                <Text style={[styles.guideNoteText, { color: colors.textSecondary }]}>
                  1 Tola = 11.664 grams{'\n'}
                  Silver Nisab: 52.5 Tola = 612.36g{'\n'}
                  Gold Nisab: 7.5 Tola = 87.48g
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.askMuftiBtn,
                  { borderColor: accentColor },
                ]}
                onPress={() => {
                  setShowGuideModal(false);
                  router.push('/fatawa' as any);
                }}
              >
                <Ionicons name="ribbon-outline" size={18} color={accentColor} />
                <Text style={[styles.askMuftiText, { color: accentColor }]}>
                  Ask Zakat Question in Dar-ul-Iftaa
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  headerBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroEyebrow: {
    color: 'rgba(255, 255, 255, 0.78)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 30,
  },
  heroChipBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.6,
  },
  heroMetaRows: {
    marginTop: 16,
    gap: 8,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroMetaLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13.5,
    fontWeight: '500',
  },
  heroMetaValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  heroStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroStatusText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  heroActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
  },
  heroActionPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  segmentedWrap: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 48,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  segmentDivider: {
    width: 1,
  },
  segmentText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  nisabHelper: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: SPACING.md,
    lineHeight: 17,
  },
  cardGroup: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: SPACING.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 52,
    gap: 8,
  },
  floatingLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  inputControl: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 4,
  },
  unitHintText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  valueChip: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  valueChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldWarning: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  disclaimerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: SPACING.xs,
    paddingHorizontal: 4,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '400',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '84%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
  },
  modalLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  optionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 56,
  },
  optionTileTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionTileSub: {
    fontSize: 12,
    marginTop: 2,
  },
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  currencyPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  guideNoteBox: {
    marginTop: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  guideNoteTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  guideNoteText: {
    fontSize: 13,
    lineHeight: 20,
  },
  askMuftiBtn: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  askMuftiText: {
    fontSize: 14,
    fontWeight: '700',
  },
  metalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  liveRatesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  liveRatesBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  liveRateStatus: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
});
