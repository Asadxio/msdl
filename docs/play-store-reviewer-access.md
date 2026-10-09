# Google Play Store Reviewer Access & App Evaluation Guide

**Application Name:** Madrasa Tus Salikat Lil Banat (مدرسۃ السالکات للبنات)  
**Package ID:** `com.madrasatussalikat.lilbanat`  
**Target SDK:** 36 (Android 16 preview / Android 15 compatible) | **Min SDK:** 24 (Android 7.0)  
**Submission Version:** 1.0.13 (VersionCode: 50)  

---

## 1. App Access Instructions for Google Play Reviewers

The Madrasa Tus Salikat Lil Banat app is an Islamic educational platform featuring role-based access (Student, Faculty/Teacher, Administrator) and administrative account approval.

To allow full and unrestricted review of all core academic and student journeys, use the dedicated, pre-approved reviewer credentials below.

### A. Pre-Approved Student Reviewer Credentials
* **Email:** `reviewer.student@madrasatussalikat.org`
* **Password:** *(Enter the secure password configured in Firebase Auth and provided in Play Console App Access)*
* **Account Status:** Pre-Approved (`status: approved`, `role: student`, `email_verified: true`)
* **Pre-Enrolled Courses:** 
  1. *Hifz-ul-Quran (Tahfeez)*
  2. *Darse Nizami (Aalima Course)*
  3. *Tajweed & Qira'at*

### B. Pre-Approved Teacher / Faculty Reviewer Credentials
* **Email:** `reviewer.teacher@madrasatussalikat.org`
* **Password:** *(Enter the secure password configured in Firebase Auth and provided in Play Console App Access)*
* **Account Status:** Pre-Approved (`status: approved`, `role: teacher`, `email_verified: true`)
* **Access Permissions:** Faculty dashboard, lesson scheduling, student assignment reviews.

---

## 2. Key User Journeys to Test

### Journey 1: Academic Learning & Offline Audio
1. Log in with the student test account.
2. Navigate to the **Courses** tab.
3. Open any active course (e.g., *Tajweed & Qira'at*).
4. View course modules, play recorded audio lessons (audio playback continues seamlessly).
5. Open an assignment, view questions, and test assignment submission.

### Journey 2: Prayer Times & Qibla Direction
1. Navigate to the **Qibla / Prayer** feature.
2. Grant Location permission when prompted (used on-device solely to compute the local Qibla heading toward Makkah and prayer schedules).
3. The compass hardware sensor and map overlay illustrate orientation toward Al-Kaaba.

### Journey 3: Interactive Quizzes & Flashcards
1. Open the **Quiz** tab.
2. Select an Islamic knowledge category.
3. Answer questions and view the verified result summary.

### Journey 4: Community Chat & Content Safety
1. Open the **Chats** tab.
2. Review direct or class messaging.
3. Long-press or tap chat actions to test:
   * **Report Message / Chat**: Flags content for admin moderation queue.
   * **Block User**: Instantly blocks bidirectional direct communication.

### Journey 5: Data & Privacy / Account Deletion
1. Open **Settings** → **Data & Privacy**.
2. Review the public Privacy Policy link.
3. Test **Account Deletion Request** (in-app direct deletion or queued request).

---

## 3. Public Verification URLs

* **Privacy Policy URL:** `https://madrasa-app-50d6c.firebaseapp.com/privacy-policy.html`
* **Account Deletion URL:** `https://madrasa-app-50d6c.firebaseapp.com/account-deletion.html`
* **Support Contact Email:** `madrastussalikatlilbanat@gmail.com`

---

## 4. Policy Compliance Summary

* **Target Audience:** General audience (students 13+ and adult learners). Not primarily directed at children under 13.
* **Location Usage:** On-device ephemeral processing for prayer time calculation and Qibla compass alignment. No server-side tracking.
* **Foreground Services:** Declared for active live-class streaming (`FOREGROUND_SERVICE_CAMERA`, `FOREGROUND_SERVICE_MICROPHONE`) and lesson audio (`FOREGROUND_SERVICE_MEDIA_PLAYBACK`).
* **Content Moderation:** In-app reporting and user blocking active in chat and status feeds.
