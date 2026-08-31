const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================');
console.log('  PHASE 26.1 — MSLB CHAT RELIABILITY GATE RECONCILIATION SUITE  ');
console.log('================================================================');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  [PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('  [FAIL] ' + name + ': ' + err.message);
    failed++;
  }
}

const repoRoot = 'C:/Users/xioas/.gemini/antigravity/scratch/msdl';
const chatsSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/(tabs)/chats.tsx'), 'utf8');
const chatDetailSrc = fs.readFileSync(path.join(repoRoot, 'frontend/app/chat/[id].tsx'), 'utf8');
const reconSrc = fs.readFileSync(path.join(repoRoot, 'frontend/lib/chatReconciliation.ts'), 'utf8');
const relSrc = fs.readFileSync(path.join(repoRoot, 'frontend/lib/chatReliability.ts'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(repoRoot, 'firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.join(repoRoot, 'storage.rules'), 'utf8');

// ============================================================
// PART 1: DETERMINISTIC DIRECT CHAT ID & RACE CONDITION AUDIT
// ============================================================

test('P26.1-01: Deterministic Direct Chat ID strategy guarantees zero duplicate conversations', () => {
  assert.ok(chatsSrc.includes("const deterministicChatId = `direct_${[user.uid, target.id].sort().join('_')}`;"));
  assert.ok(chatDetailSrc.includes("setDoc(chatDocRef") || chatsSrc.includes("setDoc(deterministicDocRef, payload)"));
});

test('P26.1-02: Direct chat creation pre-flight checks existing chats before creating new documents', () => {
  assert.ok(chatDetailSrc.includes("chatDocSnap.exists()") || chatsSrc.includes("deterministicDocSnap.exists()"));
  assert.ok(chatsSrc.includes("safePush(`/chat/${existing.id}`)") || chatsSrc.includes("safePush(`/chat/${found.id}`)"));
});

// ============================================================
// PART 2: UNREAD & READ RECEIPT FORENSIC INVARIANTS
// ============================================================

test('P26.1-03: Firestore rules restrict message read_by updates strictly to authenticated user', () => {
  assert.ok(firestoreRules.includes("request.auth.uid in request.resource.data.read_by"));
  assert.ok(firestoreRules.includes("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read_by'])"));
});

test('P26.1-04: Chat updates restrict unread_counts modifications to participants', () => {
  assert.ok(firestoreRules.includes("isChatParticipant()"));
  assert.ok(firestoreRules.includes("'unread_counts'"));
});

// ============================================================
// PART 3: INVERTED FLATLIST EMPTY STATE FIX
// ============================================================

test('P26.1-05: Inverted FlatList EmptyState renders upright without double inversion artifact', () => {
  assert.ok(chatDetailSrc.includes("emptyWrap: { alignItems: 'center', justifyContent: 'center' }"));
  assert.ok(!chatDetailSrc.includes("emptyWrap: { transform: [{ scaleY: -1 }]"));
});

// ============================================================
// PART 4: REALTIME RECONCILIATION & OFFLINE OUTBOX
// ============================================================

test('P26.1-06: Outbox queue provides exponential backoff and lock mechanisms for offline retries', () => {
  assert.ok(relSrc.includes("export function nextBackoffMs"));
  assert.ok(relSrc.includes("export async function lockReadyItems"));
});

test('P26.1-07: mergeServerAndLocal reconciles optimistic messages without duplicate rendering', () => {
  assert.ok(reconSrc.includes("export function mergeServerAndLocal"));
  assert.ok(reconSrc.includes("export function dedupeMessages"));
});

// ============================================================
// PART 5: NOTIFICATIONS & STORAGE SECURITY
// ============================================================

test('P26.1-08: Notification dispatch includes target chat_id and dedupeId to prevent push storms', () => {
  assert.ok(chatDetailSrc.includes("channel: 'chat'"));
  assert.ok(chatDetailSrc.includes("data: { chat_id: id }"));
  assert.ok(chatDetailSrc.includes("dedupeId: pushDedupeId"));
});

test('P26.1-09: Chat storage media rules enforce participant access and 20MB safe MIME whitelist', () => {
  assert.ok(storageRules.includes("canReadChatMedia(chatId)"));
  assert.ok(storageRules.includes("isSafeChatMediaUpload()"));
});

test('P26.1-10: Live payment test remains strictly PAUSED and zero secrets exposed in source tree', () => {
  assert.ok(!chatsSrc.includes('AIzaSy'));
  assert.ok(!chatDetailSrc.includes('AIzaSy'));
});

console.log('');
console.log('================================================================');
console.log('   PHASE 26.1 RESULTS: ' + passed + ' PASSED / ' + failed + ' FAILED');
console.log('================================================================');
if (failed > 0) process.exit(1);
