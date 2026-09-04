import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBackOrReplace } from '@/lib/navigation';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import {
  getBookProgress,
  saveBookProgress,
  getLibraryTheme,
  saveLibraryTheme,
  type ReadingTheme,
} from '@/lib/libraryStorage';

const THEME_CONFIG: Record<ReadingTheme, { bg: string; text: string; headerBg: string; border: string; webCss: string; status: 'dark-content' | 'light-content' }> = {
  light: {
    bg: COLORS.background,
    text: COLORS.textMain,
    headerBg: COLORS.surface,
    border: COLORS.border,
    webCss: '',
    status: 'dark-content',
  },
  sepia: {
    bg: '#FBF0D9',
    text: '#5F4B32',
    headerBg: '#F4E4C1',
    border: '#E8D5B0',
    webCss: 'body, html { background-color: #FBF0D9 !important; filter: sepia(0.65) brightness(0.95) contrast(1.05) !important; }',
    status: 'dark-content',
  },
  night: {
    bg: '#121212',
    text: '#E5E7EB',
    headerBg: '#1E1E1E',
    border: '#2E2E2E',
    webCss: 'body, html { background-color: #121212 !important; filter: invert(0.9) hue-rotate(180deg) brightness(0.9) !important; }',
    status: 'light-content',
  },
};

export default function BookViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { books, booksLoading } = useData();
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [webViewErrorMessage, setWebViewErrorMessage] = useState('Unable to preview this file.');
  const [isReading, setIsReading] = useState(false);

  // Reading Enhancements: Theme & Page Progress
  const [readingTheme, setReadingTheme] = useState<ReadingTheme>('light');
  const [lastReadPage, setLastReadPage] = useState<number>(1);
  const [targetPageInput, setTargetPageInput] = useState<string>('1');
  const [showPageJumpModal, setShowPageJumpModal] = useState<boolean>(false);
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (!id) return;
    // Load persisted progress and theme
    getBookProgress(id).then((progress) => {
      if (progress) {
        setLastReadPage(progress.lastPage || 1);
        setTargetPageInput(String(progress.lastPage || 1));
        if (progress.theme) setReadingTheme(progress.theme);
      } else {
        getLibraryTheme().then((theme) => {
          if (theme) setReadingTheme(theme);
        });
      }
    });
  }, [id]);

  if (booksLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading book...</Text>
        </View>
      </View>
    );
  }

  const book = books.find((b) => b.id === id);
  if (!book) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => goBackOrReplace(router, '/(tabs)/library')}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
          <Text style={styles.errorBackText}>Go Back</Text>
        </TouchableOpacity>
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.border} />
          <Text style={styles.errorTitle}>Book not found</Text>
        </View>
      </View>
    );
  }

  const currentTheme = THEME_CONFIG[readingTheme];

  // Google Docs Viewer with page bookmark anchor
  const baseViewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(book.pdf_url)}`;
  const viewerUrl = lastReadPage > 1 ? `${baseViewerUrl}#page=${lastReadPage}` : baseViewerUrl;

  const catColor = (book.category && {
    Islamic: { bg: '#E8F5E9', text: '#2E7D32' },
    Urdu: { bg: '#FFF3E0', text: '#E65100' },
    Qirat: { bg: '#E3F2FD', text: '#1565C0' },
    Hadith: { bg: '#FCE4EC', text: '#AD1457' },
    Fiqh: { bg: '#F3E5F5', text: '#7B1FA2' },
    Tafseer: { bg: COLORS.goldBg, text: COLORS.goldText },
  }[book.category]) || { bg: COLORS.surfaceAlt, text: COLORS.textMuted };
  
  const iconName = (book.category && {
    Islamic: 'moon',
    Urdu: 'language',
    Qirat: 'mic',
    Hadith: 'book',
    Fiqh: 'document-text',
    Tafseer: 'reader',
  }[book.category]) || 'book';

  const handleDownload = () => {
    Linking.openURL(book.pdf_url).catch(() => {
      Linking.openURL(book.pdf_url);
    });
  };

  const handleViewExternal = () => {
    Linking.openURL(viewerUrl).catch(() => {
      Linking.openURL(book.pdf_url);
    });
  };

  const handleThemeChange = async (theme: ReadingTheme) => {
    setReadingTheme(theme);
    setShowThemeModal(false);
    await saveLibraryTheme(theme);
    if (id) {
      await saveBookProgress(id, lastReadPage, theme);
    }
  };

  const handleJumpToPage = async (pageNumber: number) => {
    const validPage = Math.max(1, pageNumber);
    setLastReadPage(validPage);
    setShowPageJumpModal(false);
    if (id) {
      await saveBookProgress(id, validPage, readingTheme);
    }
    // Inject JS into WebView to scroll/jump to page if Google viewer is loaded
    const script = `
      try {
        if (window.location.hash !== '#page=${validPage}') {
          window.location.hash = '#page=${validPage}';
        }
        var pageElem = document.getElementById('page_${validPage}') || document.querySelector('[data-page-number="${validPage}"]');
        if (pageElem) {
          pageElem.scrollIntoView({ behavior: 'smooth' });
        }
      } catch(e) {}
      true;
    `;
    webViewRef.current?.injectJavaScript(script);
  };

  // JavaScript injected for Theme Filter (Night / Sepia / Normal)
  const injectedCssJs = `
    (function() {
      try {
        var existingStyle = document.getElementById('msdl-reader-theme-style');
        if (!existingStyle) {
          existingStyle = document.createElement('style');
          existingStyle.id = 'msdl-reader-theme-style';
          document.head.appendChild(existingStyle);
        }
        existingStyle.innerHTML = "${currentTheme.webCss}";
      } catch(e) {}
    })();
    true;
  `;

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      <StatusBar barStyle={currentTheme.status} />

      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: currentTheme.headerBg, borderBottomColor: currentTheme.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: isReading ? (readingTheme === 'night' ? '#2A2A2A' : '#EDE8DC') : COLORS.surfaceAlt }]}
          onPress={() => {
            if (isReading) setIsReading(false);
            else goBackOrReplace(router, '/(tabs)/library');
          }}
          testID="book-viewer-back-btn"
          activeOpacity={0.8}
        >
          <Ionicons name={isReading ? "close" : "arrow-back"} size={22} color={currentTheme.text} />
        </TouchableOpacity>

        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: currentTheme.text }]} numberOfLines={1}>
            {isReading ? book.title : "Book Details"}
          </Text>
          {isReading && (
            <TouchableOpacity
              style={styles.pageJumpBadge}
              onPress={() => {
                setTargetPageInput(String(lastReadPage));
                setShowPageJumpModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="bookmark" size={11} color={COLORS.primary} />
              <Text style={styles.pageJumpBadgeText}>Safah (Page) {lastReadPage} ▾</Text>
            </TouchableOpacity>
          )}
        </View>

        {isReading ? (
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={[styles.iconActionBtn, { backgroundColor: readingTheme === 'night' ? '#2A2A2A' : '#EDE8DC' }]}
              onPress={() => setShowThemeModal(true)}
              activeOpacity={0.7}
              accessibilityLabel="Change Reading Theme"
            >
              <Ionicons
                name={readingTheme === 'night' ? 'moon' : readingTheme === 'sepia' ? 'sunny' : 'contrast-outline'}
                size={20}
                color={readingTheme === 'night' ? '#FDE047' : readingTheme === 'sepia' ? '#D97706' : currentTheme.text}
              />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: 48 }} />
        )}
      </View>

      {!isReading ? (
        <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.coverArea, { backgroundColor: catColor.bg }]}>
            <Ionicons name={iconName as any} size={84} color={catColor.text} />
          </View>
          <View style={styles.metadataSection}>
            <View style={[styles.categoryBadge, { backgroundColor: catColor.bg }]}>
              <Text style={[styles.categoryText, { color: catColor.text }]}>{book.category}</Text>
            </View>
            <Text style={styles.bookTitle}>{book.title}</Text>
            {book.description ? (
              <Text style={styles.bookDescription}>{book.description}</Text>
            ) : (
              <Text style={[styles.bookDescription, { fontStyle: 'italic', color: COLORS.textMuted }]}>
                No description available for this book.
              </Text>
            )}

            {/* Last Read Bookmark Badge */}
            {lastReadPage > 1 && (
              <View style={styles.lastReadCard}>
                <Ionicons name="bookmark" size={16} color={COLORS.primary} />
                <Text style={styles.lastReadText}>
                  Aakhri martaba aap <Text style={{ fontWeight: '700' }}>Safah {lastReadPage}</Text> par the
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              activeOpacity={0.8}
              onPress={() => setIsReading(true)}
            >
              <Ionicons name="book" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>
                {lastReadPage > 1 ? `Resume from Page ${lastReadPage}` : "Read Book"}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.actionRowAlt}>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                activeOpacity={0.8}
                onPress={handleViewExternal}
              >
                <Ionicons name="open-outline" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryActionBtnText}>Open External</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryActionBtn}
                activeOpacity={0.8}
                onPress={handleDownload}
              >
                <Ionicons name="download-outline" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryActionBtnText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.webViewContainer}>
          {/* Action Row inside Reader */}
          <View style={[styles.actionRow, { backgroundColor: currentTheme.headerBg, borderBottomColor: currentTheme.border }]}>
            <TouchableOpacity
              style={[styles.miniReaderBtn, { backgroundColor: currentTheme.bg, borderColor: currentTheme.border }]}
              onPress={() => handleJumpToPage(Math.max(1, lastReadPage - 1))}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={16} color={currentTheme.text} />
              <Text style={[styles.miniReaderBtnText, { color: currentTheme.text }]}>Prev</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pageIndicatorPill, { backgroundColor: currentTheme.bg, borderColor: currentTheme.border }]}
              onPress={() => {
                setTargetPageInput(String(lastReadPage));
                setShowPageJumpModal(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="book-outline" size={14} color={COLORS.primary} />
              <Text style={[styles.pageIndicatorText, { color: currentTheme.text }]}>Page {lastReadPage}</Text>
              <Ionicons name="create-outline" size={12} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.miniReaderBtn, { backgroundColor: currentTheme.bg, borderColor: currentTheme.border }]}
              onPress={() => handleJumpToPage(lastReadPage + 1)}
              activeOpacity={0.7}
            >
              <Text style={[styles.miniReaderBtnText, { color: currentTheme.text }]}>Next</Text>
              <Ionicons name="chevron-forward" size={16} color={currentTheme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.miniReaderBtn, styles.downloadBtnAlt]}
              onPress={handleDownload}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {webViewLoading && (
            <View style={[styles.webViewOverlay, { backgroundColor: currentTheme.bg }]}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={[styles.loadingText, { color: currentTheme.text }]}>Loading Reader...</Text>
            </View>
          )}

          {webViewError ? (
            <View style={styles.centerContainer}>
              <Ionicons name="document-outline" size={56} color={COLORS.border} />
              <Text style={[styles.errorTitle, { color: currentTheme.text }]}>Couldn't preview this file</Text>
              <Text style={styles.errorDesc}>{webViewErrorMessage}</Text>
              <View style={styles.errorActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleViewExternal}>
                  <Ionicons name="open-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.actionBtnText}>Open Externally</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} onPress={handleDownload}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={[styles.actionBtnText, { color: '#fff' }]}>Download</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <WebView
              ref={webViewRef}
              source={{ uri: viewerUrl }}
              style={[styles.webView, { backgroundColor: currentTheme.bg }]}
              injectedJavaScript={injectedCssJs}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => {
                setWebViewLoading(false);
                webViewRef.current?.injectJavaScript(injectedCssJs);
              }}
              onHttpError={() => {
                setWebViewErrorMessage('File may be too large for inline preview. Use Open Externally or Download.');
                setWebViewError(true);
                setWebViewLoading(false);
              }}
              onError={() => {
                setWebViewErrorMessage('Use Open Externally or Download to continue.');
                setWebViewError(true);
                setWebViewLoading(false);
              }}
              javaScriptEnabled
              startInLoadingState
              testID="pdf-webview"
            />
          )}
        </View>
      )}

      {/* Page Jump Modal */}
      <Modal
        visible={showPageJumpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPageJumpModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowPageJumpModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Jump to Page (صفحہ منتخب کریں)</Text>
            <Text style={styles.modalSubtitle}>Jis page number par jana chahte hain darj karein:</Text>

            <TextInput
              style={styles.pageInput}
              value={targetPageInput}
              onChangeText={setTargetPageInput}
              keyboardType="number-pad"
              placeholder="e.g. 25"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              selectTextOnFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowPageJumpModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  const p = parseInt(targetPageInput.trim(), 10);
                  if (!isNaN(p) && p >= 1) {
                    handleJumpToPage(p);
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>Go to Page</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Reading Mode / Theme Modal */}
      <Modal
        visible={showThemeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowThemeModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reading Mode (پڑھنے کا انداز)</Text>
            <Text style={styles.modalSubtitle}>Raat me ya halki roshni me aankhon ki hifazat ke liye:</Text>

            <View style={styles.themeOptionsGrid}>
              <TouchableOpacity
                style={[styles.themeCard, readingTheme === 'light' && styles.themeCardActive, { backgroundColor: '#FFFFFF' }]}
                onPress={() => handleThemeChange('light')}
              >
                <Ionicons name="sunny-outline" size={24} color="#1F2937" />
                <Text style={[styles.themeCardTitle, { color: '#1F2937' }]}>Normal (Day)</Text>
                <Text style={styles.themeCardDesc}>Standard white background</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeCard, readingTheme === 'sepia' && styles.themeCardActive, { backgroundColor: '#FBF0D9' }]}
                onPress={() => handleThemeChange('sepia')}
              >
                <Ionicons name="book-outline" size={24} color="#5F4B32" />
                <Text style={[styles.themeCardTitle, { color: '#5F4B32' }]}>Sepia (Warm)</Text>
                <Text style={[styles.themeCardDesc, { color: '#7E6850' }]}>Soft parchment for long reading</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.themeCard, readingTheme === 'night' && styles.themeCardActive, { backgroundColor: '#1A1A1A' }]}
                onPress={() => handleThemeChange('night')}
              >
                <Ionicons name="moon" size={24} color="#FDE047" />
                <Text style={[styles.themeCardTitle, { color: '#FFFFFF' }]}>Night (Dark)</Text>
                <Text style={[styles.themeCardDesc, { color: '#9CA3AF' }]}>Dark mode for night study</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowThemeModal(false)}
            >
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  detailsContent: { paddingBottom: SPACING.xl },
  coverArea: { alignItems: 'center', justifyContent: 'center', height: 280, marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  metadataSection: { padding: SPACING.lg, alignItems: 'center' },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, marginBottom: SPACING.md },
  categoryText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  bookTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: SPACING.sm },
  bookDescription: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.sm },
  
  lastReadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.goldBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    marginTop: SPACING.md,
  },
  lastReadText: {
    fontSize: 13,
    color: COLORS.goldText,
  },

  actionSection: { paddingHorizontal: SPACING.lg, gap: SPACING.md, marginTop: SPACING.md },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  actionRowAlt: { flexDirection: 'row', gap: SPACING.sm },
  secondaryActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  secondaryActionBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },

  container: { flex: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loadingText: { fontSize: 14, fontWeight: '500' },
  errorBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.lg },
  errorBackText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  errorTitle: { fontSize: 18, fontWeight: '700' },
  errorDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  errorActions: { marginTop: SPACING.sm, flexDirection: 'row', gap: SPACING.sm },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  topBarTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  pageJumpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  pageJumpBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  miniReaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  miniReaderBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageIndicatorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  pageIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
  },
  downloadBtnAlt: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.md, borderRadius: RADIUS.xxl, borderWidth: 2, borderColor: COLORS.primary,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  downloadBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  webViewContainer: { flex: 1, position: 'relative' },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  webView: { flex: 1 },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOWS.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  pageInput: {
    height: 48,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMain,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  themeOptionsGrid: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  themeCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  themeCardActive: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  themeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  themeCardDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
  },
});
