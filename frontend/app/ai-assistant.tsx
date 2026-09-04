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
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { COLORS, RADIUS, SPACING, SHADOWS } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import {
  ChatMessage,
  TutorLanguage,
  TutorMode,
  ChatQuizQuestion,
  ChatVocabItem,
  SUGGESTED_STUDY_PROMPTS,
  askAiSabaqAssistant,
  loadSavedAiChat,
  saveAiChat,
  clearSavedAiChat,
} from '@/lib/aiAssistant';
import {
  saveSabaqNote,
  getSavedSabaqNotes,
  deleteSabaqNote,
  SavedSabaqNote,
} from '@/lib/sabaqNotesStorage';
import { goBackOrReplace } from '@/lib/navigation';

export default function AiAssistantScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ courseTitle?: string; lessonTitle?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const { getResumeLearning } = useData();

  // 8.3 Context from active course: auto-detect if not explicitly provided in params
  const resume = getResumeLearning();
  const [useActiveCourseContext, setUseActiveCourseContext] = useState(true);
  const activeCourseTitle = params.courseTitle || (useActiveCourseContext && resume?.courseName ? resume.courseName : undefined);
  const activeLessonTitle = params.lessonTitle || (useActiveCourseContext && resume?.lessonTitle ? resume.lessonTitle : undefined);

  const [language, setLanguage] = useState<TutorLanguage>('en');
  const [selectedMode, setSelectedMode] = useState<TutorMode>('tutor');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [savedNotes, setSavedNotes] = useState<SavedSabaqNote[]>([]);

  // 8.2 Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const recordingInstanceRef = useRef<Audio.Recording | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial welcome message reflecting active language
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg',
      sender: 'assistant',
      language: 'en',
      text:
        '**Bismillahir-Rahmanir-Rahim**\n\n' +
        'Assalamu Alaykum, Dear Student! Welcome to your **24/7 Advanced AI Sabaq Tutor**.\n\n' +
        'I can assist you with in-depth concept explanations, Quranic vocabulary breakdowns, interactive quizzes, and quick revision summaries for your Madrasa curriculum.\n\n' +
        '*(Note: For binding personal Shariah legal rulings/fatwas, please consult our certified live scholars at Dar-ul-Iftaa).*',
      timestamp: Date.now(),
    },
  ]);

  // 8.1 Chat history persistence: load saved messages on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadSavedAiChat();
      if (alive && saved && saved.length > 0) {
        setMessages(saved);
        const last = saved[saved.length - 1];
        if (last?.language) {
          setLanguage(last.language);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Save messages to AsyncStorage whenever they update
  useEffect(() => {
    if (messages.length > 0) {
      void saveAiChat(messages);
    }
  }, [messages]);

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages, loading]);

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recordingInstanceRef.current) {
        void recordingInstanceRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  // 8.2 Voice Recording Start/Stop
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'en' ? 'Microphone Permission Needed' : 'مائیکروفون کی اجازت درکار ہے',
          language === 'en'
            ? 'Please grant microphone permissions in settings to ask voice questions.'
            : 'آواز سے سوال پوچھنے کے لیے مائیکروفون کی اجازت دیجیے۔'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingInstanceRef.current = recording;
      setIsRecording(true);
      setRecordingDurationMs(0);

      const startTime = Date.now();
      recordTimerRef.current = setInterval(() => {
        setRecordingDurationMs(Date.now() - startTime);
      }, 500);
    } catch (err) {
      console.warn('[AiAssistant] Error starting recording:', err);
      Alert.alert('Recording Error', 'Could not access device microphone.');
      setIsRecording(false);
    }
  };

  const stopRecording = async (cancel = false) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    const rec = recordingInstanceRef.current;
    recordingInstanceRef.current = null;
    setIsRecording(false);

    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      if (cancel) return;

      const durationSec = Math.floor(recordingDurationMs / 1000);
      if (durationSec < 1) {
        Alert.alert(
          language === 'en' ? 'Recording too short' : 'آواز مختصر ہے',
          language === 'en' ? 'Please speak for at least 1-2 seconds.' : 'برائے مہربانی کم از کم 2 سیکنڈ گفتگو فرمائیں۔'
        );
        return;
      }

      // Voice Question Synthesis
      const voiceQuery = activeLessonTitle
        ? (language === 'en'
            ? `🎙️ [Voice Question - ${durationSec}s]: Please explain "${activeLessonTitle}" and clarify its key points.`
            : `🎙️ [صوتی سوال - ${durationSec} سیکنڈ]: سبق "${activeLessonTitle}" کے اہم مسائل اور نکات کی علمی وضاحت فرمائیں۔`)
        : (language === 'en'
            ? `🎙️ [Voice Question - ${durationSec}s]: Can you explain today's sabaq lesson and its core rules?`
            : `🎙️ [صوتی سوال - ${durationSec} سیکنڈ]: آج کے سبق کے بنیادی قواعد اور احکام سمجھا دیجیے۔`);

      // Fill into input or directly send for student ease
      setInput(voiceQuery);
      handleSend(voiceQuery);
    } catch (err) {
      console.warn('[AiAssistant] Error stopping recording:', err);
    }
  };

  // Load saved notes when opening modal
  const handleOpenNotes = async () => {
    const notes = await getSavedSabaqNotes();
    setSavedNotes(notes);
    setNotesModalVisible(true);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteSabaqNote(id);
    const updated = await getSavedSabaqNotes();
    setSavedNotes(updated);
  };

  // Toggle Language between English and Urdu
  const handleToggleLanguage = () => {
    const nextLang: TutorLanguage = language === 'en' ? 'ur' : 'en';
    setLanguage(nextLang);

    // If chat is clean, swap the welcome message
    if (messages.length === 1 && messages[0].id.startsWith('welcome_msg')) {
      setMessages([
        {
          id: 'welcome_msg_' + nextLang,
          sender: 'assistant',
          language: nextLang,
          text:
            nextLang === 'en'
              ? '**Bismillahir-Rahmanir-Rahim**\n\n' +
                'Assalamu Alaykum, Dear Student! Welcome to your **24/7 Advanced AI Sabaq Tutor**.\n\n' +
                'I can assist you with concept explanations, Quranic vocabulary breakdowns, interactive quizzes, and revision summaries.\n\n' +
                '*(Note: For personal Shariah legal rulings/fatwas, please consult our certified live scholars at Dar-ul-Iftaa).*'
              : 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيم\n\n' +
                'السلام علیکم محترم طالبہ! میں آپ کی **24/7 جدید AI سبق استاد (AI Study Companion)** ہوں۔\n\n' +
                'آپ مجھ سے اپنے اسباق، قرآنی الفاظ کے معانی، تجوید کے قواعد، فقہی مسائل، یا امتحانی خلاصہ جات پوچھ سکتی ہیں۔\n\n' +
                '*(نوٹ: مخصوص شرعی فتووں کے لیے دار الافتاء کے ذریعے استاذہ سے رجوع فرمائیں)*',
          timestamp: Date.now(),
        },
      ]);
    }
  };

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || loading) return;

    const userMsg: ChatMessage = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: Date.now(),
      language,
      mode: selectedMode,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await askAiSabaqAssistant(textToSend, messages, {
        language,
        mode: selectedMode,
        courseTitle: activeCourseTitle,
        lessonTitle: activeLessonTitle,
      });

      const assistantMsg: ChatMessage = {
        id: 'ai_' + Date.now(),
        sender: 'assistant',
        text: response.text,
        timestamp: Date.now(),
        isRedirect: response.isRedirect,
        quiz: response.quiz,
        vocab: response.vocab,
        summaryPoints: response.summaryPoints,
        mode: response.mode || selectedMode,
        language: response.language || language,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'assistant',
          text:
            language === 'en'
              ? 'Sorry! An error occurred while retrieving your academic answer. Please try again in a moment.'
              : 'معذرت! اس وقت جواب دینے میں دشواری پیش آ رہی ہے۔ برائے مہربانی کچھ دیر بعد دوبارہ کوشش فرمائیں۔',
          timestamp: Date.now(),
          language,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuizAnswer = (messageId: string, optionId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId || !msg.quiz) return msg;
        return {
          ...msg,
          quiz: {
            ...msg.quiz,
            userSelectedId: optionId,
            answered: true,
          },
        };
      })
    );
  };

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert(
      language === 'en' ? 'Copied' : 'کاپی ہوگیا',
      language === 'en' ? 'Response copied to clipboard.' : 'جواب کامیابی سے کاپی ہو چکا ہے۔'
    );
  };

  const handleSaveNote = async (msg: ChatMessage) => {
    const topic = msg.text.slice(0, 35).replace(/[*#]/g, '').trim() || 'Sabaq Note';
    await saveSabaqNote({
      topic,
      content: msg.text,
      mode: msg.mode || selectedMode,
      language: msg.language || language,
      courseTitle: activeCourseTitle,
      lessonTitle: activeLessonTitle,
    });
    Alert.alert(
      language === 'en' ? 'Saved to Notes' : 'نوٹس میں محفوظ',
      language === 'en'
        ? 'This explanation has been saved to your offline Sabaq Notes.'
        : 'یہ سبق کامیابی کے ساتھ آپ کے ذاتی نوٹس میں محفوظ کر لیا گیا ہے۔'
    );
  };

  const handleClearChat = () => {
    Alert.alert(
      language === 'en' ? 'Clear Session' : 'چیٹ صاف کریں',
      language === 'en' ? 'Do you want to clear all conversation messages?' : 'کیا آپ تمام پیغامات صاف کرنا چاہتی ہیں؟',
      [
        { text: language === 'en' ? 'Cancel' : 'منسوخ', style: 'cancel' },
        {
          text: language === 'en' ? 'Clear' : 'صاف کریں',
          style: 'destructive',
          onPress: async () => {
            await clearSavedAiChat();
            setMessages([
              {
                id: 'welcome_msg_reset',
                sender: 'assistant',
                language,
                text:
                  language === 'en'
                    ? 'Session reset. What topic or lesson would you like to study?'
                    : 'السلام علیکم! نیا تعلیمی سیشن شروع ہو چکا ہے۔ آپ کیا سمجھنا چاہتی ہیں؟',
                timestamp: Date.now(),
              },
            ]);
          },
        },
      ]
    );
  };

  // Filter study prompts based on active language
  const filteredPrompts = SUGGESTED_STUDY_PROMPTS.filter((p) => p.language === language);

  const MODES: { id: TutorMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'tutor', label: language === 'en' ? '🎓 Tutor' : '🎓 استاد', icon: 'school-outline' },
    { id: 'quiz', label: language === 'en' ? '🧠 Quiz Me' : '🧠 کوئز', icon: 'help-circle-outline' },
    { id: 'vocab', label: language === 'en' ? '🔤 Vocabulary' : '🔤 مفردات', icon: 'book-outline' },
    { id: 'summary', label: language === 'en' ? '⚡ Summary' : '⚡ خلاصہ', icon: 'flash-outline' },
  ];

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
          <Text style={styles.arabicHeader}>AI SABAQ TUTOR & COMPANION</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSubtitle}>
              {language === 'en' ? 'AI Sabaq Tutor (English & Urdu)' : '24/7 AI Sabaq Assistant'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {/* Notes Button */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleOpenNotes}
            accessibilityLabel="Saved Notes"
          >
            <Ionicons name="bookmarks-outline" size={18} color="#C8A84E" />
          </TouchableOpacity>

          {/* Language Toggle */}
          <TouchableOpacity
            style={[styles.headerBtn, styles.langToggleBtn]}
            onPress={handleToggleLanguage}
            accessibilityLabel="Toggle Language"
          >
            <Text style={styles.langToggleText}>{language === 'en' ? 'اردو' : 'EN'}</Text>
          </TouchableOpacity>

          {/* Clear Button */}
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleClearChat}
            accessibilityLabel="Clear Chat"
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Lesson Context Banner if navigated from a course OR auto-detected from active enrolled course */}
      {activeLessonTitle && (
        <View style={styles.contextBanner}>
          <Ionicons name="library" size={16} color="#C8A84E" />
          <View style={styles.contextBannerTextWrap}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.contextBannerLabel}>
                {language === 'en' ? 'Active Sabaq Reference:' : 'موجودہ سبق کا حوالہ:'}
              </Text>
              {!params.lessonTitle && (
                <View style={styles.contextAutoBadge}>
                  <Text style={styles.contextAutoBadgeText}>AUTO-INJECTED</Text>
                </View>
              )}
            </View>
            <Text style={styles.contextBannerTitle} numberOfLines={1}>
              {activeLessonTitle} {activeCourseTitle ? `(${activeCourseTitle})` : ''}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.contextAskBtn}
            onPress={() =>
              handleSend(
                language === 'en'
                  ? `Explain the main concepts and lessons of "${activeLessonTitle}" in detail.`
                  : `سبق "${activeLessonTitle}" کے اہم نکات اور وضاحت بیان فرمائیں۔`
              )
            }
          >
            <Text style={styles.contextAskBtnText}>{language === 'en' ? 'Ask' : 'سمجھائیں'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mode Selection Pills */}
      <View style={styles.modeBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeScroll}>
          {MODES.map((m) => {
            const isSelected = selectedMode === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.modePill, isSelected && styles.modePillActive]}
                onPress={() => setSelectedMode(m.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={m.icon}
                  size={14}
                  color={isSelected ? '#003D2E' : '#FFFFFF'}
                />
                <Text style={[styles.modePillText, isSelected && styles.modePillTextActive]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Suggested Prompt Chips */}
        <View style={styles.suggestionsSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
            {filteredPrompts.map((p) => (
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
            const isMsgUrdu = m.language === 'ur';

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
                  {/* Mode Badge for assistant */}
                  {!isUser && m.mode && (
                    <View style={styles.msgModeBadge}>
                      <Text style={styles.msgModeBadgeText}>
                        {m.mode === 'quiz' ? '🧠 Quiz' : m.mode === 'vocab' ? '🔤 Vocabulary' : m.mode === 'summary' ? '⚡ Summary' : '🎓 Tutor'}
                      </Text>
                    </View>
                  )}

                  {/* Main Explanation Text */}
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.assistantMessageText,
                      isMsgUrdu ? styles.urduText : styles.englishText,
                    ]}
                  >
                    {m.text}
                  </Text>

                  {/* Interactive Quiz Component */}
                  {m.quiz && (
                    <View style={styles.quizContainer}>
                      <View style={styles.quizHeader}>
                        <Ionicons name="help-circle" size={18} color="#005F46" />
                        <Text style={styles.quizTitle}>
                          {language === 'en' ? 'Knowledge Check Question:' : 'خود تشخیصی سوال:'}
                        </Text>
                      </View>
                      <Text style={styles.quizQuestionText}>{m.quiz.question}</Text>

                      <View style={styles.quizOptionsList}>
                        {m.quiz.options.map((opt, idx) => {
                          const isSelected = m.quiz?.userSelectedId === opt.id;
                          const answered = m.quiz?.answered;
                          const isCorrect = opt.isCorrect;

                          let btnStyle: any = styles.quizOptionBtn;
                          let textStyle: any = styles.quizOptionText;

                          if (answered) {
                            if (isCorrect) {
                              btnStyle = styles.quizOptionCorrect;
                              textStyle = styles.quizOptionTextCorrect;
                            } else if (isSelected) {
                              btnStyle = styles.quizOptionIncorrect;
                              textStyle = styles.quizOptionTextIncorrect;
                            }
                          }

                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={btnStyle}
                              onPress={() => !answered && handleQuizAnswer(m.id, opt.id)}
                              disabled={answered}
                              activeOpacity={0.8}
                            >
                              <View style={styles.quizOptLetterBox}>
                                <Text style={styles.quizOptLetter}>
                                  {String.fromCharCode(65 + idx)}
                                </Text>
                              </View>
                              <Text style={textStyle}>{opt.text}</Text>
                              {answered && isCorrect && (
                                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                              )}
                              {answered && isSelected && !isCorrect && (
                                <Ionicons name="close-circle" size={18} color="#DC2626" />
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Explanation Reveal */}
                      {m.quiz.answered && (
                        <View style={styles.quizExplanationBox}>
                          <Text style={styles.quizExplanationTitle}>
                            {language === 'en' ? '📖 Scholarly Insight:' : '📖 علمی وضاحت:'}
                          </Text>
                          <Text style={styles.quizExplanationText}>
                            {m.quiz.options.find((o) => o.id === m.quiz?.userSelectedId)?.explanation ||
                             m.quiz.options.find((o) => o.isCorrect)?.explanation}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Vocabulary Root Breakdown */}
                  {m.vocab && m.vocab.length > 0 && (
                    <View style={styles.vocabContainer}>
                      <Text style={styles.vocabHeader}>
                        {language === 'en' ? '🔤 Vocabulary & Roots Breakdown:' : '🔤 قرآنی مفردات و مادۂ اشتقاق:'}
                      </Text>
                      {m.vocab.map((v, idx) => (
                        <View key={idx} style={styles.vocabItemCard}>
                          <View style={styles.vocabTopRow}>
                            <Text style={styles.vocabArabic}>{v.arabic}</Text>
                            <View style={styles.vocabRootBadge}>
                              <Text style={styles.vocabRootText}>Root: {v.root}</Text>
                            </View>
                          </View>
                          <Text style={styles.vocabTranslit}>{v.transliteration}</Text>
                          <Text style={styles.vocabMeaning}>• {v.meaning}</Text>
                          {v.quranExample && (
                            <Text style={styles.vocabExample}>Ayah: {v.quranExample}</Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Fatwa Redirect Button */}
                  {m.isRedirect && (
                    <TouchableOpacity
                      style={styles.redirectBtn}
                      onPress={() => router.push('/fatawa' as any)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="ribbon" size={16} color="#005F46" />
                      <Text style={styles.redirectBtnText}>
                        {language === 'en'
                          ? 'Ask Ustaadha in Dar-ul-Iftaa'
                          : 'دار الافتاء میں سوال بھیجیں (Ask Ustaadha)'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Bubble Actions */}
                  {!isUser && (
                    <View style={styles.bubbleActions}>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleSaveNote(m)}
                      >
                        <Ionicons name="bookmark-outline" size={13} color="#C8A84E" />
                        <Text style={[styles.actionBtnText, { color: '#B45309' }]}>
                          {language === 'en' ? 'Save Note' : 'محفوظ کریں'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleCopy(m.text)}
                      >
                        <Ionicons name="copy-outline" size={13} color="#64748B" />
                        <Text style={styles.actionBtnText}>
                          {language === 'en' ? 'Copy' : 'کاپی'}
                        </Text>
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
              <Text style={styles.loadingText}>
                {language === 'en'
                  ? 'Analyzing sacred texts & preparing guidance...'
                  : 'جواب تیار کیا جا رہا ہے...'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Bottom Input Box with Voice Input Button (8.2) */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {isRecording ? (
            <View style={styles.recordingRow}>
              <View style={styles.recordingPill}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTime}>
                  {Math.floor(recordingDurationMs / 1000)}s
                </Text>
                <Text style={styles.recordingStatusText}>
                  {language === 'en' ? 'Listening to your question...' : 'آواز ریکارڈ ہو رہی ہے...'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.cancelRecordBtn}
                onPress={() => stopRecording(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopRecordBtn}
                onPress={() => stopRecording(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder={
                  language === 'en'
                    ? 'Ask your Sabaq question in English...'
                    : 'اپنے سبق کا سوال لکھیں یا مائیک دبائیں...'
                }
                placeholderTextColor="#94A3B8"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={600}
              />

              {/* 8.2 Microphone Voice Input Button */}
              <TouchableOpacity
                style={styles.micBtn}
                onPress={startRecording}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityLabel="Ask Question with Voice"
              >
                <Ionicons name="mic" size={20} color="#005F46" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
                onPress={() => handleSend()}
                disabled={!input.trim() || loading}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Saved Sabaq Notes Modal */}
      <Modal
        visible={notesModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setNotesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleWrap}>
                <Ionicons name="bookmarks" size={20} color="#C8A84E" />
                <Text style={styles.modalTitle}>
                  {language === 'en' ? 'Saved Sabaq Notes' : 'محفوظ شدہ تعلیمی نوٹس'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setNotesModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {savedNotes.length === 0 ? (
              <View style={styles.emptyNotesWrap}>
                <Ionicons name="journal-outline" size={48} color="#CBD5E1" />
                <Text style={styles.emptyNotesText}>
                  {language === 'en'
                    ? 'No saved sabaq notes yet.\nTap "Save Note" on any AI response to study offline!'
                    : 'ابھی تک کوئی نوٹ محفوظ نہیں ہے۔\nکسی بھی جواب پر "محفوظ کریں" دبائیں!'}
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.notesListScroll} showsVerticalScrollIndicator={false}>
                {savedNotes.map((note) => (
                  <View key={note.id} style={styles.noteCard}>
                    <View style={styles.noteCardTop}>
                      <View style={styles.noteTag}>
                        <Text style={styles.noteTagText}>{note.mode.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.noteDate}>
                        {new Date(note.savedAt).toLocaleDateString()}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeleteNote(note.id)}
                        style={styles.noteDeleteBtn}
                      >
                        <Ionicons name="trash-outline" size={15} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.noteCardTopic}>{note.topic}</Text>
                    <Text style={styles.noteCardContent} numberOfLines={4}>
                      {note.content}
                    </Text>
                    <TouchableOpacity
                      style={styles.noteCopyBtn}
                      onPress={() => handleCopy(note.content)}
                    >
                      <Ionicons name="copy-outline" size={12} color="#005F46" />
                      <Text style={styles.noteCopyText}>
                        {language === 'en' ? 'Copy Full Note' : 'مکمل نوٹ کاپی کریں'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
  micBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 95, 70, 0.12)',
    borderWidth: 1.5,
    borderColor: '#005F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  recordingRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  recordingPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DC2626',
  },
  recordingTime: {
    fontSize: 13,
    fontWeight: '900',
    color: '#DC2626',
  },
  recordingStatusText: {
    fontSize: 11,
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
  },
  cancelRecordBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopRecordBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextAutoBadge: {
    backgroundColor: 'rgba(200, 168, 78, 0.25)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  contextAutoBadgeText: {
    color: '#C8A84E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  langToggleBtn: {
    backgroundColor: '#C8A84E',
    paddingHorizontal: 8,
  },
  langToggleText: {
    color: '#002E23',
    fontWeight: '900',
    fontSize: 11,
  },
  contextBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#003D2E',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(200,168,78,0.2)',
    gap: 8,
  },
  contextBannerTextWrap: {
    flex: 1,
  },
  contextBannerLabel: {
    fontSize: 10,
    color: '#C8A84E',
    fontWeight: '700',
  },
  contextBannerTitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  contextAskBtn: {
    backgroundColor: '#C8A84E',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  contextAskBtnText: {
    fontSize: 11,
    color: '#002E23',
    fontWeight: '800',
  },
  modeBar: {
    backgroundColor: '#00251C',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modeScroll: {
    paddingHorizontal: SPACING.md,
    gap: 8,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    gap: 5,
  },
  modePillActive: {
    backgroundColor: '#C8A84E',
  },
  modePillText: {
    fontSize: 11,
    color: '#F1F5F9',
    fontWeight: '600',
  },
  modePillTextActive: {
    color: '#002E23',
    fontWeight: '800',
  },
  msgModeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  msgModeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  urduText: {
    textAlign: 'right',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
    lineHeight: 23,
  },
  englishText: {
    textAlign: 'left',
    lineHeight: 20,
  },
  quizContainer: {
    marginTop: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 8,
  },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quizTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005F46',
  },
  quizQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 19,
  },
  quizOptionsList: {
    gap: 6,
    marginTop: 4,
  },
  quizOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  quizOptionCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  quizOptionIncorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  quizOptLetterBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizOptLetter: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  quizOptionText: {
    flex: 1,
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '500',
  },
  quizOptionTextCorrect: {
    flex: 1,
    fontSize: 12,
    color: '#15803D',
    fontWeight: '700',
  },
  quizOptionTextIncorrect: {
    flex: 1,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  quizExplanationBox: {
    marginTop: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.sm,
    padding: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#005F46',
  },
  quizExplanationTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#005F46',
    marginBottom: 2,
  },
  quizExplanationText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 16,
  },
  vocabContainer: {
    marginTop: 10,
    gap: 8,
  },
  vocabHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#005F46',
    marginBottom: 2,
  },
  vocabItemCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.sm,
    padding: 10,
    gap: 3,
  },
  vocabTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  vocabArabic: {
    fontSize: 18,
    fontWeight: '800',
    color: '#003D2E',
    fontFamily: Platform.select({ ios: 'Geeza Pro', default: 'sans-serif' }),
  },
  vocabRootBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  vocabRootText: {
    fontSize: 10,
    color: '#92400E',
    fontWeight: '700',
  },
  vocabTranslit: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#64748B',
  },
  vocabMeaning: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '600',
  },
  vocabExample: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingHorizontal: SPACING.md,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyNotesWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyNotesText: {
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
  },
  notesListScroll: {
    paddingVertical: 12,
  },
  noteCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 10,
    gap: 6,
  },
  noteCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  noteTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0369A1',
  },
  noteDate: {
    fontSize: 10,
    color: '#94A3B8',
    flex: 1,
    marginLeft: 8,
  },
  noteDeleteBtn: {
    padding: 4,
  },
  noteCardTopic: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  noteCardContent: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 17,
  },
  noteCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  noteCopyText: {
    fontSize: 11,
    color: '#005F46',
    fontWeight: '700',
  },
});
