import fs from 'fs';
import path from 'path';
import { normalizeWhatsAppUrl, WHATSAPP_HELP_URL } from './links';

describe('phase 1 launch fixes', () => {
  it('normalizes WhatsApp links for Android/iOS web fallback and phone inputs', () => {
    expect(WHATSAPP_HELP_URL).toMatch(/^https:\/\/wa\.link\//);
    expect(normalizeWhatsAppUrl(WHATSAPP_HELP_URL)).toBe(WHATSAPP_HELP_URL);
    expect(normalizeWhatsAppUrl('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(normalizeWhatsAppUrl('whatsapp://send?phone=919876543210')).toBe('whatsapp://send?phone=919876543210');
  });

  it('keeps featured courses content mounted when expanded instead of animating from an unmeasured zero height', () => {
    const source = fs.readFileSync(path.join(__dirname, '../components/ExpandableSection.tsx'), 'utf8');
    expect(source).toContain('{expanded ? <View style={styles.content}>{children}</View> : null}');
    expect(source).not.toContain('contentHeight');
  });

  it('adds chat, admin quiz, and student quiz refresh controls', () => {
    const chats = fs.readFileSync(path.join(__dirname, '../app/(tabs)/chats.tsx'), 'utf8');
    const quiz = fs.readFileSync(path.join(__dirname, '../app/(tabs)/quiz.tsx'), 'utf8');
    expect(chats).toContain('accessibilityLabel="Refresh chats"');
    expect(chats).toContain('const refreshChats = useCallback(async () =>');
    expect(quiz).toContain('accessibilityLabel="Refresh quiz"');
    expect(quiz).toContain('<Text style={styles.refreshText}>Refresh</Text>');
  });

  it('allows user-scoped notification removal without deleting broadcast notifications for everyone', () => {
    const notifications = fs.readFileSync(path.join(__dirname, '../app/(tabs)/notifications.tsx'), 'utf8');
    const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
    expect(notifications).toContain("hidden_by: arrayUnion(user?.uid || '')");
    expect(notifications).toContain("setItems((prev) => prev.filter((entry) => entry.id !== item.id))");
    expect(rules).toContain("affectedKeys().hasOnly(['read', 'hidden_by'])");
    expect(rules).toContain('request.auth.uid in request.resource.data.hidden_by');
  });
});
