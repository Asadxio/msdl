import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import {
  ChatMessage,
  SUGGESTED_STUDY_PROMPTS,
  askAiSabaqAssistant,
} from '@/lib/aiAssistant';
import { goBackOrReplace } from '@/lib/navigation';

export default function AiAssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'assistant',
      text:
        'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n\n' +
        'السلام علیکم محترم طالبہ! میں آپ کی **24/7 تعلیمی معاون (AI Study Companion)** ہوں۔\n\n' +
        'آپ مجھ سے اپنے سبق، قرآنی الفاظ کے معانی، تجوید کے قواعد، یا اسلامی تاریخ سے متعلق سوالات پوچھ سکتی ہیں۔\n\n' +
        '*(نوٹ: مخصوص شرعی فتووں کے لیے دار الافتاء کے ذریعے استاذہ سے رجوع فرمائیں)*',
      timestamp: Date.now(),
    },
  ]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await askAiSabaqAssistant(textToSend, messages);
      const assistantMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: response.text,
        timestamp: Date.now(),
        isRedirect: response.isRedirect,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text: 'معذرت! اس وقت جواب دینے میں دشواری پیش آ رہی ہے۔ برائے مہربانی کچھ دیر بعد دوبارہ کوشش فرمائیں۔',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('کاپی ہوگیا', 'جواب کامیابی سے کاپی ہو چکا ہے۔');
  };

  const handleClearChat = () => {
    Alert.alert('چیٹ صاف کریں', 'کیا آپ تمام پیغامات صاف کرنا چاہتی ہیں؟', [
      { text: 'منسوخ', style: 'cancel' },
      {
        text: 'صاف کریں',
        style: 'destructive',
        onPress: () => {
          setMessages([
            {
              id: 'welcome_msg_reset',
              sender: 'assistant',
              text: 'السلام علیکم! نیا تعلیمی سیشن شروع ہو چکا ہے۔ آپ کیا سمجھنا چاہتی ہیں؟',
              timestamp: Date.now(),
            },
          ]);
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => goBackOrReplace(router, '/(tabs)')}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.arabicHeader}>مُعَاوِنُ المَطَالَعَةِ وَالسَّبَق</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSubtitle}>24/7 AI Sabaq Assistant</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleClearChat}
          accessibilityLabel="Clear Chat"
        >
          <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Suggested Prompt Chips */}
        <View style={styles.suggestionsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {SUGGESTED_STUDY_PROMPTS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.suggestionChip}
                onPress={() => handleSend(p.prompt)}
                activeOpacity={0.8}
              >
                <Ionicons name="sparkles" size={12} color="#C8A84E" />
                <Text style={styles.suggestionText}>{p.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Message Stream */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesScroll}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <View
                key={m.id}
                style={[
                  styles.messageBubbleWrap,
                  isUser ? styles.userBubbleWrap : styles.assistantBubbleWrap,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.assistantMessageText,
                    ]}
                  >
                    {m.text}
                  </Text>

                  {/* Fatwa Redirect Button */}
                  {m.isRedirect && (
                    <TouchableOpacity
                      style={styles.redirectBtn}
                      onPress={() => router.push('/fatawa' as any)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="ribbon" size={16} color="#005F46" />
                      <Text style={styles.redirectBtnText}>دار الافتاء میں سوال بھیجیں (Ask Ustaadha)</Text>
                    </TouchableOpacity>
                  )}

                  {/* Bubble Actions */}
                  {!isUser && (
                    <View style={styles.bubbleActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleCopy(m.text)}
                      >
                        <Ionicons name="copy-outline" size={13} color="#64748B" />
                        <Text style={styles.actionBtnText}>کاپی</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}

          {loading && (
            <View style={styles.loadingBubble}>
              <ActivityIndicator size="small" color="#005F46" />
              <Text style={styles.loadingText}>جواب تیار کیا جا رہا ہے...</Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Input Box */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            style={styles.input}
            placeholder="اپنے سبق کا سوال لکھیں (Ask your sabaq question)..."
            placeholderTextColor="#94A3B8"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={600}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => handleSend()}
            disabled={!input.trim() || loading}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#002E23',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  arabicHeader: {
    fontSize: 14,
    color: '#C8A84E',
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  suggestionsSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionsScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003D2E',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    gap: 6,
  },
  suggestionText: {
    fontSize: 11,
    color: '#FDFBF4',
    fontWeight: '700',
  },
  messagesScroll: {
    padding: SPACING.md,
    gap: 12,
    paddingBottom: 20,
  },
  messageBubbleWrap: {
    flexDirection: 'row',
    width: '100%',
  },
  userBubbleWrap: {
    justifyContent: 'flex-end',
  },
  assistantBubbleWrap: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: RADIUS.lg,
    padding: 14,
    gap: 8,
    ...SHADOWS.card,
  },
  userBubble: {
    backgroundColor: '#005F46',
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 21,
  },
  userMessageText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assistantMessageText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  bubbleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionBtnText: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  redirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginTop: 6,
  },
  redirectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#005F46',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  loadingText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: SPACING.md,
    paddingTop: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    maxHeight: 100,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#005F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.5,
  },
});
