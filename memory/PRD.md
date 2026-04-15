# Madrasa Tus Salikat Lil Banat - Islamic Learning App

## Overview
A premium, mobile-first Islamic Learning App with Firebase Firestore backend. Green, white, and gold Islamic theme.

## Architecture
- **Frontend**: Expo SDK 54, Expo Router (file-based navigation), Firebase JS SDK
- **Data Source**: Firebase Firestore (with local fallback)
- **Firebase Project**: madrasa-app-50d6c

## Firebase Collections
- **courses**: name, teacher_name, schedule, description, class_link
- **teachers**: name, title, courses (array of course names)

## App Structure
**Tab Navigation:** Home, Courses, Teachers, Library, About
**Detail Screens (Stack):** Course Detail, Teacher Detail

## Key Features
- Firebase Firestore integration with long polling for compatibility
- Loading states while fetching data
- Graceful fallback to local data if Firebase unavailable
- Join Class button opens class_link URL or shows alert
- Dynamic stats from live data

## Screens
- **Home**: Greeting, featured courses (horizontal), teachers preview, announcements, dynamic stats
- **Courses**: FlatList of courses from Firestore with teacher names and Attend Class buttons
- **Course Detail**: Hero image, teacher link, schedule, description, Join Class button
- **Teachers**: Teacher cards with courses taught, clickable to detail
- **Teacher Detail**: Profile, stats, list of courses they teach
- **Library**: 8 books in 2-column grid (static)
- **About**: Bismillah, Introduction, Vision, Mission (static)

## Design
- Primary: #0F3822, Secondary: #D4AF37, Background: #FDFBF7
- No authentication (yet)
