import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useActiveOrganization } from '@/lib/tenantContext';

interface CustomerSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export function CustomerSupportModal({ visible, onClose }: CustomerSupportModalProps) {
  const { activeOrg } = useActiveOrganization();
  const orgName = activeOrg?.name || 'Madrasa Partner';

  const handleWhatsAppSupport = async () => {
    const phone = '916366919122';
    const text = `Assalamu Alaikum MSLB Support Team,\n\nI am contacting you from *${orgName}* (ID: ${activeOrg?.id || 'N/A'}). I need assistance with our institutional workspace.`;
    const webUrl = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    const directUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;

    try {
      if (Platform.OS === 'android') {
        await Linking.openURL(webUrl);
      } else {
        const canOpen = await Linking.canOpenURL(directUrl);
        if (canOpen) {
          await Linking.openURL(directUrl);
        } else {
          await Linking.openURL(webUrl);
        }
      }
    } catch {
      Alert.alert('Unable to open WhatsApp', 'Please contact MSLB directly at +91 63669 19122.');
    }
  };

  const handleEmailSupport = async () => {
    const email = 'sumraftm@gmail.com';
    const subject = `MSLB Support Request: ${orgName}`;
    const body = `Assalamu Alaikum MSLB Team,\n\nMadrasa: ${orgName}\nWorkspace ID: ${activeOrg?.id || 'N/A'}\n\nPlease help us with: `;
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch {
      Alert.alert('Email Unavailable', `Please write to us at ${email}`);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="headset-outline" size={24} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title}>Madrasa Partner Support</Text>
              <Text style={styles.subtitle}>{orgName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            Our team is available to help you configure curriculum, onboard faculty, import students, and answer any institutional questions.
          </Text>

          <View style={styles.actionsList}>
            <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsAppSupport}>
              <Ionicons name="logo-whatsapp" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.whatsappBtnText}>Chat on WhatsApp</Text>
                <Text style={styles.whatsappSubtext}>Instant response from MSLB Support</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.emailBtn} onPress={handleEmailSupport}>
              <Ionicons name="mail-outline" size={22} color={COLORS.primary} style={{ marginRight: 10 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emailBtnText}>Send Official Email</Text>
                <Text style={styles.emailSubtext}>sumraftm@gmail.com</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.footerInfo}>
            <Ionicons name="time-outline" size={14} color={COLORS.textMuted} style={{ marginRight: 6 }} />
            <Text style={styles.footerText}>Support hours: 9:00 AM – 7:00 PM IST (Mon – Sat)</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  description: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
  actionsList: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  whatsappBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  whatsappSubtext: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  emailBtnText: {
    color: COLORS.textMain,
    fontWeight: '600',
    fontSize: 15,
  },
  emailSubtext: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
});
