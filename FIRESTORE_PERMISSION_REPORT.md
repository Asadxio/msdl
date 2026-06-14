# Firestore permission investigation: chat and notifications

## Screens inspected

- Chat list: `frontend/app/(tabs)/chats.tsx`
- Chat detail: `frontend/app/chat/[id].tsx`
- Notifications tab: `frontend/app/(tabs)/notifications.tsx`
- Tab badge listeners: `frontend/app/(tabs)/_layout.tsx`
- Rules: `firestore.rules`

## Firestore reads and writes

### Chat list (`frontend/app/(tabs)/chats.tsx`)

| Collection | Operation | Query / document |
| --- | --- | --- |
| `chats` | listen / get | `where('participants', 'array-contains', user.uid), orderBy('updated_at', 'desc')` |
| `chats` | listen / get | `where('type', '==', 'broadcast'), orderBy('updated_at', 'desc')` |
| `public_profiles` | get | `where('searchable', '==', true)` |
| `chats` | update | `doc('chats', chatId)` for `pinned_by`, `hidden_by`, and `unread_counts.<uid>` |
| `chats` | create | direct, group, and broadcast chat documents |

### Chat detail (`frontend/app/chat/[id].tsx`)

| Collection | Operation | Query / document |
| --- | --- | --- |
| `chats` | listen / get | `doc('chats', id)` |
| `messages` | listen / get | `where('chat_id', '==', id), orderBy('created_at', 'desc'), limit(PAGE_SIZE)` |
| `messages` | get | same query plus `startAfter(lastCursor)` for pagination |
| `messages` | set | `doc('messages', messageId)` for text/media/outbox flush sends |
| `messages` | update | `read_by`, `status`, `seen_at`, `deleted_for`, unsend fields |
| `chats` | update | `typing.<uid>`, `last_message`, `updated_at`, `unread_counts.<uid>`, `muted_by`, `blocked_pairs`, `hidden_by` |

### Notifications tab and badges

| Collection | Operation | Query / document |
| --- | --- | --- |
| `notifications` | listen | previously `where('user_id', 'in', [uid, 'all', 'role_targeted']), orderBy('created_at', 'desc')` |
| `notifications` | listen | now split into `user_id in [uid, 'all']`, role-targeted by `target_roles array-contains role`, and role-targeted by `target_user_ids array-contains uid` |
| `notifications` | update | `read.<uid>` mark-read |
| `notifications` | create | via admin notification dispatch path |
| `notifications` | update/delete | admin edit/delete, user hide via `hidden_by` |
| `users` | get | role notification helpers query approved users by role before dispatch |

## Rule coverage found

| Collection | Rule present? | Relevant rule behavior |
| --- | --- | --- |
| `chats` | Yes | `allow read: if canReadChat()` permits approved verified users when the doc is a broadcast or the requester is a participant. Create/update are constrained by `isValidChatCreate()` and `isValidChatUpdate()`. |
| `messages` | Yes | `allow read: if canReadMessage()` permits broadcast messages and participant messages. Create requires `canWriteMessageToChat()`. Update requires `isValidMessageUpdate()`. |
| `chat_messages` | Yes | Backward-compatible alias using message validation helpers. |
| `notifications` | Yes | `allow read: if canReadNotification()` permits broadcast (`all`), own, or role/user-targeted docs matching the requester. Create/update/delete are constrained separately. |
| `broadcasts` | No dedicated match | No current app reads/writes found in the inspected chat/notification screens. A request to a top-level `broadcasts` collection would be denied by default. |
| `announcements` | No dedicated match | No current app reads/writes found in the inspected chat/notification screens. A request to a top-level `announcements` collection would be denied by default. |
| `chatRooms` | No dedicated match | No current app reads/writes found in the inspected chat/notification screens. A request to a top-level `chatRooms` collection would be denied by default. |
| `conversations` | No dedicated match | No current app reads/writes found in the inspected chat/notification screens. A request to a top-level `conversations` collection would be denied by default. |

## Role access verification

Rules require an approved, email-verified user document for most app data through `isApprovedVerifiedUser()`. Under that condition:

- Students can read their participant chats, broadcast chats, their allowed messages, broadcast/own/targeted notifications, and can create direct chats/messages when participants.
- Teachers can do the same, and can create some direct/class notification documents allowed by `isValidNotificationCreate()`.
- Admins and super admins satisfy `isAdmin()` for privileged notification, group chat, broadcast chat, and broadcast-message actions.

## Failing collection and query

### Primary likely failure

- **Failing collection:** `notifications`
- **Failing query:** `where('user_id', 'in', [uid, 'all', 'role_targeted']), orderBy('created_at', 'desc')`
- **Rule causing denial:** `canReadNotification()` only allows a `role_targeted` document if the requester is in `target_user_ids` or their role is in `target_roles`. The broad `in` query can match role-targeted documents for other roles/users, so Firestore rejects the whole query with `permission-denied` instead of returning only the readable subset.
- **Exact fix:** Split notification reads into rule-provable queries:
  1. `user_id in [uid, 'all']`
  2. `user_id == 'role_targeted' AND target_roles array-contains profile.role`
  3. `user_id == 'role_targeted' AND target_user_ids array-contains uid`

This fix was applied to both the notifications screen and the tab badge listener.

### Chat rule status

- **Failing collection:** no definite chat collection failure found from the rules alone.
- **Queries checked:** `chats` participant query, `chats` broadcast query, `chats/{id}`, and `messages` by `chat_id`.
- **Rule status:** matching rules exist and should allow approved verified students, teachers, admins, and super admins when they are participants or reading broadcasts.
- **Exact fix if logs still show denial:** use the new `FirestorePermissionDebug` output to identify the specific operation. Likely causes would be user documents not `status == 'approved'`, email not verified, a non-participant reading non-broadcast `messages`, or a client write payload failing `isValidChatUpdate()` / `isValidMessageUpdate()` key and field constraints.

## Temporary logging added

Temporary Firestore failure logging now prints:

- collection name
- operation type (`listen`, `get`, `add`, `set`, `update`, `delete`)
- query/document description
- Firebase error code
- Firebase error message

Log prefix: `[FirestorePermissionDebug]`.
