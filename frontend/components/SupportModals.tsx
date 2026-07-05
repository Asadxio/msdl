import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Alert, Linking, ActivityIndicator, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Constants from 'expo-constants';

const SUPPORT_EMAIL = 'madrastussalikatlilbanat@gmail.com';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BugReportModal: React.FC<ModalProps> = ({ visible, onClose }) => {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'Crash / Freeze' | 'Video / Audio' | 'Login / Account' | 'UI / Display' | 'Other'>('Crash / Freeze');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please provide both a short title and detailed description of the issue.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'bug_reports'), {
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || profile?.email || 'not_provided',
        userName: profile?.name || 'Anonymous User',
        title: title.trim(),
        description: description.trim(),
        category,
        platform: Platform.OS,
        appVersion: Constants.expoConfig?.version || '1.0.0',
        status: 'new',
        createdAt: serverTimestamp(),
      });
      setLoading(false);
      setTitle('');
      setDescription('');
      onClose();
      Alert.alert('Report Submitted / رپورٹ موصول ہوئی', 'JazakAllah Khair! Your bug report has been forwarded to our technical team for resolution.');
    } catch (err) {
      setLoading(false);
      console.warn('[BugReport] Firestore save error:', err);
      Alert.alert(
        'Submission Failed',
        'Could not save report automatically. Would you like to send it directly via Email?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Email', onPress: handleSendEmail }
        ]
      );
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Bug Report [${category}]: ${title || 'App Issue'}`);
    const body = encodeURIComponent(`Description:\n${description}\n\n---\nUser: ${profile?.name || 'Student'}\nPlatform: ${Platform.OS}\nApp Version: ${Constants.expoConfig?.version || '1.0.0'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="bug" size={22} color="#EF4444" />
              <Text style={styles.title}>Report a Bug / तकनीकी समस्या</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>Found an issue in the app? Let us know so we can fix it immediately.</Text>

            <Text style={styles.label}>Issue Category</Text>
            <View style={styles.categoryGrid}>
              {(['Crash / Freeze', 'Video / Audio', 'Login / Account', 'UI / Display', 'Other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Issue Summary / शीर्षक</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Video player freezes after 5 minutes"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <Text style={styles.label}>Detailed Explanation / विवरण</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what happened, what screen you were on, and how we can reproduce it..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.emailAltBtn} onPress={handleSendEmail}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textMain} />
                <Text style={styles.emailAltText}>Send via Email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export const FeatureSuggestModal: React.FC<ModalProps> = ({ visible, onClose }) => {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'New Islamic Tool' | 'Course Material' | 'UI / UX' | 'Other'>('New Islamic Tool');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please provide both a feature name and explanation of how it helps.');
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, 'feature_suggestions'), {
        userId: user?.uid || 'anonymous',
        userEmail: user?.email || profile?.email || 'not_provided',
        userName: profile?.name || 'Anonymous Student',
        title: title.trim(),
        description: description.trim(),
        category,
        votes: 1,
        createdAt: serverTimestamp(),
      });
      setLoading(false);
      setTitle('');
      setDescription('');
      onClose();
      Alert.alert('Suggestion Saved / تجویز موصول ہوئی', 'JazakAllah Khair! We love new ideas and will review yours for upcoming releases.');
    } catch (err) {
      setLoading(false);
      console.warn('[FeatureSuggest] Firestore save error:', err);
      Alert.alert(
        'Submission Failed',
        'Could not save suggestion automatically. Would you like to send it directly via Email?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Send Email', onPress: handleSendEmail }
        ]
      );
    }
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Feature Suggestion [${category}]: ${title || 'New Idea'}`);
    const body = encodeURIComponent(`Suggestion:\n${description}\n\n---\nFrom: ${profile?.name || 'Student'}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="bulb" size={22} color="#F59E0B" />
              <Text style={styles.title}>Suggest a Feature / नए सुझाव</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>Have an idea to make Madrasa Tus Salikat Lil Banat app even better? We are listening!</Text>

            <Text style={styles.label}>Suggestion Category</Text>
            <View style={styles.categoryGrid}>
              {(['New Islamic Tool', 'Course Material', 'UI / UX', 'Other'] as const).map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipActive, category === cat && { borderColor: '#F59E0B', backgroundColor: '#FEF3C7' }]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && { color: '#B45309', fontWeight: '700' }]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Feature Title / सुझाव का नाम</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Add Daily Hadith reminder widget"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            <Text style={styles.label}>How will this help students? / लाभ व विवरण</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Explain how you envision this feature working and why it would benefit Islamic students..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.emailAltBtn} onPress={handleSendEmail}>
                <Ionicons name="mail-outline" size={18} color={COLORS.textMain} />
                <Text style={styles.emailAltText}>Send via Email</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#D97706' }]} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.submitBtnText}>Submit Suggestion</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const FAQ_ITEMS = [
  {
    q: 'How do I join a Live Class? / Live Class me kaise join karein?',
    a: 'When a class is live, a prominent active banner will appear on your Home screen and Courses tab. Tap "Join Now" to enter the interactive video classroom.'
  },
  {
    q: 'Can I access course lessons offline? / Bina internet ke lessons dekh sakte hain?',
    a: 'Yes! While viewing a course lesson, tap the Download icon next to any PDF book or audio recording. Once downloaded, you can access it anytime from the Library tab without internet connection.'
  },
  {
    q: 'Why am I not receiving Prayer notifications? / Azan ki notification kyu nahi aa rahi?',
    a: 'Please check two things: 1) Ensure notifications are permitted in your Android/iOS system settings for this app. 2) In App Settings -> Announcements, check that notifications are toggled ON.'
  },
  {
    q: 'How do I use the Qibla Finder? / Qibla Finder kaise use karein?',
    a: 'Go to More -> Applications -> Qibla Finder. You can switch between the interactive Google Camera AR overlay or the standard compass direction. Make sure GPS location access is granted.'
  },
  {
    q: 'How can I change the app language? / App ki language kaise change karein?',
    a: 'Go to Settings -> Language and choose between English, Urdu (اردو), or Arabic (العربية). Your choice is saved automatically.'
  },
  {
    q: 'How do I reset my password? / Password bhool gaye toh kya karein?',
    a: 'On the login screen, tap "Forgot Password" and enter your registered email. You will receive a secure password reset link within minutes.'
  },
  {
    q: 'How do I check my Quiz scores and certificates? / Quiz results kahan dekhein?',
    a: 'Go to More -> Progress & Analytics to see your detailed performance history, attendance record, and downloaded certificates.'
  },
  {
    q: 'Who do I contact for payment or account approval issues?',
    a: `You can reach out to our administration directly via WhatsApp Support in Settings or email us at ${SUPPORT_EMAIL}.`
  }
];

export const FaqModal: React.FC<ModalProps> = ({ visible, onClose }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.faqContainer}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="help-buoy" size={22} color={COLORS.primary} />
            <Text style={styles.title}>Frequently Asked Questions (FAQ)</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.faqSubtitle}>Find quick answers to common questions about using the Madrasa Tus Salikat Lil Banat app / अक्सर पूछे जाने वाले सवाल:</Text>

          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = expandedIndex === idx;
            return (
              <TouchableOpacity
                key={idx}
                style={[styles.faqCard, isOpen && styles.faqCardOpen]}
                onPress={() => toggleExpand(idx)}
                activeOpacity={0.8}
              >
                <View style={styles.faqCardHeader}>
                  <Text style={[styles.faqQuestion, isOpen && { color: COLORS.primary }]}>{item.q}</Text>
                  <Ionicons name={isOpen ? 'remove-circle-outline' : 'add-circle-outline'} size={20} color={isOpen ? COLORS.primary : COLORS.textMuted} />
                </View>
                {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
              </TouchableOpacity>
            );
          })}

          <View style={styles.contactCard}>
            <Ionicons name="mail" size={28} color={COLORS.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.contactTitle}>Still need assistance?</Text>
            <Text style={styles.contactText}>Our administration team is always ready to help you with your studies and app setup.</Text>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=MSDL%20App%20Support%20Inquiry`)}
            >
              <Text style={styles.contactBtnText}>Email: {SUPPORT_EMAIL}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  content: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  faqContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading,
    fontSize: 18,
    color: COLORS.textMain,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 6,
    marginTop: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  catChipActive: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  catText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  catTextActive: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textMain,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 90,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: SPACING.lg,
  },
  emailAltBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
  },
  emailAltText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMain,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  faqSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  faqCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  faqCardOpen: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAF5FF',
  },
  faqCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMain,
    flex: 1,
    lineHeight: 20,
  },
  faqAnswer: {
    fontSize: 13,
    color: '#475569',
    marginTop: 10,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 8,
  },
  contactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...SHADOWS.card,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  contactBtn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  contactBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0369A1',
  }
});
