import {
  canDeleteMessageForEveryoneWithWindow,
  DEFAULT_DELETE_WINDOW_MS,
  type ChatUserContext,
  type MessageContext,
} from './chatPermissions';

describe('Phase 50: Advanced Chat Interactions (Typing, Reply, Delete)', () => {
  describe('1. Real-time Typing Indicator Contract', () => {
    const formatTypingStatus = (typingUserNames: string[]): string => {
      if (typingUserNames.length === 0) return '';
      if (typingUserNames.length === 1) {
        return `${typingUserNames[0]} is typing... (لکھ رہے ہیں...)`;
      }
      if (typingUserNames.length === 2) {
        return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
      }
      return `${typingUserNames.length} people are typing...`;
    };

    it('returns empty string when no one is typing', () => {
      expect(formatTypingStatus([])).toBe('');
    });

    it('formats single user typing with Urdu phrase', () => {
      expect(formatTypingStatus(['Fatima'])).toBe('Fatima is typing... (لکھ رہے ہیں...)');
      expect(formatTypingStatus(['Teacher Zainab'])).toBe('Teacher Zainab is typing... (لکھ رہے ہیں...)');
    });

    it('formats two users typing together', () => {
      expect(formatTypingStatus(['Fatima', 'Aisha'])).toBe('Fatima and Aisha are typing...');
    });

    it('formats 3 or more users typing in group dars', () => {
      expect(formatTypingStatus(['Fatima', 'Aisha', 'Maryam'])).toBe('3 people are typing...');
      expect(formatTypingStatus(['U1', 'U2', 'U3', 'U4'])).toBe('4 people are typing...');
    });

    it('filters out stale typing indicators older than 10 seconds', () => {
      const now = 1700000000000;
      const typingMap: Record<string, { is_typing: boolean; updated_at_ms: number }> = {
        u1: { is_typing: true, updated_at_ms: now - 3000 },
        u2: { is_typing: true, updated_at_ms: now - 15000 },
        u3: { is_typing: false, updated_at_ms: now - 1000 },
      };

      const activeTyping = Object.entries(typingMap)
        .filter(([_, val]) => val.is_typing && now - val.updated_at_ms < 10000)
        .map(([uid]) => uid);

      expect(activeTyping).toEqual(['u1']);
    });
  });

  describe('2. Swipe-to-Reply & Quoted Message Contract', () => {
    it('constructs message with reply_to and reply_snippet attributes', () => {
      const parentMessage = {
        id: 'msg_parent_123',
        sender_id: 'teacher_1',
        sender_name: 'Ustazah Maryam',
        text: 'Surah Al-Baqarah Ayah 255 ka tarjuma yaad karein.',
        message_type: 'text' as const,
      };

      const replyPayload = {
        text: 'JazakAllah Khair, yaad ho gaya.',
        reply_to: parentMessage.id,
        reply_snippet: parentMessage.text,
      };

      expect(replyPayload.reply_to).toBe('msg_parent_123');
      expect(replyPayload.reply_snippet).toContain('Surah Al-Baqarah');
    });

    it('formats media reply snippet when replying to audio/image/document', () => {
      const getSnippet = (target: { text?: string; media_name?: string; message_type: string }) => {
        if (target.message_type === 'audio') return '🎤 Voice Message';
        if (target.message_type === 'image') return '📷 Photo';
        if (target.message_type === 'document') return `📄 ${target.media_name || 'Document'}`;
        return target.text || 'Message';
      };

      expect(getSnippet({ message_type: 'audio' })).toBe('🎤 Voice Message');
      expect(getSnippet({ message_type: 'image' })).toBe('📷 Photo');
      expect(getSnippet({ message_type: 'document', media_name: 'tajweed_notes.pdf' })).toBe('📄 tajweed_notes.pdf');
      expect(getSnippet({ message_type: 'text', text: 'Salam' })).toBe('Salam');
    });

    it('validates swipe gesture threshold (dx >= 50)', () => {
      const SWIPE_THRESHOLD = 50;
      const isSwipeTriggered = (dx: number) => dx >= SWIPE_THRESHOLD;

      expect(isSwipeTriggered(30)).toBe(false);
      expect(isSwipeTriggered(49)).toBe(false);
      expect(isSwipeTriggered(50)).toBe(true);
      expect(isSwipeTriggered(75)).toBe(true);
    });
  });

  describe('3. Delete for Everyone (30-Minute Grace Window & Admin Override)', () => {
    const studentUser: ChatUserContext = { uid: 'student_123', role: 'student' };
    const teacherUser: ChatUserContext = { uid: 'teacher_456', role: 'teacher' };
    const adminUser: ChatUserContext = { uid: 'admin_789', role: 'admin' };
    const superAdminUser: ChatUserContext = { uid: 'super_admin_000', role: 'super_admin' };

    const baseTime = 1700000000000;

    it('allows author to delete within 30 minutes', () => {
      const recentMessage: MessageContext = {
        id: 'm1',
        chat_id: 'c1',
        sender_id: studentUser.uid,
        created_at_ms: baseTime - 10 * 60 * 1000,
      };

      const canDelete = canDeleteMessageForEveryoneWithWindow(
        studentUser,
        recentMessage,
        DEFAULT_DELETE_WINDOW_MS,
        baseTime,
      );
      expect(canDelete).toBe(true);
    });

    it('blocks student from deleting message older than 30 minutes', () => {
      const oldMessage: MessageContext = {
        id: 'm2',
        chat_id: 'c1',
        sender_id: studentUser.uid,
        created_at_ms: baseTime - 35 * 60 * 1000,
      };

      const canDelete = canDeleteMessageForEveryoneWithWindow(
        studentUser,
        oldMessage,
        DEFAULT_DELETE_WINDOW_MS,
        baseTime,
      );
      expect(canDelete).toBe(false);
    });

    it('blocks teacher from deleting their own message older than 30 minutes', () => {
      const oldTeacherMessage: MessageContext = {
        id: 'm3',
        chat_id: 'c1',
        sender_id: teacherUser.uid,
        created_at_ms: baseTime - 45 * 60 * 1000,
      };

      const canDelete = canDeleteMessageForEveryoneWithWindow(
        teacherUser,
        oldTeacherMessage,
        DEFAULT_DELETE_WINDOW_MS,
        baseTime,
      );
      expect(canDelete).toBe(false);
    });

    it('allows admin and super admin to delete any message at any time', () => {
      const veryOldStudentMessage: MessageContext = {
        id: 'm4',
        chat_id: 'c1',
        sender_id: studentUser.uid,
        created_at_ms: baseTime - 5 * 24 * 60 * 60 * 1000,
      };

      expect(
        canDeleteMessageForEveryoneWithWindow(adminUser, veryOldStudentMessage, DEFAULT_DELETE_WINDOW_MS, baseTime),
      ).toBe(true);
      expect(
        canDeleteMessageForEveryoneWithWindow(superAdminUser, veryOldStudentMessage, DEFAULT_DELETE_WINDOW_MS, baseTime),
      ).toBe(true);
    });

    it('blocks student from deleting another user message even within 30 minutes', () => {
      const anotherStudentMessage: MessageContext = {
        id: 'm5',
        chat_id: 'c1',
        sender_id: 'other_student_999',
        created_at_ms: baseTime - 2 * 60 * 1000,
      };

      expect(
        canDeleteMessageForEveryoneWithWindow(studentUser, anotherStudentMessage, DEFAULT_DELETE_WINDOW_MS, baseTime),
      ).toBe(false);
    });
  });
});
