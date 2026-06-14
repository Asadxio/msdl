# Firestore audit report: admin modules, quiz, payment flow, recordings, chat, notifications

## Executive summary

This audit traced each affected UI screen to Firestore calls and then to `firestore.rules` and `firestore.indexes.json`.

Confirmed root causes and fixes:

1. **Learning-content rules referenced missing helper functions**: `canReadCourseData()` and `canReadLearningContent()` were used by `courses`, `quizzes`, `lessons`, `modules`, `assignments`, `categories`, and `audio_lessons`, but were not defined in `firestore.rules`. This blocks deployment of the intended rules and/or leaves deployed rules inconsistent with the app. A complete rules patch now defines both helpers.
2. **Notifications query was over-broad**: already fixed by splitting role-targeted queries so Firestore can prove every returned document is readable.
3. **Super admins were hidden from some UI admin checks**: Quiz, Recordings, and Analytics checked only `profile?.role === 'admin'`; code now allows `super_admin` in those screens.
4. **Required indexes were incomplete**: payment status filtering and Manage Users filtering/pagination require composite indexes that were missing. Indexes were added for `payments.status + created_at` and `users` filter/order combinations.
5. **Errors were being swallowed**: Manage Users caught failures and rendered an empty list. Temporary `[FirestoreDebug]` logging now records collection, operation, path/query, auth uid, role, status, Firebase error code, and Firebase error message for every audited Firestore operation.

## Debug logging format

All newly instrumented audited operations call:

```ts
logFirestoreFailure({ collection, operation, path, query, role, status }, error)
```

which emits:

```ts
console.log('[FirestoreDebug]', {
  collection,
  operation,
  path,
  query,
  uid: auth.currentUser?.uid,
  role,
  status,
  errorCode: error?.code,
  errorMessage: error?.message,
});
```

## Complete Firestore operation matrix

| Screen | File path | Collection name | Query / path used | Read or Write | Required role | Current Firestore rule | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `courses` | `getDocs(collection(db, 'courses'))` | Read | approved admin/super_admin in UI; rules allow approved verified users after helper fix | `allow read: if canReadCourseData(courseId, resource.data)` | **Fixed**: helper now exists and delegates to approved verified access. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `teachers` | `getDocs(collection(db, 'teachers'))` | Read | admin/super_admin UI | `allow read: if isApprovedVerifiedUser()` | Allowed for approved verified users. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `lessons` | `getDocs(collection(db, 'lessons'))` | Read | admin/super_admin UI | `allow read: if canReadLearningContent(resource.data)` | **Fixed**: helper now exists. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `recordings` | `getDocs(collection(db, 'recordings'))` | Read | admin/super_admin UI | `allow read: if canReadRecordingData(resource.data)` | Allowed for approved verified users; logging added. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `courses` | `addDoc`, `updateDoc(doc(db, 'courses', id))`, `deleteDoc` | Write | admin/super_admin | `create/update: isAdmin() && isValidCourseWrite(); delete: isAdmin()` | Allowed if payload matches allowed course fields. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `teachers` | `addDoc`, `updateDoc(doc(db, 'teachers', id))`, `deleteDoc` | Write | admin/super_admin | `create/update: isAdmin() && isValidTeacherWrite(); delete: isAdmin()` | Allowed if payload matches teacher fields. |
| Manage Academics | `frontend/app/admin/manage-academics.tsx` | `recordings` | `addDoc`, `updateDoc(doc(db, 'recordings', id))`, `deleteDoc` | Write | admin/super_admin | `create/update/delete: isAdmin()` | Allowed. |
| Manage Payments | `frontend/app/admin/payments.tsx` through `frontend/lib/adminPagination.ts` | `payments` | `orderBy('created_at', 'desc'), limit(25)` | Read | admin/super_admin | `allow list: if isAdmin()` | Allowed; logging added. |
| Manage Payments | `frontend/app/admin/payments.tsx` | `payments` | `where('state', '==', status), orderBy('created_at', 'desc')` | Read | admin/super_admin | `allow list: if isAdmin()` | Allowed; existing index present. |
| Manage Payments | `frontend/app/admin/payments.tsx` | `payments` | `where('status', '==', status), orderBy('created_at', 'desc')` | Read | admin/super_admin | `allow list: if isAdmin()` | **Fixed**: missing composite index added. |
| Manage Payments | `frontend/app/admin/payments.tsx` | `payments` | API `/payments/admin/action` updates payment | Write | admin/super_admin | Server-side flow plus `isValidPaymentUpdateByAdmin()` for direct Firestore writes | No direct client Firestore write; API errors already logged, Firestore debug logs read failures. |
| Privacy Requests | `frontend/app/admin/privacy-requests.tsx` | `privacy_requests` | `orderBy('created_at', 'desc')` | Read | admin/super_admin | `allow read: if isAdmin() || owner` | Allowed for approved verified admin/super_admin. |
| Privacy Requests | `frontend/app/admin/privacy-requests.tsx` | `privacy_requests/{id}` | `updateDoc` state + `updated_at` | Write | admin/super_admin | `allow update: if isAdmin() && immutable fields unchanged && state valid` | Allowed if only valid state lifecycle changes. |
| Quiz | `frontend/app/(tabs)/quiz.tsx` | `quizzes` | `getDocs(collection(db, 'quizzes'))` | Read | approved verified users | `allow read: if canReadLearningContent(resource.data)` | **Fixed**: helper now exists. |
| Quiz | `frontend/app/(tabs)/quiz.tsx` | `quiz_results` | `addDoc(collection(db, 'quiz_results'))` | Write | approved verified owner | `allow create: if user_id == request.auth.uid ...` | Allowed for approved verified users. |
| Quiz | `frontend/app/(tabs)/quiz.tsx` | `notifications` | self notification on submit | Write | approved verified owner | `isValidNotificationCreate()` allows `isSelf(user_id)` | Allowed. |
| Quiz Admin | `frontend/app/(tabs)/quiz.tsx` | `quizzes` | `addDoc`, `updateDoc`, `deleteDoc` | Write | admin/super_admin | `allow create/update/delete: if isAdmin()` | **Fixed UI**: super_admin now gets admin controls. |
| Payment Flow | `frontend/app/payment.tsx` | `app_settings/global`, `app_settings/platform` | `getDoc(doc(db, 'app_settings', ...))` | Read | approved verified users | `allow read: if isApprovedVerifiedUser()` | Allowed if email verified and user doc status approved. |
| Payment Flow | `frontend/app/payment.tsx` | `payments` | `where('user_id', '==', uid), orderBy('created_at', 'desc')` | Read | approved verified owner | `allow list: if isAdmin() || owner` | Allowed; index already existed. |
| Payment Flow | `frontend/app/payment.tsx` | `payments/{currentPaymentId}` | `getDoc` poll current payment | Read | approved verified owner/admin | `allow get: if isAdmin() || owner` | Allowed only if payment belongs to current user. |
| Payment Flow | `frontend/app/payment.tsx` | `payments` | API `/payments/initiate` and `/payments/confirm` | Write | approved verified user | Rules allow owner create/update if server writes compatible shape; API owns actual implementation | Logged at client boundary for failures. |
| Recordings | `frontend/app/recordings.tsx` | `recordings` | `orderBy('created_at', 'desc')` | Read | approved verified users | `allow read: if canReadRecordingData(resource.data)` | Allowed; existing single-field index present. |
| Recordings | `frontend/app/recordings.tsx` | `courses` | `getDocs(collection(db, 'courses'))` | Read | approved verified users | `allow read: if canReadCourseData(...)` | **Fixed**: helper now exists. |
| Recordings Admin | `frontend/app/recordings.tsx` | `recordings/{id}` | `deleteDoc` | Write | admin/super_admin | `allow delete: if isAdmin()` | **Fixed UI**: super_admin now gets admin control; logging added. |
| Analytics | `frontend/app/admin/analytics.tsx` | `users` | `getCountFromServer(collection(db, 'users'))` | Read/count | admin/super_admin | `allow list: if isAdmin() || isTeacherOrAdmin()` | Allowed for admin/super_admin. |
| Analytics | `frontend/app/admin/analytics.tsx` | `payments` | `getCountFromServer(collection(db, 'payments'))` | Read/count | admin/super_admin | `allow list: if isAdmin()` | Allowed. |
| Analytics | `frontend/app/admin/analytics.tsx` | `courses` | `getCountFromServer(collection(db, 'courses'))` | Read/count | admin/super_admin | `canReadCourseData(...)` | **Fixed** helper. |
| Analytics | `frontend/app/admin/analytics.tsx` | `users` | `where('last_login_at', '>=', threshold)` | Read | admin/super_admin | `allow list: if isAdmin() || isTeacherOrAdmin()` | Allowed; single-field index is automatic unless disabled. |
| Analytics | `frontend/app/admin/analytics.tsx` | `attendance` | `getDocs(collection(db, 'attendance'))` | Read | teacher/admin/super_admin | `allow read: if isTeacherOrAdmin() || owner` | Allowed for admin/super_admin. |
| Manage Users | `frontend/app/admin/users.tsx` | `users` | `orderBy('created_at', 'desc'), limit(25)` | Read | admin/super_admin | `allow list: if isAdmin() || isTeacherOrAdmin()` | **Fixed hidden failure**: errors now logged; index added for explicit order. |
| Manage Users | `frontend/app/admin/users.tsx` | `users` | optional `where('role','==', role)`, `where('status','==', status)`, `orderBy('created_at','desc')` | Read | admin/super_admin | `allow list: if isAdmin() || isTeacherOrAdmin()` | **Fixed**: missing composite indexes added. |
| Manage Users | `frontend/app/admin/users.tsx` | `users/{uid}` | `updateDoc`, secure role/status helpers, `deleteDoc` | Write | admin/super_admin | `allow update/delete: if isAdmin()` with validation | Allowed if payload passes validation. |
| Chat list/detail | `frontend/app/(tabs)/chats.tsx`, `frontend/app/chat/[id].tsx` | `chats`, `messages`, `public_profiles` | participant/broadcast chats and messages | Read/write | approved verified participants; admin for broadcast writes | `canReadChat()`, `canReadMessage()`, `isValidChat*`, `isValidMessage*` | Rules exist; logs identify any data-specific denial. |
| Notifications | `frontend/app/(tabs)/notifications.tsx`, `frontend/app/(tabs)/_layout.tsx` | `notifications` | direct/all + targeted-by-role + targeted-by-user split queries | Read/write | approved verified target/admin | `canReadNotification()`, `isValidNotification*` | **Fixed**: broad unprovable query removed. |

## Exact failing queries and rules

### 1. Courses / lessons / quizzes / recordings course-map reads

- **Failing collections:** `courses`, `lessons`, `quizzes`; indirectly `recordings` screens fail when paired `courses` read fails.
- **Failing queries:** `getDocs(collection(db, 'courses'))`, `getDocs(collection(db, 'lessons'))`, `getDocs(collection(db, 'quizzes'))`.
- **Blocking rule:** `allow read: if canReadCourseData(courseId, resource.data)` and `allow read: if canReadLearningContent(resource.data)` referenced helpers that did not exist in the rules file.
- **Code causing user-visible failures:** Manage Academics `Promise.all` fails the whole load when any of `courses`, `teachers`, `lessons`, or `recordings` fails; Quiz loads all `quizzes`; Recordings loads `recordings` and `courses` together.
- **Fix:** define `canReadLearningContent(data)` and `canReadCourseData(courseId, data)` in `firestore.rules`.

### 2. Manage Users empty list

- **Failing collection:** `users`.
- **Failing query:** filtered combinations of `role`, `status`, and `orderBy('created_at', 'desc')`.
- **Blocking issue:** missing composite indexes for `users` filter/order combinations; the previous catch block swallowed the Firebase error and rendered `[]`.
- **Rule verification:** `allow list: if isAdmin() || isTeacherOrAdmin()` permits approved verified admins and super_admins.
- **Fix:** add user composite indexes and log failures instead of silently swallowing.

### 3. Manage Payments status filter

- **Failing collection:** `payments`.
- **Failing query:** `where('status', '==', statusFilter), orderBy('created_at', 'desc')`.
- **Blocking issue:** missing composite index for `payments.status + created_at`.
- **Rule verification:** `allow list: if isAdmin()` permits approved verified admin/super_admin.
- **Fix:** add the missing payment index and log read failures.

### 4. Notifications permission denied

- **Failing collection:** `notifications`.
- **Failing query:** old `where('user_id', 'in', [uid, 'all', 'role_targeted']), orderBy('created_at', 'desc')`.
- **Blocking rule:** `canReadNotification()` only allows role-targeted documents for matching `target_roles` / `target_user_ids`; the old broad query could match unreadable targeted docs.
- **Fix:** split into direct/all, role-targeted by role, and role-targeted by user queries.

### 5. Super admin UI checks

- **Failing screens:** Quiz admin controls, Recordings delete control, Analytics screen.
- **Code causing failure:** checks used `profile?.role === 'admin'` only.
- **Rule verification:** `isAdmin()` includes both `admin` and `super_admin`.
- **Fix:** update UI checks to include `super_admin`.

## Custom claims and admin role detection

The app and rules do **not** rely on Firebase custom claims for these audited modules. Rules derive role and status from `/users/{uid}` via `roleOf(request.auth.uid)` and `userDoc(request.auth.uid).status`, and additionally require `request.auth.token.email_verified == true` for admin and approved-user helpers. Therefore, an admin/super_admin must have all of the following:

- Firebase auth signed in.
- Auth email verified.
- `/users/{uid}` exists.
- `/users/{uid}.status == 'approved'`.
- `/users/{uid}.role in ['admin', 'super_admin']` for admin-only operations.

If custom claims are being set by backend code, they are not used by these Firestore rules and cannot grant access unless the user document also matches.

## Index verification

Existing relevant indexes:

- `chats.participants + updated_at`
- `chats.type + updated_at`
- `messages.chat_id + created_at`
- `notifications.user_id + created_at`
- `payments.user_id + created_at`
- `payments.state + created_at`
- `recordings.created_at`
- `quiz_results.user_id + created_at`

Added indexes:

- `payments.status + created_at`
- `users.created_at`
- `users.role + created_at`
- `users.status + created_at`
- `users.role + status + created_at`

## Files modified

- `firestore.rules`
- `firestore.indexes.json`
- `frontend/lib/firestoreDebug.ts`
- `frontend/app/admin/manage-academics.tsx`
- `frontend/app/admin/payments.tsx`
- `frontend/app/admin/privacy-requests.tsx`
- `frontend/app/admin/analytics.tsx`
- `frontend/app/admin/users.tsx`
- `frontend/app/(tabs)/quiz.tsx`
- `frontend/app/payment.tsx`
- `frontend/app/recordings.tsx`

## Follow-up validation checklist

1. Deploy `firestore.rules` and `firestore.indexes.json`.
2. Sign in as an approved, email-verified `admin` and `super_admin`.
3. Open each audited screen and watch for `[FirestoreDebug]` logs.
4. If a log appears, use `collection`, `query`, `uid`, `role`, `status`, `errorCode`, and `errorMessage` to determine if the issue is auth state, user document state, missing index, or data shape validation.
