import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import type { QuizCertificateData } from '@/lib/quizCertificate';
import {
  CERTIFICATE_THEMES,
  type CertificateThemeKey,
  shareCertificatePngFile,
} from '@/lib/certificateImageGenerator';
import { getSanadQrCodeUrl } from '@/lib/sanadVerification';

interface IslamicCertificateModalProps {
  visible: boolean;
  certificate: QuizCertificateData | null;
  onClose: () => void;
}

export const IslamicCertificateModal: React.FC<IslamicCertificateModalProps> = ({
  visible,
  certificate,
  onClose,
}) => {
  const router = useRouter();
  const [selectedTheme, setSelectedTheme] = useState<CertificateThemeKey>('emerald');
  const [sharing, setSharing] = useState(false);

  if (!certificate) return null;

  const currentTheme = CERTIFICATE_THEMES[selectedTheme] || CERTIFICATE_THEMES.emerald;

  const handleShare = async () => {
    setSharing(true);
    try {
      await shareCertificatePngFile(certificate, selectedTheme);
    } catch (err: any) {
      Alert.alert('Share Error', err?.message || 'Failed to share certificate.');
    } finally {
      setSharing(false);
    }
  };

  const handleWhatsAppShare = async () => {
    try {
      const verifyUrl = `https://mslb.app/verify-sanad?id=${encodeURIComponent(certificate.certificateId)}`;
      const shareText = `🌸 الحمد لله رب العالمين!

ہماری بیٹی *${certificate.studentName}* نے *مدرسۃ السالکات للبنات* کے کورس/کوئز *${certificate.quizCategory}* میں شاندار کامیابی حاصل کر کے سند (Official Sanad) حاصل کی ہے۔

📊 حاصل کردہ نمبر: *${certificate.score} / ${certificate.totalQuestions}* (${certificate.percentage}%)
🏅 درجہ / گریڈ: *${certificate.gradeLabel}*
📜 سند نمبر: *${certificate.certificateId}*

🔗 سند کی آن لائن لائیو تصدیق (Live Verification Link):
${verifyUrl}

مدرسۃ السالکات للبنات (Madrasatu-s-Salikat Lil Banat)`;

      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        const webWhatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
        const canOpenWeb = await Linking.canOpenURL(webWhatsappUrl).catch(() => false);
        if (canOpenWeb) {
          await Linking.openURL(webWhatsappUrl);
        } else {
          await Share.share({
            title: `Sanad - ${certificate.studentName}`,
            message: shareText,
          });
        }
      }
    } catch (err: any) {
      Alert.alert('WhatsApp Error', err?.message || 'Failed to open WhatsApp.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarTitleRow}>
              <View style={[styles.ribbonIconWrap, { backgroundColor: currentTheme.primaryColor }]}>
                <Ionicons name="ribbon" size={18} color={currentTheme.secondaryColor} />
              </View>
              <View>
                <Text style={styles.topBarTitle}>Official Islamic Sanad</Text>
                <Text style={styles.topBarSub}>Madrasatu-s-Salikat Lil Banat</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Theme Selector Strip */}
            <View style={styles.themeSection}>
              <Text style={styles.themeLabel}>SELECT CERTIFICATE THEME</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeChipsRow}>
                {Object.values(CERTIFICATE_THEMES).map((thm) => {
                  const isSelected = selectedTheme === thm.key;
                  return (
                    <TouchableOpacity
                      key={thm.key}
                      style={[
                        styles.themeChip,
                        { borderColor: isSelected ? thm.secondaryColor : COLORS.border },
                        isSelected && { backgroundColor: thm.primaryColor },
                      ]}
                      onPress={() => setSelectedTheme(thm.key)}
                    >
                      <View style={[styles.themeDot, { backgroundColor: thm.secondaryColor }]} />
                      <Text
                        style={[
                          styles.themeChipText,
                          isSelected && { color: '#FFF', fontWeight: '800' },
                        ]}
                      >
                        {thm.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ─── The Certificate Document Card ─── */}
            <View style={[styles.certificateCard, { backgroundColor: currentTheme.paperColor, borderColor: currentTheme.borderColor }]}>
              {/* Outer Frame */}
              <View style={[styles.innerBorder, { borderColor: currentTheme.primaryColor }]}>
                {/* Corner Ornaments */}
                <View style={[styles.cornerOrnament, styles.cornerTL, { borderColor: currentTheme.secondaryColor }]} />
                <View style={[styles.cornerOrnament, styles.cornerTR, { borderColor: currentTheme.secondaryColor }]} />
                <View style={[styles.cornerOrnament, styles.cornerBL, { borderColor: currentTheme.secondaryColor }]} />
                <View style={[styles.cornerOrnament, styles.cornerBR, { borderColor: currentTheme.secondaryColor }]} />

                {/* Bismillah Calligraphy */}
                <Text style={[styles.bismillah, { color: currentTheme.primaryColor }]}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>

                {/* Official Madrasa Logo */}
                <Image
                  source={require('@/assets/images/mslb_logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />

                {/* Madrasa Titles */}
                <Text style={[styles.madrasaName, { color: currentTheme.primaryColor }]}>
                  MADRASATU-S-SALIKAT LIL BANAT
                </Text>
                <Text style={[styles.madrasaArabic, { color: currentTheme.secondaryColor }]}>
                  مدرسۃ السالکات للبنات
                </Text>

                {/* Certificate Ribbon */}
                <View style={[styles.certTypeBadge, { borderColor: currentTheme.secondaryColor }]}>
                  <Text style={[styles.certTypeText, { color: currentTheme.secondaryColor }]}>
                    CERTIFICATE OF ACADEMIC EXCELLENCE
                  </Text>
                </View>

                <Text style={styles.presentedTo}>This is proudly awarded to</Text>

                {/* Student Name */}
                <Text style={[styles.studentName, { color: currentTheme.primaryColor, borderBottomColor: currentTheme.secondaryColor }]} numberOfLines={2}>
                  {certificate.studentName}
                </Text>

                {/* Achievement Description */}
                <Text style={[styles.bodyText, { color: currentTheme.textColor }]}>
                  for successfully passing the Islamic Assessment in{' '}
                  <Text style={[styles.highlightText, { color: currentTheme.primaryColor }]}>{certificate.quizCategory}</Text>{' '}
                  with dedication and mastery of authentic Islamic knowledge.
                </Text>

                {/* Score & Grade Badge */}
                <View style={styles.badgeContainer}>
                  <View style={styles.scorePill}>
                    <Ionicons name="trophy" size={15} color="#065F46" />
                    <Text style={styles.scoreText}>
                      Score: {certificate.score}/{certificate.totalQuestions} ({certificate.percentage}%)
                    </Text>
                  </View>
                  <View style={styles.gradePill}>
                    <Text style={styles.gradeText}>{certificate.gradeLabel}</Text>
                  </View>
                </View>

                {/* Footer Meta & Seal */}
                <View style={styles.certFooter}>
                  <View style={styles.footerLeft}>
                    <Text style={styles.metaLabel}>Date of Issue</Text>
                    <Text style={styles.metaValue}>{certificate.issueDateGregorian}</Text>
                    {certificate.issueDateHijri ? (
                      <Text style={[styles.metaSubValue, { color: currentTheme.secondaryColor }]}>{certificate.issueDateHijri}</Text>
                    ) : null}
                    <Text style={[styles.certSerial, { color: currentTheme.primaryColor }]}>ID: {certificate.certificateId}</Text>
                  </View>

                  {/* Official Seal Badge & QR Code */}
                  <View style={styles.sealBox}>
                    <View style={[styles.sealCircle, { borderColor: currentTheme.secondaryColor }]}>
                      <Text style={[styles.sealStar, { color: currentTheme.secondaryColor }]}>★ MSLB ★</Text>
                      <Text style={[styles.sealText, { color: currentTheme.secondaryColor }]}>OFFICIAL</Text>
                      <Text style={[styles.sealSubText, { color: currentTheme.secondaryColor }]}>SEAL</Text>
                    </View>
                    <Image
                      source={{ uri: getSanadQrCodeUrl(certificate.certificateId) }}
                      style={styles.qrImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.qrLabel}>Scan to Verify</Text>
                  </View>

                  <View style={styles.footerRight}>
                    <View style={styles.signLine} />
                    <Text style={[styles.signTitle, { color: currentTheme.primaryColor }]}>Academic Directorate</Text>
                    <Text style={styles.signSub}>MSLB Lil Banat</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ─── Share / Download & Verification Actions ─── */}
            <View style={styles.actionsContainer}>
              {/* Direct WhatsApp Share / Status Button */}
              <TouchableOpacity
                style={styles.whatsAppShareBtn}
                onPress={handleWhatsAppShare}
                activeOpacity={0.88}
              >
                <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
                <Text style={styles.whatsAppShareBtnText}>Share on WhatsApp / Status (واٹس ایپ شیئر)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, { backgroundColor: currentTheme.primaryColor }]}
                onPress={handleShare}
                disabled={sharing}
                activeOpacity={0.88}
              >
                {sharing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="share-social" size={18} color="#FFFFFF" />
                    <Text style={styles.shareBtnText}>Share / Save Official Sanad (تصویر / فائل)</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.verifyOnlineBtn}
                onPress={() => {
                  onClose();
                  router.push(`/verify-sanad?id=${encodeURIComponent(certificate.certificateId)}` as any);
                }}
                activeOpacity={0.88}
              >
                <Ionicons name="shield-checkmark" size={18} color="#005F46" />
                <Text style={styles.verifyOnlineBtnText}>Verify Sanad Online (لائیو تصدیق)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: SPACING.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ribbonIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textMain,
  },
  topBarSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: SPACING.lg,
  },
  themeSection: {
    marginBottom: SPACING.md,
    gap: 6,
  },
  themeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
  },
  themeChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  certificateCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 6,
    padding: 10,
    ...SHADOWS.card,
  },
  innerBorder: {
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
  },
  cornerOrnament: {
    position: 'absolute',
    width: 18,
    height: 18,
  },
  cornerTL: { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
  bismillah: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  logoImage: {
    width: 76,
    height: 76,
    marginVertical: 4,
  },
  madrasaName: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  madrasaArabic: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  certTypeBadge: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: 12,
    marginVertical: 10,
  },
  certTypeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  presentedTo: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  studentName: {
    fontSize: 24,
    fontWeight: '900',
    marginVertical: 6,
    paddingBottom: 2,
    borderBottomWidth: 2,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 6,
    paddingHorizontal: 8,
  },
  highlightText: {
    fontWeight: '800',
  },
  badgeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  gradePill: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  gradeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  footerLeft: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  metaSubValue: {
    fontSize: 9,
    fontWeight: '600',
  },
  certSerial: {
    fontSize: 8,
    fontFamily: 'monospace',
    fontWeight: '700',
    marginTop: 2,
  },
  sealBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sealCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealStar: {
    fontSize: 6,
    fontWeight: '800',
  },
  sealText: {
    fontSize: 7,
    fontWeight: '900',
    lineHeight: 8,
  },
  sealSubText: {
    fontSize: 6,
    fontWeight: '700',
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  signLine: {
    width: 80,
    borderBottomWidth: 1,
    borderBottomColor: '#64748B',
    marginBottom: 2,
  },
  signTitle: {
    fontSize: 10,
    fontWeight: '700',
  },
  signSub: {
    fontSize: 8,
    color: '#64748B',
  },
  actionsContainer: {
    marginTop: SPACING.md,
    gap: 8,
  },
  whatsAppShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    gap: 8,
    ...SHADOWS.card,
  },
  whatsAppShareBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    gap: 8,
    ...SHADOWS.card,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  qrImage: {
    width: 44,
    height: 44,
    marginTop: 4,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  qrLabel: {
    fontSize: 7,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  verifyOnlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EE',
    borderWidth: 1.5,
    borderColor: '#005F46',
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    gap: 8,
    marginTop: 8,
  },
  verifyOnlineBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#005F46',
  },
});
