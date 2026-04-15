# Madrasa Tus Salikat Lil Banat - Islamic Learning App

## Overview
Premium, mobile-first Islamic Learning App with Firebase Firestore backend, digital library with PDF viewer, and admin book management.

## Architecture
- **Frontend**: Expo SDK 54, Expo Router, Firebase JS SDK, WebView
- **Data Source**: Firebase Firestore (with local fallback)
- **Firebase Project**: madrasa-app-50d6c

## Firebase Collections
- **courses**: name, teacher_name, schedule, description, class_link
- **teachers**: name, title, courses (array)
- **library**: title, pdf_url, category, created_at

## App Structure
**Tab Navigation:** Home, Courses, Teachers, Library, About
**Detail Screens:** Course Detail, Teacher Detail, Book Viewer, Admin Add Book

## Key Features
- Firebase Firestore integration with long polling
- Digital library with PDF viewer (Google Docs viewer via WebView)
- Admin panel for adding books with seed functionality
- Join Class button opens class_link or shows alert
- Loading/empty states throughout
- Local data fallback for courses/teachers

## Library System
- Books fetched from Firestore 'library' collection
- PDF viewer using WebView with Google Docs embedded viewer
- View Book / Download buttons
- Admin add-book screen with form and initial seed (4 books)
- Category-based icons and color coding

## Initial Books
1. Risala Roohi Sharif (Islamic)
2. Misbah-ul-Insha Part 1 (Urdu)
3. Uroos ul Adab (Urdu)
4. Qirat Course (Qirat)

## Design
- Primary: #0F3822, Secondary: #D4AF37, Background: #FDFBF7
