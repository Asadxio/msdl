# Madrasa Tus Salikat Lil Banat - Islamic Learning App

## Overview
Premium Islamic Learning App with Firebase Auth, Firestore backend, digital library, and admin panel.

## Architecture
- **Frontend**: Expo SDK 54, Expo Router, Firebase JS SDK, WebView
- **Backend**: Firebase Firestore + Firebase Auth (no custom backend)
- **Firebase Project**: madrasa-app-50d6c

## Firebase Collections
- **courses**: name, teacher_name, schedule, description, class_link
- **teachers**: name, title, courses (array)
- **library**: title, pdf_url, category, created_at
- **users**: name, email, role (student/teacher/admin), status (pending/approved), created_at

## Authentication
- Firebase Auth with Email/Password
- Session persistence via AsyncStorage
- Signup: Name, Email, Password, Role (Student/Teacher only)
- New users start with status="pending"
- Admin approval required before access

## Role-Based Access
- **Admin**: Full control, manage users, add courses, library, post announcements
- **Teacher**: View assigned courses, manage class links
- **Student**: View courses, join classes, access library

## Admin Accounts
- xioasad@gmail.com / sumra@1Sumra (admin, approved)
- sumraftm@gmail.com / sumra@1Sumra (admin, approved)

## App Screens
- Auth: Login, Signup, Pending Approval
- Tabs: Home, Courses, Teachers, Library, About
- Detail: Course Detail, Teacher Detail, Book Viewer
- Admin: Manage Users, Add Book

## Design
- Primary: #0F3822, Secondary: #D4AF37, Background: #FDFBF7
