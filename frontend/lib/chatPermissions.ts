/**
 * MSLB Centralized Chat Authorization & Permission Matrix
 * 
 * Enforces institutional chat boundaries for Students, Teachers, Admins, and Super Admins.
 * All client-side checks strictly mirror and pre-validate Firestore server rules.
 */

export interface ChatUserContext {
  uid: string;
  role: 'student' | 'teacher' | 'admin' | 'super_admin' | string;
  status?: string;
}

export interface ChatTargetContext {
  id: string;
  role: string;
  status?: string;
}

export interface ChatInstanceContext {
  id: string;
  type: 'direct' | 'group' | 'broadcast';
  participants: string[];
  created_by?: string;
  blocked_pairs?: string[];
}

export interface MessageContext {
  id: string;
  sender_id: string;
  chat_id: string;
  created_at_ms?: number;
}

/**
 * Determine if currentUser can initiate or open a direct chat with targetUser.
 * Universal direct messaging allows any authenticated active user to chat with any active target user.
 */
export function canInitiateDirectChat(
  currentUser: ChatUserContext | null | undefined,
  targetUser: ChatTargetContext | null | undefined,
): boolean {
  if (!currentUser || !targetUser) return false;
  if (!currentUser.uid || !targetUser.id) return false;
  if (currentUser.uid === targetUser.id) return false; // Self-chat denied

  // Target account safety check
  if (targetUser.status) {
    const s = targetUser.status.toLowerCase();
    if (s === 'suspended' || s === 'deactivated' || s === 'deleted' || s === 'banned' || s === 'inactive' || s === 'rejected') {
      return false;
    }
  }

  // Current user safety check
  if (currentUser.status) {
    const s = currentUser.status.toLowerCase();
    if (s === 'suspended' || s === 'deactivated' || s === 'deleted' || s === 'banned' || s === 'inactive' || s === 'rejected') {
      return false;
    }
  }

  // Universal direct messaging: all active roles (student, teacher, assistant_teacher, moderator, admin, super_admin)
  // are authorized to start 1-to-1 direct conversations.
  return true;
}

/**
 * Determine if currentUser is authorized to create a group chat.
 */
export function canCreateGroup(currentUser: ChatUserContext | null | undefined): boolean {
  if (!currentUser) return false;
  return currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator';
}

/**
 * Determine if currentUser is authorized to create a broadcast announcement.
 */
export function canCreateBroadcast(currentUser: ChatUserContext | null | undefined): boolean {
  if (!currentUser) return false;
  return currentUser.role === 'admin' || currentUser.role === 'super_admin';
}

/**
 * Determine if currentUser can post messages to the given chat.
 */
export function canSendMessage(
  currentUser: ChatUserContext | null | undefined,
  chat: ChatInstanceContext | null | undefined,
): boolean {
  if (!currentUser || !chat) return false;

  // Broadcast chats: strictly admin only
  if (chat.type === 'broadcast') {
    return currentUser.role === 'admin' || currentUser.role === 'super_admin';
  }

  // Direct & Group chats: must be an active participant
  if (!chat.participants.includes(currentUser.uid)) {
    return false;
  }

  // Check blocked pairs
  if (Array.isArray(chat.blocked_pairs) && chat.blocked_pairs.length > 0) {
    const isBlocked = chat.blocked_pairs.some(
      (pair) => pair.includes(currentUser.uid),
    );
    if (isBlocked) return false;
  }

  return true;
}

/**
 * Determine if currentUser can delete a message for everyone.
 */
export function canDeleteMessageForEveryone(
  currentUser: ChatUserContext | null | undefined,
  message: MessageContext | null | undefined,
): boolean {
  if (!currentUser || !message) return false;
  // Author can delete their own message
  if (message.sender_id === currentUser.uid) return true;
  // Admins/Super Admins have moderation override
  return currentUser.role === 'admin' || currentUser.role === 'super_admin';
}

export const DEFAULT_DELETE_WINDOW_MS = 30 * 60 * 1000;

/**
 * Determine if currentUser can delete a message for everyone within a time window (e.g. 30 minutes).
 * Admins/Super Admins bypass the time limit.
 */
export function canDeleteMessageForEveryoneWithWindow(
  currentUser: ChatUserContext | null | undefined,
  message: MessageContext | null | undefined,
  windowMs: number = DEFAULT_DELETE_WINDOW_MS,
  nowMs: number = Date.now(),
): boolean {
  if (!currentUser || !message) return false;
  
  // Admins and Super Admins can always delete
  if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
    return true;
  }

  // Author only
  if (message.sender_id !== currentUser.uid) {
    return false;
  }

  // If timestamp is known, check against window
  if (typeof message.created_at_ms === 'number' && message.created_at_ms > 0) {
    return nowMs - message.created_at_ms <= windowMs;
  }

  return true;
}

/**
 * Determine if currentUser can add reactions to messages in a chat.
 */
export function canAddReaction(
  currentUser: ChatUserContext | null | undefined,
  chat: ChatInstanceContext | null | undefined,
): boolean {
  return canSendMessage(currentUser, chat);
}

/**
 * Get clear, institutional explanation for why an action is denied.
 */
export function getChatDenialExplanation(
  action: 'direct_chat' | 'create_group' | 'create_broadcast' | 'send_message' | 'delete_everyone',
  currentUser: ChatUserContext | null | undefined,
  targetUser?: ChatTargetContext | null | undefined,
  chat?: ChatInstanceContext | null | undefined,
): string {
  if (!currentUser) return 'You must be signed in to perform this action.';

  switch (action) {
    case 'direct_chat':
      if (targetUser && currentUser.uid === targetUser.id) {
        return 'You cannot start a chat with yourself.';
      }
      if (targetUser?.status) {
        const s = targetUser.status.toLowerCase();
        if (s === 'suspended' || s === 'deactivated' || s === 'deleted' || s === 'banned' || s === 'inactive' || s === 'rejected') {
          return 'This user account is currently inactive.';
        }
      }
      return 'Direct messaging is currently unavailable for this user.';

    case 'create_group':
      return 'Only teachers and administrators can create study groups.';

    case 'create_broadcast':
      return 'Only administrators can create institutional announcement channels.';

    case 'send_message':
      if (chat?.type === 'broadcast') {
        return 'Only administrators can send messages to the Announcements channel.';
      }
      if (chat && !chat.participants.includes(currentUser.uid)) {
        return 'You are not a participant in this conversation.';
      }
      return 'You cannot send messages to this conversation.';

    case 'delete_everyone':
      return 'Only the message author or an administrator can delete messages for everyone.';

    default:
      return 'This action is not permitted.';
  }
}

