# Play Store Data Safety Checklist

This checklist is based on the current app features: Firebase authentication, Firestore profile/admin data, chat/status/media, live classes, manual payment/donation verification, push notifications, attendance, and account/privacy requests.

> Use this as owner guidance when completing Google Play Console Data Safety. Confirm final answers against the production build, Firebase project, backend logs, and any third-party contracts before submission.

| Data type | Collected? | Shared with third parties? | Encrypted in transit? | User can request deletion? | Notes |
| --- | --- | --- | --- | --- | --- |
| Name | Yes | Yes | Yes | Yes | Stored in user profiles, chat/status display, live-class participation, admin records. Shared with Firebase/backend services needed to run the app. |
| Email address | Yes | Yes | Yes | Yes | Used for Firebase Auth, account approval, support, and privacy/payment follow-up. |
| User IDs | Yes | Yes | Yes | Yes | Firebase UID and internal document IDs are used across user, chat, payment, attendance, privacy, and moderation records. |
| Profile photo/avatar | Yes | Yes | Yes | Yes | Used for account/profile display if uploaded or selected. |
| Role/account status | Yes | Yes | Yes | Yes | Student/teacher/admin role and approval/deactivation status are required for access control. |
| Payment references | Yes | Yes | Yes | Partial | Manual payment/donation references, amounts, review status, admin notes, reconciliation, and audit data may need retention for accounting/disputes. |
| Donation information | Yes | Yes | Yes | Partial | Donation type and reference details are reviewed by admins and may be retained for accounting/legal records. |
| Chat messages | Yes | Yes | Yes | Yes | Messages, attachments, read receipts, and moderation evidence are stored for classroom communication and safety. |
| Status posts/comments/reactions | Yes | Yes | Yes | Yes | User-generated status content, comments, views, reactions, and moderation evidence are stored. |
| Media uploads | Yes | Yes | Yes | Yes | Images, videos, audio, documents, assignments, and chat/status media are stored in Firebase Storage or linked storage services. |
| Attendance records | Yes | Yes | Yes | Partial | Attendance and duration are educational records and may need retention for class/accounting/dispute history. |
| Live-class participation | Yes | Yes | Yes | Partial | Agora channel/session metadata, participant state, reconnect info, and duration are used for live classes and attendance. |
| Agora recordings/recording metadata | Yes, if recording enabled | Yes | Yes | Partial | Recording files/metadata may be processed by Agora and storage providers; retention depends on madrasa policy and legal/safety needs. |
| Push notification tokens | Yes | Yes | Yes | Yes | Expo/Firebase push tokens are used for class, chat, payment, and admin notifications. |
| Device/app diagnostics | Yes | Yes | Yes | Partial | Error logs, security events, performance data, and abuse-prevention logs help operate and secure the app. |
| Approximate location | No current core feature verified | No | Yes, if ever used | Yes | Do not mark collected unless the production build actually requests or stores location. |
| Precise location | No current core feature verified | No | Yes, if ever used | Yes | Do not mark collected unless a production feature requests or stores precise location. |
| Contacts | No | No | N/A | N/A | No contacts collection was identified as a current app requirement. |
| SMS/call logs | No | No | N/A | N/A | No SMS or call-log collection was identified. |

## Third-party processors to disclose where applicable

- Firebase Authentication, Firestore, Firebase Storage, Firebase/Expo push notifications
- Railway / FastAPI backend infrastructure
- Agora live audio/video and recording services
- Razorpay or payment-reference/payment reconciliation services, if used in production
- Any analytics, crash, or operational logging provider enabled in the production build

## Deletion and retention note

Users can request data export or account deletion from the app Data & Privacy screen and from the public account deletion page. Some payment, safety, attendance, moderation, audit, or legal records may be retained or anonymized where required for accounting, dispute handling, fraud prevention, student safety, or legal compliance.
