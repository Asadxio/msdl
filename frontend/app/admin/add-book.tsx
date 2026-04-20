import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';
import { useData } from '@/context/DataContext';
import {
  collection, addDoc, serverTimestamp, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

const INITIAL_BOOKS = [
  {
    title: 'Risala Roohi Sharif',
    pdf_url: 'https://drive.google.com/uc?export=download&id=1dPpKvnyAbm12KrNmBeAu-D1vDPptTCSS',
    category: 'Islamic',
  },
  {
    title: 'Misbah-ul-Insha (Part 1)',
    pdf_url: 'https://drive.google.com/uc?export=download&id=1tromWQXftr5YGpeZEIeom08D8fJA1In0',
    category: 'Urdu',
  },
  {
    title: 'Uroos ul Adab',
    pdf_url: 'https://drive.google.com/uc?export=download&id=1cCUxnWZfNrC9uvQNhc8O5obquAG3NBxs',
    category: 'Urdu',
  },
  {
    title: 'Qirat Course (قرأت کورس)',
    pdf_url: 'https://drive.google.com/uc?export=download&id=1BGhHAGzeM_8M8O_mQpUgxSyQAqfVVke5',
    category: 'Qirat',
  },
];

export default function AddBookScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { books, addBook, refetchBooks } = useData();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [title, setTitle] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [formError, setFormError] = useState('');
  const [focusedField, setFocusedField] = useState<'title' | 'pdfUrl' | 'newCategory' | 'editCategory' | null>(null);

  useEffect(() => {
    if (profile && !isAdmin) {
      router.replace('/');
    }
  }, [profile, isAdmin, router]);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const arr: { id: string; name: string }[] = [];
      snap.forEach((d) => arr.push({ id: d.id, name: String((d.data() as any).name || '') }));
      setCategories(arr.filter((c) => c.name.trim()));
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!isAdmin) {
      Alert.alert('Unauthorized', 'Only admin can add books.');
      return;
    }
    if (!title.trim() || !pdfUrl.trim() || !category.trim()) {
      setFormError('Book title, PDF link, and category are required.');
      Alert.alert('Missing Fields', 'Please fill in all fields');
      return;
    }
    setFormError('');
    setSaving(true);
    const selected = categories.find((c) => c.id === category);
    const success = await addBook(title.trim(), pdfUrl.trim(), selected?.name?.trim() || '', selected?.id);
    setSaving(false);
    if (success) {
      Alert.alert('Success', 'Book added successfully', [
        { text: 'OK', onPress: () => { setTitle(''); setPdfUrl(''); setCategory(''); } },
      ]);
    } else {
      Alert.alert('Error', 'Failed to add book. Please try again.');
    }
  };

  const handleSeedBooks = async () => {
    if (!isAdmin) {
      Alert.alert('Unauthorized', 'Only admin can add books.');
      return;
    }
    setSeeding(true);
    try {
      let added = 0;
      for (const book of INITIAL_BOOKS) {
        // Check if book already exists by title
        const exists = books.some((b) => b.title === book.title);
        if (!exists) {
          await addDoc(collection(db, 'library'), {
            ...book,
            created_at: serverTimestamp(),
          });
          added++;
        }
      }
      await refetchBooks();
      Alert.alert('Success', `${added} books added to library`);
    } catch (err: any) {
      Alert.alert('Error', 'Failed to seed books: ' + (err?.message || 'Unknown error'));
    } finally {
      setSeeding(false);
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) {
      Alert.alert('Missing', 'Category name is required.');
      return;
    }
    await addDoc(collection(db, 'categories'), { name, created_at: serverTimestamp() });
    setNewCategory('');
  };

  const saveEditedCategory = async () => {
    const name = editingCategoryName.trim();
    if (!editingCategoryId || !name) {
      Alert.alert('Missing', 'Category name is required.');
      return;
    }
    await updateDoc(doc(db, 'categories', editingCategoryId), { name });
    setEditingCategoryId('');
    setEditingCategoryName('');
  };

  const deleteCategory = (item: { id: string; name: string }) => {
    Alert.alert('Delete Category', `Delete "${item.name}" category?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'categories', item.id));
          if (category === item.id) setCategory('');
        },
      },
    ]);
  };

  if (profile && !isAdmin) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            testID="add-book-back-btn"
          >
            <Ionicons name="close" size={22} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Add Book</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {/* Seed Initial Books */}
          <TouchableOpacity
            style={styles.seedBtn}
            testID="seed-books-btn"
            activeOpacity={0.8}
            onPress={handleSeedBooks}
            disabled={seeding}
          >
            {seeding ? (
              <ActivityIndicator size="small" color={COLORS.secondary} />
            ) : (
              <Ionicons name="cloud-download-outline" size={20} color={COLORS.secondary} />
            )}
            <Text style={styles.seedBtnText}>
              {seeding ? 'Adding books...' : 'Load Initial Books (4 books)'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or add manually</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.label}>Book Title</Text>
            <TextInput
              style={[styles.input, focusedField === 'title' && styles.inputFocused]}
              placeholder="Enter book title"
              placeholderTextColor={COLORS.textMuted}
              value={title}
              onChangeText={setTitle}
              onFocus={() => setFocusedField('title')}
              onBlur={() => setFocusedField(null)}
              testID="book-title-input"
            />
          </View>

          {/* PDF URL */}
          <View style={styles.field}>
            <Text style={styles.label}>PDF Link (Google Drive)</Text>
            <TextInput
              style={[styles.input, focusedField === 'pdfUrl' && styles.inputFocused]}
              placeholder="https://drive.google.com/..."
              placeholderTextColor={COLORS.textMuted}
              value={pdfUrl}
              onChangeText={setPdfUrl}
              autoCapitalize="none"
              keyboardType="url"
              onFocus={() => setFocusedField('pdfUrl')}
              onBlur={() => setFocusedField(null)}
              testID="book-pdf-url-input"
            />
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.rowInline}>
              <TextInput
                style={[styles.input, { flex: 1 }, focusedField === 'newCategory' && styles.inputFocused]}
                placeholder="Add category name"
                placeholderTextColor={COLORS.textMuted}
                value={newCategory}
                onChangeText={setNewCategory}
                onFocus={() => setFocusedField('newCategory')}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity style={styles.smallBtn} onPress={addCategory}>
                <Text style={styles.smallBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.categoryGrid}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.categoryRow}>
                  <TouchableOpacity
                    style={[styles.categoryChip, category === cat.id && styles.categoryChipActive]}
                    onPress={() => setCategory(cat.id)}
                    testID={`category-chip-${cat.name}`}
                  >
                    <Text style={[styles.categoryChipText, category === cat.id && styles.categoryChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}>
                    <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteCategory(cat)}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            {editingCategoryId ? (
              <View style={styles.rowInline}>
                <TextInput
                  style={[styles.input, { flex: 1 }, focusedField === 'editCategory' && styles.inputFocused]}
                  placeholder="Edit category name"
                  placeholderTextColor={COLORS.textMuted}
                  value={editingCategoryName}
                  onChangeText={setEditingCategoryName}
                  onFocus={() => setFocusedField('editCategory')}
                  onBlur={() => setFocusedField(null)}
                />
                <TouchableOpacity style={styles.smallBtn} onPress={saveEditedCategory}>
                  <Text style={styles.smallBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, (!title || !pdfUrl || !category) && styles.saveBtnDisabled]}
            testID="save-book-btn"
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving || !title || !pdfUrl || !category}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save Book</Text>
              </>
            )}
          </TouchableOpacity>
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

          {/* Current Books Count */}
          <Text style={styles.infoText}>
            Currently {books.length} books in library
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  topBarTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  body: { padding: SPACING.lg, gap: SPACING.lg, paddingBottom: 50 },
  seedBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.lg, ...SHADOWS.card,
  },
  seedBtnText: { color: COLORS.secondary, fontSize: 15, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  input: {
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: 14,
    fontSize: 15, color: COLORS.textMain,
  },
  inputFocused: { borderColor: COLORS.primary, shadowColor: COLORS.primary, shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryChip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.full,
    borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  categoryChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.surfaceAlt },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  categoryChipTextActive: { color: COLORS.primary },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 12 },
  smallBtnText: { color: '#fff', fontWeight: '700' },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: RADIUS.lg,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  errorText: { fontSize: 12, color: COLORS.error, fontWeight: '600', marginTop: -6 },
  infoText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center' },
});
