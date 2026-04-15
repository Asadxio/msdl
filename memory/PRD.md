# Madrasa Tus Salikat Lil Banat - Islamic Learning App

## Overview
A clean, premium, mobile-first Islamic Learning App with green, white, and gold theme. UI-only app with interactive navigation and local data.

## App Structure
**Bottom Tab Navigation (5 tabs):** Home, Courses, Teachers, Library, About
**Detail Screens (Stack):** Course Detail, Teacher Detail

## Course-Teacher Mapping

### Sumra Fatma Qadri (Teacher 1):
- Darse Nizami (Alima Course), Chahal Hadith, Bahare Shariat Course, Tafseer Course, Sahabiyat wa Sahliyat ke Ala Ausaf

### Firdos Fatma (Teacher 2):
- Tajweed Course, Nazra Course, Madni Qaida Course, Qirat Course

### Afnaz Razvi (Teacher 3):
- Deeniyat Course, Farze Uloom, Muballigah Course, Urdu Course, Kids Deeniyat Course

## Screens

### Home Screen
- Arabic greeting, Madrasa name, Featured Courses (horizontal scroll, tappable), Teachers Preview (tappable), Announcements, Quick Stats

### Courses Screen
14 course cards - each tappable to open Course Detail. "Attend Class" button also opens detail.

### Course Detail Screen (/course/[id])
- Hero image with course name
- Teacher info (tappable to teacher detail)
- Schedule, Description
- "Join Class" button → alert: "Class link will be shared by teacher"

### Teachers Screen
3 teacher cards (tappable to Teacher Detail)

### Teacher Detail Screen (/teacher/[id])
- Profile avatar, Alima Fazila title badge
- Stats (courses, students, years)
- Full bio
- List of courses taught (tappable to course detail)

### Library Screen
8 books in 2-column grid with category badges

### About Screen
Bismillah, Introduction, Vision, Mission, Contact placeholder

## Tech Stack
- Expo SDK 54, Expo Router (file-based), expo-linear-gradient, @expo/vector-icons

## Design
- Primary: #0F3822, Secondary: #D4AF37, Background: #FDFBF7
- No backend, no auth - all local data
