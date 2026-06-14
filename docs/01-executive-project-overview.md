# Executive Project Overview

## Product
Madrasa is an Expo SDK 54 / React Native learning and community application backed by Firebase, Firestore, and a FastAPI service. It supports authenticated students, teachers, moderators, admins, and super admins across learning content, live classes, chat, notifications, payments, attendance, certificates, and Islamic utility features.

## Value proposition
- Provide a mobile-first Islamic learning platform with courses, quizzes, books, audio lessons, live classes, attendance, progress, and certificates.
- Centralize community communication through direct/group/broadcast chat, status updates, and push notifications.
- Give administrators operational controls for users, academics, moderation, payments, analytics, privacy requests, and security.

## Major systems
- **Frontend:** Expo Router app under `frontend/app`, shared domain logic under `frontend/lib`, and Firebase client SDK.
- **Backend:** FastAPI service under `backend/server.py` with payment, notification, live class, analytics, AI, and worker endpoints.
- **Data:** Cloud Firestore secured by `firestore.rules`; MongoDB is used by legacy status check endpoints.
- **Realtime/media:** Firestore realtime listeners, Expo push, Agora live classes/calls, and recording metadata.
- **Operations:** Railway-style backend deployment, Firebase Hosting/config, worker jobs, health checks, analytics, and security logs.

## Primary personas
- **Student:** Learns, attends live classes, chats, pays fees/donations, receives notifications, submits quizzes/assignments, and downloads certificates.
- **Teacher / assistant teacher:** Manages assigned live/audio class activity, attendance, class communication, and learning interactions.
- **Moderator:** Reviews community reports and takes allowed moderation actions.
- **Admin / super admin:** Manages users, academics, settings, payments, analytics, privacy, security, and platform operations.
