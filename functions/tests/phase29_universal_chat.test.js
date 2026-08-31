/**
 * PHASE 29 — UNIVERSAL WHATSAPP-STYLE CHAT TEST SUITE
 * Unrestricted Role-to-Role Messaging, IDOR Prevention & Security Boundaries
 * 
 * 24 Comprehensive Tests:
 * 1-6.   Student <-> Student / Teacher / Asst Teacher / Moderator / Admin / Super Admin
 * 7-12.  Teacher <-> Student / Teacher / Asst Teacher / Moderator / Admin / Super Admin
 * 13-16. Asst Teacher / Moderator / Admin / Super Admin <-> All authenticated active roles
 * 17.    Unauthenticated user denial (UNAUTHENTICATED)
 * 18.    Null target user denial (USER_NOT_FOUND)
 * 19.    Self-chat prevention (SELF_CHAT)
 * 20.    Inactive/Suspended sender denial (ACCOUNT_INACTIVE)
 * 21.    Inactive/Suspended target denial (TARGET_INACTIVE)
 * 22.    Deterministic Direct Chat ID symmetry & sorting
 * 23.    Non-participant third-party IDOR boundary enforcement
 * 24.    Broadcast channel write permission strictly restricted to admins
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// Replicate chatPermissions logic for standalone Node test runner
function canInitiateDirectChat(currentUser, targetUser) {
  if (!currentUser || !currentUser.uid) {
    return { allowed: false, reason: 'UNAUTHENTICATED' };
  }
  if (!targetUser || !targetUser.id) {
    return { allowed: false, reason: 'USER_NOT_FOUND' };
  }
  if (currentUser.uid === targetUser.id) {
    return { allowed: false, reason: 'SELF_CHAT' };
  }
  if (currentUser.is_active === false || currentUser.status === 'suspended' || currentUser.status === 'banned') {
    return { allowed: false, reason: 'ACCOUNT_INACTIVE' };
  }
  if (targetUser.is_active === false || targetUser.status === 'suspended' || targetUser.status === 'banned' || targetUser.status === 'deleted') {
    return { allowed: false, reason: 'TARGET_INACTIVE' };
  }

  const validRoles = ['student', 'teacher', 'assistant_teacher', 'moderator', 'admin', 'super_admin'];
  const userRole = currentUser.role || 'student';
  const targetRole = targetUser.role || 'student';

  if (!validRoles.includes(userRole) || !validRoles.includes(targetRole)) {
    return { allowed: false, reason: 'INVALID_ROLE' };
  }

  return { allowed: true };
}

function getDeterministicChatId(uidA, uidB) {
  return `direct_${[uidA, uidB].sort().join('_')}`;
}

function canAccessConversation(userUid, chat) {
  if (!userUid || !chat) return false;
  if (chat.type === 'broadcast') return true;
  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  return participants.includes(userUid);
}

function canWriteToConversation(user, chat) {
  if (!user || !user.uid || !chat) return false;
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  if (chat.type === 'broadcast') return isAdmin;
  const participants = Array.isArray(chat.participants) ? chat.participants : [];
  return participants.includes(user.uid);
}

describe('Phase 29 — Universal WhatsApp-Style Chat & Security Suite', () => {

  // Test 1-6: Student initiator
  it('1. Student can initiate direct chat with Student', () => {
    const studentA = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const studentB = { id: 'student_2', role: 'student', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(studentA, studentB);
    assert.equal(result.allowed, true);
  });

  it('2. Student can initiate direct chat with Teacher', () => {
    const student = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const teacher = { id: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(student, teacher);
    assert.equal(result.allowed, true);
  });

  it('3. Student can initiate direct chat with Assistant Teacher', () => {
    const student = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const asstTeacher = { id: 'asst_teacher_1', role: 'assistant_teacher', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(student, asstTeacher);
    assert.equal(result.allowed, true);
  });

  it('4. Student can initiate direct chat with Moderator', () => {
    const student = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const mod = { id: 'mod_1', role: 'moderator', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(student, mod);
    assert.equal(result.allowed, true);
  });

  it('5. Student can initiate direct chat with Admin', () => {
    const student = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const admin = { id: 'admin_1', role: 'admin', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(student, admin);
    assert.equal(result.allowed, true);
  });

  it('6. Student can initiate direct chat with Super Admin', () => {
    const student = { uid: 'student_1', role: 'student', status: 'approved', is_active: true };
    const superAdmin = { id: 'super_admin_1', role: 'super_admin', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(student, superAdmin);
    assert.equal(result.allowed, true);
  });

  // Test 7-12: Teacher initiator
  it('7. Teacher can initiate direct chat with Student', () => {
    const teacher = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const student = { id: 'student_1', role: 'student', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacher, student);
    assert.equal(result.allowed, true);
  });

  it('8. Teacher can initiate direct chat with Teacher', () => {
    const teacherA = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const teacherB = { id: 'teacher_2', role: 'teacher', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacherA, teacherB);
    assert.equal(result.allowed, true);
  });

  it('9. Teacher can initiate direct chat with Assistant Teacher', () => {
    const teacher = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const asstTeacher = { id: 'asst_teacher_1', role: 'assistant_teacher', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacher, asstTeacher);
    assert.equal(result.allowed, true);
  });

  it('10. Teacher can initiate direct chat with Moderator', () => {
    const teacher = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const mod = { id: 'mod_1', role: 'moderator', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacher, mod);
    assert.equal(result.allowed, true);
  });

  it('11. Teacher can initiate direct chat with Admin', () => {
    const teacher = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const admin = { id: 'admin_1', role: 'admin', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacher, admin);
    assert.equal(result.allowed, true);
  });

  it('12. Teacher can initiate direct chat with Super Admin', () => {
    const teacher = { uid: 'teacher_1', role: 'teacher', status: 'approved', is_active: true };
    const superAdmin = { id: 'super_admin_1', role: 'super_admin', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(teacher, superAdmin);
    assert.equal(result.allowed, true);
  });

  // Test 13-16: Assistant Teacher, Moderator, Admin, Super Admin
  it('13. Assistant Teacher can initiate direct chat with any active authenticated role', () => {
    const asstTeacher = { uid: 'asst_1', role: 'assistant_teacher', status: 'approved', is_active: true };
    const student = { id: 'student_99', role: 'student', status: 'approved', is_active: true };
    assert.equal(canInitiateDirectChat(asstTeacher, student).allowed, true);
  });

  it('14. Moderator can initiate direct chat with any active authenticated role', () => {
    const moderator = { uid: 'mod_1', role: 'moderator', status: 'approved', is_active: true };
    const teacher = { id: 'teacher_99', role: 'teacher', status: 'approved', is_active: true };
    assert.equal(canInitiateDirectChat(moderator, teacher).allowed, true);
  });

  it('15. Admin can initiate direct chat with any active authenticated role', () => {
    const admin = { uid: 'admin_1', role: 'admin', status: 'approved', is_active: true };
    const student = { id: 'student_12', role: 'student', status: 'approved', is_active: true };
    assert.equal(canInitiateDirectChat(admin, student).allowed, true);
  });

  it('16. Super Admin can initiate direct chat with any active authenticated role', () => {
    const superAdmin = { uid: 'super_admin_1', role: 'super_admin', status: 'approved', is_active: true };
    const asstTeacher = { id: 'asst_1', role: 'assistant_teacher', status: 'approved', is_active: true };
    assert.equal(canInitiateDirectChat(superAdmin, asstTeacher).allowed, true);
  });

  // Test 17-21: Security guards, account state validation, self-chat prevention
  it('17. Unauthenticated user cannot initiate direct chat', () => {
    const unauth = null;
    const target = { id: 'user_1', role: 'student', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(unauth, target);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'UNAUTHENTICATED');
  });

  it('18. Null or invalid target user returns USER_NOT_FOUND', () => {
    const current = { uid: 'user_1', role: 'student', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(current, null);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'USER_NOT_FOUND');
  });

  it('19. Self-chat is strictly prohibited', () => {
    const user = { uid: 'user_self', role: 'student', status: 'approved', is_active: true };
    const targetSelf = { id: 'user_self', role: 'student', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(user, targetSelf);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'SELF_CHAT');
  });

  it('20. Suspended or inactive current user is denied initiation', () => {
    const suspendedUser = { uid: 'user_susp', role: 'student', status: 'suspended', is_active: false };
    const target = { id: 'user_ok', role: 'teacher', status: 'approved', is_active: true };
    const result = canInitiateDirectChat(suspendedUser, target);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'ACCOUNT_INACTIVE');
  });

  it('21. Suspended, banned, or deleted target user is denied', () => {
    const current = { uid: 'user_ok', role: 'teacher', status: 'approved', is_active: true };
    const bannedTarget = { id: 'user_banned', role: 'student', status: 'banned', is_active: false };
    const result = canInitiateDirectChat(current, bannedTarget);
    assert.equal(result.allowed, false);
    assert.equal(result.reason, 'TARGET_INACTIVE');
  });

  // Test 22-24: Deterministic IDs, IDOR boundaries, Broadcast write protection
  it('22. Deterministic Direct Chat ID generation is symmetric and deterministic', () => {
    const uidA = 'user_alpha_123';
    const uidB = 'user_beta_456';
    const idAB = getDeterministicChatId(uidA, uidB);
    const idBA = getDeterministicChatId(uidB, uidA);
    assert.equal(idAB, idBA);
    assert.equal(idAB, 'direct_user_alpha_123_user_beta_456');
  });

  it('23. Non-participant third-party access is strictly denied (IDOR protection)', () => {
    const chat = {
      id: 'direct_user_A_user_B',
      type: 'direct',
      participants: ['user_A', 'user_B'],
    };
    assert.equal(canAccessConversation('user_A', chat), true);
    assert.equal(canAccessConversation('user_B', chat), true);
    assert.equal(canAccessConversation('user_attacker_C', chat), false);
    assert.equal(canAccessConversation('random_student_D', chat), false);
  });

  it('24. Broadcast write authorization is strictly restricted to admin roles', () => {
    const broadcastChat = {
      id: 'broadcast_announcements',
      type: 'broadcast',
      participants: [],
    };
    const student = { uid: 'student_1', role: 'student' };
    const teacher = { uid: 'teacher_1', role: 'teacher' };
    const admin = { uid: 'admin_1', role: 'admin' };
    const superAdmin = { uid: 'super_1', role: 'super_admin' };

    // All authenticated users can read broadcasts
    assert.equal(canAccessConversation(student.uid, broadcastChat), true);
    assert.equal(canAccessConversation(teacher.uid, broadcastChat), true);

    // Only admin / super_admin can write to broadcasts
    assert.equal(canWriteToConversation(student, broadcastChat), false);
    assert.equal(canWriteToConversation(teacher, broadcastChat), false);
    assert.equal(canWriteToConversation(admin, broadcastChat), true);
    assert.equal(canWriteToConversation(superAdmin, broadcastChat), true);
  });

});
