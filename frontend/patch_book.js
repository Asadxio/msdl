const fs = require('fs');
const f = 'app/book/[id].tsx';
let content = fs.readFileSync(f, 'utf8');

const CATEGORY_COLORS = {
  Islamic: { bg: '#E8F5E9', text: '#2E7D32' },
  Urdu: { bg: '#FFF3E0', text: '#E65100' },
  Qirat: { bg: '#E3F2FD', text: '#1565C0' },
  Hadith: { bg: '#FCE4EC', text: '#AD1457' },
  Fiqh: { bg: '#F3E5F5', text: '#7B1FA2' },
  Tafseer: { bg: '#FEF1EB', text: '#B54708' }, // gold Bg
};

const BOOK_ICONS = {
  Islamic: 'moon',
  Urdu: 'language',
  Qirat: 'mic',
  Hadith: 'book',
  Fiqh: 'document-text',
  Tafseer: 'reader',
};

// 1. Add imports if needed
if (!content.includes('ScrollView')) {
  content = content.replace("ActivityIndicator,", "ActivityIndicator,\n  ScrollView,");
}

// 2. Add State
content = content.replace(
  "const [webViewErrorMessage, setWebViewErrorMessage] = useState('Unable to preview this file.');",
  "const [webViewErrorMessage, setWebViewErrorMessage] = useState('Unable to preview this file.');\n  const [isReading, setIsReading] = useState(false);"
);

// 3. Helper variables
content = content.replace(
  "const viewerUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(book.pdf_url)}`;",
  `const viewerUrl = \`https://docs.google.com/gview?embedded=true&url=\${encodeURIComponent(book.pdf_url)}\`;
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
  }[book.category]) || 'book';`
);

// 4. Return statement replacement
const returnRegex = /return \(\s*<View style=\{styles\.container\}>[\s\S]*<\/View>\s*\);\s*\}\s*const styles = StyleSheet\.create\(\{/m;
const newReturn = `return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (isReading) setIsReading(false);
            else goBackOrReplace(router, '/(tabs)/library');
          }}
          testID="book-viewer-back-btn"
          activeOpacity={0.8}
        >
          <Ionicons name={isReading ? "close" : "arrow-back"} size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{isReading ? book.title : "Book Details"}</Text>
        <View style={{ width: 48 }} />
      </View>

      {!isReading ? (
        <ScrollView contentContainerStyle={styles.detailsContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.coverArea, { backgroundColor: catColor.bg }]}>
            <Ionicons name={iconName} size={84} color={catColor.text} />
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
          </View>
          
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={styles.primaryActionBtn}
              activeOpacity={0.8}
              onPress={() => setIsReading(true)}
            >
              <Ionicons name="book" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Read Book</Text>
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
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} activeOpacity={0.8} onPress={handleViewExternal}>
              <Ionicons name="open-outline" size={18} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>View Book</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} activeOpacity={0.8} onPress={handleDownload}>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Download</Text>
            </TouchableOpacity>
          </View>

          {webViewLoading && (
            <View style={styles.webViewOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading Reader...</Text>
            </View>
          )}
          {webViewError ? (
            <View style={styles.centerContainer}>
              <Ionicons name="document-outline" size={56} color={COLORS.border} />
              <Text style={styles.errorTitle}>Couldn't preview this file</Text>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({`;
content = content.replace(returnRegex, newReturn);

// 5. Add new styles
const extraStyles = `
  detailsContent: { paddingBottom: SPACING.xl },
  coverArea: { alignItems: 'center', justifyContent: 'center', height: 280, marginHorizontal: SPACING.lg, marginTop: SPACING.md, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  metadataSection: { padding: SPACING.lg, alignItems: 'center' },
  categoryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, marginBottom: SPACING.md },
  categoryText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  bookTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textMain, textAlign: 'center', marginBottom: SPACING.sm },
  bookDescription: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, paddingHorizontal: SPACING.sm },
  actionSection: { paddingHorizontal: SPACING.lg, gap: SPACING.md, marginTop: SPACING.md },
  primaryActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.xxl, ...SHADOWS.card },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  actionRowAlt: { flexDirection: 'row', gap: SPACING.sm },
  secondaryActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  secondaryActionBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
`;
content = content.replace("const styles = StyleSheet.create({", "const styles = StyleSheet.create({" + extraStyles);

fs.writeFileSync(f, content);
console.log('book/[id].tsx patched');
