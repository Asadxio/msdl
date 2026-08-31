import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING } from '@/constants/theme';
import type { QuizCertificateData } from '@/lib/quizCertificate';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  const [downloading, setDownloading] = useState(false);

  if (!certificate) return null;

  const handleShare = async () => {
    try {
      const shareMessage = `🎓 OFFICIAL ISLAMIC CERTIFICATE OF ACHIEVEMENT\n\n` +
        `Madrasatu-s-Salikat Lil Banat\n` +
        `مدرسۃ السالکات للبنات\n\n` +
        `Awarded To: ${certificate.studentName}\n` +
        `Subject / Assessment: ${certificate.quizCategory}\n` +
        `Score: ${certificate.score}/${certificate.totalQuestions} (${certificate.percentage}%)\n` +
        `Grade: ${certificate.gradeLabel}\n` +
        `Date: ${certificate.issueDateGregorian} (${certificate.issueDateHijri})\n` +
        `Verification ID: ${certificate.certificateId}\n\n` +
        `Verified Online via Madrasatu-s-Salikat Lil Banat Learning Portal.`;

      await Share.share({
        title: `Certificate of Achievement - ${certificate.studentName}`,
        message: shareMessage,
      });
    } catch {
      // Share cancelled
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Generate clean HTML certificate document and save locally
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Georgia', serif; text-align: center; padding: 40px; background: #FAF8F5; color: #0F3D35; }
            .border { border: 8px solid #C59B27; padding: 30px; border-radius: 12px; background: #FFFFFF; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
            .inner-border { border: 2px solid #0F3D35; padding: 25px; border-radius: 8px; }
            .bismillah { font-size: 24px; color: #C59B27; margin-bottom: 10px; }
            .title { font-size: 28px; font-weight: bold; color: #0F3D35; letter-spacing: 1px; }
            .arabic-title { font-size: 22px; color: #C59B27; margin-top: 4px; }
            .cert-type { font-size: 16px; text-transform: uppercase; letter-spacing: 3px; color: #555; margin-top: 20px; }
            .student { font-size: 32px; font-weight: bold; color: #0F3D35; margin: 20px 0; border-bottom: 2px solid #C59B27; display: inline-block; padding: 0 30px 6px; }
            .desc { font-size: 16px; line-height: 1.6; color: #444; max-width: 600px; margin: 0 auto 20px; }
            .score-badge { display: inline-block; background: #ECFDF5; border: 1px solid #10B981; color: #047857; padding: 8px 20px; border-radius: 20px; font-weight: bold; font-size: 16px; margin-bottom: 25px; }
            .meta { display: flex; justify-content: space-between; margin-top: 40px; border-top: 1px dashed #CCC; padding-top: 20px; font-size: 14px; color: #666; }
            .seal { width: 80px; height: 80px; border: 3px double #C59B27; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: #C59B27; text-transform: uppercase; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="border">
            <div class="inner-border">
              <div class="bismillah">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</div>
              <div class="title">Madrasatu-s-Salikat Lil Banat</div>
              <div class="arabic-title">مدرسۃ السالکات للبنات</div>
              <div class="cert-type">Certificate of Academic Excellence</div>
              <div class="student">${certificate.studentName}</div>
              <div class="desc">
                has successfully passed the Islamic Knowledge Assessment in <strong>${certificate.quizCategory}</strong>, demonstrating dedication and mastery of authentic Islamic principles.
              </div>
              <div class="score-badge">Score: ${certificate.score}/${certificate.totalQuestions} (${certificate.percentage}%) • ${certificate.gradeLabel}</div>
              <div class="meta">
                <div style="text-align: left;">
                  <div><strong>Date:</strong> ${certificate.issueDateGregorian}</div>
                  <div><strong>Hijri:</strong> ${certificate.issueDateHijri}</div>
                  <div><strong>Serial:</strong> ${certificate.certificateId}</div>
                </div>
                <div>
                  <div class="seal">Official Seal</div>
                </div>
                <div style="text-align: right;">
                  <div style="border-bottom: 1px solid #333; width: 140px; margin-bottom: 4px;"></div>
                  <div><strong>Academic Directorate</strong></div>
                  <div style="font-size: 12px; color: #888;">Madrasatu-s-Salikat</div>
                </div>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      const fileUri = `${FileSystem.documentDirectory}Certificate_${certificate.certificateId}.html`;
      await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: 'Save / Share Official Certificate',
          UTI: 'public.html',
        });
      } else {
        Alert.alert('Saved', `Certificate saved to device: ${fileUri}`);
      }
    } catch (err: any) {
      console.warn('[handleDownload] Certificate export failed:', err);
      Alert.alert('Export Notice', 'Certificate details ready to share via WhatsApp or social apps.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header Bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarTitleRow}>
              <Ionicons name="ribbon" size={22} color="#D97706" />
              <Text style={styles.topBarTitle}>Official Certificate</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* ─── The Certificate Document ─── */}
            <View style={styles.certificateCard}>
              {/* Outer Golden Border */}
              <View style={styles.outerBorder}>
                {/* Inner Emerald Border */}
                <View style={styles.innerBorder}>
                  {/* Corner Ornaments */}
                  <View style={[styles.cornerOrnament, styles.cornerTL]} />
                  <View style={[styles.cornerOrnament, styles.cornerTR]} />
                  <View style={[styles.cornerOrnament, styles.cornerBL]} />
                  <View style={[styles.cornerOrnament, styles.cornerBR]} />

                  {/* Bismillah */}
                  <Text style={styles.bismillah}>بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم</Text>

                  {/* Madrasa Title */}
                  <Text style={styles.madrasaName}>MADRASATU-S-SALIKAT LIL BANAT</Text>
                  <Text style={styles.madrasaArabic}>مدرسۃ السالکات للبنات</Text>

                  <View style={styles.goldDivider}>
                    <View style={styles.goldDividerLine} />
                    <Ionicons name="star" size={14} color="#C59B27" />
                    <View style={styles.goldDividerLine} />
                  </View>

                  <Text style={styles.certSubtitle}>CERTIFICATE OF ACHIEVEMENT</Text>
                  <Text style={styles.presentedTo}>This is proudly presented to</Text>

                  {/* Student Name */}
                  <Text style={styles.studentName} numberOfLines={2}>
                    {certificate.studentName}
                  </Text>
                  <View style={styles.nameUnderline} />

                  {/* Completion Statement */}
                  <Text style={styles.bodyText}>
                    for successfully completing the Islamic Knowledge assessment in{' '}
                    <Text style={styles.highlightText}>{certificate.quizCategory}</Text> with exemplary dedication and understanding.
                  </Text>

                  {/* Score & Grade Badge */}
                  <View style={styles.badgeContainer}>
                    <View style={styles.scorePill}>
                      <Ionicons name="trophy" size={16} color="#D97706" />
                      <Text style={styles.scoreText}>
                        Score: {certificate.score}/{certificate.totalQuestions} ({certificate.percentage}%)
                      </Text>
                    </View>
                    <View style={styles.gradePill}>
                      <Text style={styles.gradeText}>{certificate.gradeLabel}</Text>
                    </View>
                  </View>

                  {/* Footer & Meta Info */}
                  <View style={styles.certFooter}>
                    <View style={styles.footerLeft}>
                      <Text style={styles.metaLabel}>Date of Issue</Text>
                      <Text style={styles.metaValue}>{certificate.issueDateGregorian}</Text>
                      <Text style={styles.metaSubValue}>{certificate.issueDateHijri}</Text>
                      <Text style={styles.certSerial}>ID: {certificate.certificateId}</Text>
                    </View>

                    {/* Official Seal Badge */}
                    <View style={styles.sealBox}>
                      <View style={styles.sealCircle}>
                        <Ionicons name="shield-checkmark" size={20} color="#C59B27" />
                        <Text style={styles.sealText}>MSLB</Text>
                        <Text style={styles.sealSubText}>VERIFIED</Text>
                      </View>
                    </View>

                    <View style={styles.footerRight}>
                      <View style={styles.signLine} />
                      <Text style={styles.signTitle}>Academic Directorate</Text>
                      <Text style={styles.signSub}>MSLB Lil Banat</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* ─── Action Buttons ─── */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shareBtn]}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={20} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Share Certificate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.downloadBtn]}
                onPress={handleDownload}
                disabled={downloading}
                activeOpacity={0.8}
              >
                {downloading ? (
                  <ActivityIndicator size="small" color="#0F3D35" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={20} color="#0F3D35" />
                    <Text style={styles.downloadBtnText}>Save / Export</Text>
                  </>
                )}
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: '#FAF8F5',
    borderRadius: 24,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F3D35',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    alignItems: 'center',
  },
  certificateCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    ...SHADOWS.card,
  },
  outerBorder: {
    borderWidth: 5,
    borderColor: '#C59B27',
    borderRadius: 14,
    padding: 6,
    backgroundColor: '#FFFDF9',
  },
  innerBorder: {
    borderWidth: 1.5,
    borderColor: '#0F3D35',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cornerOrnament: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#C59B27',
  },
  cornerTL: { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
  bismillah: {
    fontSize: 16,
    color: '#C59B27',
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  madrasaName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F3D35',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  madrasaArabic: {
    fontSize: 14,
    color: '#C59B27',
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  goldDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    width: '70%',
    gap: 8,
  },
  goldDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#C59B27',
  },
  certSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  presentedTo: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 8,
  },
  studentName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F3D35',
    marginVertical: 6,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  nameUnderline: {
    width: 140,
    height: 2,
    backgroundColor: '#C59B27',
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  highlightText: {
    fontWeight: '800',
    color: '#0F3D35',
  },
  badgeContainer: {
    marginVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  gradePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  gradeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  certFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  footerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F3D35',
  },
  metaSubValue: {
    fontSize: 10,
    color: '#C59B27',
    fontWeight: '600',
  },
  certSerial: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  sealBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  sealCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: '#C59B27',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF7',
  },
  sealText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#C59B27',
    letterSpacing: 0.5,
  },
  sealSubText: {
    fontSize: 6,
    fontWeight: '800',
    color: '#0F3D35',
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  signLine: {
    width: 80,
    height: 1,
    backgroundColor: '#94A3B8',
    marginBottom: 4,
  },
  signTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F3D35',
  },
  signSub: {
    fontSize: 8,
    color: '#64748B',
  },
  actionsContainer: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    ...SHADOWS.card,
  },
  shareBtn: {
    backgroundColor: '#0FA958',
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  downloadBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0F3D35',
  },
  downloadBtnText: {
    color: '#0F3D35',
    fontSize: 14,
    fontWeight: '800',
  },
});
