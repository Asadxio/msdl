import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { COLORS, SPACING, RADIUS } from '@/constants/theme';
import { useData } from '@/context/DataContext';

export default function BookViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { books, booksLoading } = useData();
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [webViewError, setWebViewError] = useState(false);
  const [webViewErrorMessage, setWebViewErrorMessage] = useState('Unable to preview this file.');

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
        <TouchableOpacity style={styles.errorBackBtn} onPress={() => router.back()}>
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

  // Safe URL preparation
  const safePdfUrl = (() => {
    const raw = String(book?.pdf_url || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  })();

  // Google Docs Viewer for PDFs
  const viewerUrl = safePdfUrl ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(safePdfUrl)}` : '';

  const handleDownload = async () => {
    if (!safePdfUrl) {
      Alert.alert('Invalid URL', 'This book does not have a valid download link.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(safePdfUrl);
      if (!canOpen) {
        Alert.alert('Cannot Open', 'Unable to open this link. Please try again later.');
        return;
      }
      await Linking.openURL(safePdfUrl);
    } catch (e) {
      console.log('[Book] handleDownload ERROR:', e);
      Alert.alert('Error', 'Unable to open download link.');
    }
  };

  const handleViewExternal = async () => {
    if (!viewerUrl) {
      Alert.alert('Invalid URL', 'This book does not have a valid view link.');
      return;
    }
    try {
      const canOpen = await Linking.canOpenURL(viewerUrl);
      if (!canOpen) {
        // Fallback to direct URL
        if (safePdfUrl) {
          await Linking.openURL(safePdfUrl);
        } else {
          Alert.alert('Cannot Open', 'Unable to open this link.');
        }
        return;
      }
      await Linking.openURL(viewerUrl);
    } catch (e) {
      console.log('[Book] handleViewExternal ERROR:', e);
      // Fallback to direct URL
      if (safePdfUrl) {
        try {
          await Linking.openURL(safePdfUrl);
        } catch {
          Alert.alert('Error', 'Unable to open book viewer.');
        }
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          testID="book-viewer-back-btn"
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{book.title}</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          testID="view-book-btn"
          activeOpacity={0.8}
          onPress={handleViewExternal}
        >
          <Ionicons name="open-outline" size={18} color={COLORS.primary} />
          <Text style={styles.actionBtnText}>View Book</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.downloadBtn]}
          testID="download-book-btn"
          activeOpacity={0.8}
          onPress={handleDownload}
        >
          <Ionicons name="download-outline" size={18} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Download</Text>
        </TouchableOpacity>
      </View>

      {/* PDF Viewer */}
      <View style={styles.webViewContainer}>
        {webViewLoading && (
          <View style={styles.webViewOverlay}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading PDF...</Text>
          </View>
        )}
        {webViewError ? (
          <View style={styles.centerContainer}>
            <Ionicons name="document-outline" size={56} color={COLORS.border} />
            <Text style={styles.errorTitle}>Couldn&apos;t preview this file</Text>
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
            source={{ uri: Platform.OS === 'web' ? viewerUrl : viewerUrl }}
            style={styles.webView}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loadingText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500' },
  errorBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: SPACING.lg },
  errorBackText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  errorTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  errorDesc: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center' },
  errorActions: { marginTop: SPACING.sm, flexDirection: 'row', gap: SPACING.sm },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.textMain, textAlign: 'center', marginHorizontal: 8 },
  actionRow: {
    flexDirection: 'row', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: RADIUS.lg, borderWidth: 2, borderColor: COLORS.primary,
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  downloadBtn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  webViewContainer: { flex: 1, position: 'relative' },
  webViewOverlay: {
    ...StyleSheet.absoluteFillObject, zIndex: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background,
  },
  webView: { flex: 1 },
});
